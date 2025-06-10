import { Array, Effect, Logger, LogLevel, Match, Option, pipe, Redacted, Schedule, Schema, String } from 'effect';
import * as Context from 'effect/Context';
import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import crypto from 'crypto';
import { createTmpDir, getRemoteFile, readJsonFile, writeFile, writeJsonFile, } from '../libs/file.js';
import { copyFileFromComposeContainer, copyFileToComposeContainer, createComposeContainers, destroyCompose, doesVolumeExistWithLabel, getContainersForComposeProject, getEnvarFromComposeContainer, getVolumeLabelValue, getVolumeNamesWithLabel, pullComposeImages, restartCompose, restartComposeService, rmComposeContainer, startCompose, stopCompose } from '../libs/docker.js';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { getFreePorts } from '../libs/local-network.js';
import { filterStatusOk } from '@effect/platform/HttpClient';
const CHTX_LABEL_NAME = 'chtx.instance';
const UPGRADE_SVC_NAME = 'cht-upgrade-service';
const NGINX_SVC_NAME = 'nginx';
const ENV_FILE_NAME = 'env.json';
const UPGRADE_SVC_COMPOSE_FILE_NAME = 'docker-compose.yml';
const CHTX_COMPOSE_OVERRIDE_FILE_NAME = 'chtx-override.yml';
const CHT_COUCHDB_COMPOSE_FILE_NAME = 'cht-couchdb.yml';
const CHT_COMPOSE_FILE_NAMES = [
    'cht-core.yml',
    CHT_COUCHDB_COMPOSE_FILE_NAME,
];
const SSL_CERT_FILE_NAME = 'cert.pem';
const SSL_KEY_FILE_NAME = 'key.pem';
const COUCHDB_USER = 'medic';
const COUCHDB_PASSWORD = 'password';
const UPGRADE_SERVICE_COMPOSE = `
services:
  ${UPGRADE_SVC_NAME}:
    restart: always
    image: public.ecr.aws/s5s3h4s7/cht-upgrade-service:latest
    volumes:
      - \${DOCKER_HOST:-/var/run/docker.sock}:/var/run/docker.sock
      - chtx-compose-files:/docker-compose
    networks:
      - cht-net
    environment:
      - COUCHDB_USER
      - COUCHDB_PASSWORD
      - COUCHDB_SECRET
      - NGINX_HTTP_PORT
      - NGINX_HTTPS_PORT
      - CHT_COMPOSE_PROJECT_NAME
      - CHT_NETWORK
networks:
  cht-net:
    name: \${CHT_NETWORK}
volumes:
  chtx-compose-files:
    labels:
      - "${CHTX_LABEL_NAME}=\${CHT_COMPOSE_PROJECT_NAME}"
`;
const NOUVEAU_SERVICE_OVERRIDE = `
  nouveau:
    # Not used - only here to appease config validation
    build: { context: . }
    volumes:
      - cht-nouveau-data:/data/nouveau
`;
const getLocalVolumeConfig = (subDirectory) => (devicePath) => `
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${devicePath}/${subDirectory}`;
const getVolumeConfig = (subDirectory) => (localVolumePath) => localVolumePath.pipe(Option.map(getLocalVolumeConfig(subDirectory)), Option.getOrElse(() => ''));
const SUB_DIR_CREDENTIALS = 'credentials';
const SUB_DIR_COUCHDB = 'couchdb';
const SUB_DIR_NOUVEAU = 'nouveau';
// The contents of this file have to pass `docker compose config` validation
const getChtxComposeOverride = (localVolumePath) => (nouveauOverride) => `
services:
  couchdb:
    # Not used - only here to appease config validation
    build: { context: . }
    volumes:
      - cht-credentials:/opt/couchdb/etc/local.d/
      - cht-couchdb-data:/opt/couchdb/data
${nouveauOverride.pipe(Option.getOrElse(() => ''))}
volumes:
  cht-credentials:${localVolumePath.pipe(getVolumeConfig(SUB_DIR_CREDENTIALS))}
  cht-couchdb-data:${localVolumePath.pipe(getVolumeConfig(SUB_DIR_COUCHDB))}
  cht-nouveau-data:${localVolumePath.pipe(getVolumeConfig(SUB_DIR_NOUVEAU))}
`;
const SSL_URL_DICT = {
    'local-ip': [
        [SSL_CERT_FILE_NAME, 'https://local-ip.medicmobile.org/fullchain'],
        [SSL_KEY_FILE_NAME, 'https://local-ip.medicmobile.org/key'],
    ],
    expired: [
        [
            SSL_CERT_FILE_NAME,
            'https://raw.githubusercontent.com/medic/cht-core/refs/heads/master/scripts/tls_certificates/local-ip-expired.crt'
        ],
        [
            SSL_KEY_FILE_NAME,
            'https://raw.githubusercontent.com/medic/cht-core/refs/heads/master/scripts/tls_certificates/local-ip-expired.key'
        ]
    ],
    'self-signed': [
        [
            SSL_CERT_FILE_NAME,
            'https://raw.githubusercontent.com/medic/cht-core/refs/heads/master/scripts/tls_certificates/self-signed.crt'
        ],
        [
            SSL_KEY_FILE_NAME,
            'https://raw.githubusercontent.com/medic/cht-core/refs/heads/master/scripts/tls_certificates/self-signed.key'
        ],
    ],
};
class ChtInstanceConfig extends Schema.Class('ChtInstanceConfig')({
    CHT_COMPOSE_PROJECT_NAME: Schema.NonEmptyString,
    CHT_NETWORK: Schema.NonEmptyString,
    COUCHDB_PASSWORD: Schema.NonEmptyString,
    COUCHDB_SECRET: Schema.NonEmptyString,
    COUCHDB_USER: Schema.NonEmptyString,
    NGINX_HTTP_PORT: Schema.Number,
    NGINX_HTTPS_PORT: Schema.Number,
}) {
    static generate = (instanceName) => getFreePorts()
        .pipe(Effect.map(([NGINX_HTTPS_PORT, NGINX_HTTP_PORT]) => ({
        CHT_COMPOSE_PROJECT_NAME: instanceName,
        CHT_NETWORK: instanceName,
        COUCHDB_PASSWORD,
        COUCHDB_SECRET: crypto
            .randomBytes(16)
            .toString('hex'),
        COUCHDB_USER,
        NGINX_HTTP_PORT,
        NGINX_HTTPS_PORT,
    })), Effect.flatMap(Schema.decodeUnknown(ChtInstanceConfig)));
    static asRecord = (config) => config;
}
const upgradeSvcProjectName = (instanceName) => `${instanceName}-up`;
const makeDir = (dirPath) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.makeDirectory(dirPath, { recursive: true })));
const createLocalVolumeDirs = (localVolumePath) => localVolumePath.pipe(Option.map(path => pipe(Array.make(SUB_DIR_CREDENTIALS, SUB_DIR_COUCHDB, SUB_DIR_NOUVEAU), Array.map(subDir => `${path}/${subDir}`), Array.map(makeDir), Effect.all)), Option.getOrElse(() => Effect.void));
const chtComposeUrl = (version, fileName) => `https://staging.dev.medicmobile.org/_couch/builds_4/medic%3Amedic%3A${version}/docker-compose/${fileName}`;
const writeUpgradeServiceCompose = (dirPath) => pipe(UPGRADE_SERVICE_COMPOSE, writeFile(`${dirPath}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`));
const getNouveauOverride = (dirPath) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.readFileString(`${dirPath}/${CHT_COUCHDB_COMPOSE_FILE_NAME}`)), Effect.map(String.includes('nouveau:')), Effect.map(includeNouveau => Option.liftPredicate(NOUVEAU_SERVICE_OVERRIDE, () => includeNouveau)));
const writeChtxOverrideCompose = (dirPath, localVolumePath) => getNouveauOverride(dirPath)
    .pipe(Effect.map(getChtxComposeOverride(localVolumePath)), Effect.flatMap(writeFile(`${dirPath}/${CHTX_COMPOSE_OVERRIDE_FILE_NAME}`)));
const writeChtCompose = (dirPath, version) => (fileName) => pipe(chtComposeUrl(version, fileName), getRemoteFile, Effect.flatMap(writeFile(`${dirPath}/${fileName}`)));
const writeComposeFiles = (dirPath, version, localVolumePath) => pipe(CHT_COMPOSE_FILE_NAMES, Array.map(writeChtCompose(dirPath, version)), Array.append(writeUpgradeServiceCompose(dirPath)), Array.append(writeChtxOverrideCompose(dirPath, localVolumePath)), Effect.all);
const writeSSLFiles = (sslType) => (dirPath) => pipe(SSL_URL_DICT[sslType], Array.map(([name, url]) => getRemoteFile(url)
    .pipe(Effect.flatMap(writeFile(`${dirPath}/${name}`)))), Effect.all);
const doesUpgradeServiceExist = (instanceName) => pipe(upgradeSvcProjectName(instanceName), getContainersForComposeProject, Effect.map(Array.isNonEmptyArray));
const doesChtxVolumeExist = (instanceName) => doesVolumeExistWithLabel(`${CHTX_LABEL_NAME}=${instanceName}`);
const assertChtxVolumeDoesNotExist = (instanceName) => doesChtxVolumeExist(instanceName)
    .pipe(Effect.filterOrFail(exists => !exists, () => new Error(`Instance ${instanceName} already exists`)));
const assertChtxVolumeExists = (instanceName) => doesChtxVolumeExist(instanceName)
    .pipe(Effect.filterOrFail(exists => exists, () => new Error(`Instance ${instanceName} does not exist`)));
const pullAllChtImages = (instanceName, env, tmpDir) => pipe([...CHT_COMPOSE_FILE_NAMES, UPGRADE_SVC_COMPOSE_FILE_NAME, CHTX_COMPOSE_OVERRIDE_FILE_NAME], Array.map(fileName => `${tmpDir}/${fileName}`), pullComposeImages(instanceName, ChtInstanceConfig.asRecord(env)), 
// Log the output of the docker pull because this could take a very long time
Logger.withMinimumLogLevel(LogLevel.Debug));
const createUpgradeSvcContainer = (instanceName, env, tmpDir) => pipe(upgradeSvcProjectName(instanceName), createComposeContainers(env, `${tmpDir}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`));
const rmTempUpgradeServiceContainer = (instanceName) => pipe(upgradeSvcProjectName(instanceName), rmComposeContainer(UPGRADE_SVC_NAME), Effect.catchAll(() => Effect.void));
const copyFilesToUpgradeSvcContainer = (instanceName, tmpDir) => pipe([...CHT_COMPOSE_FILE_NAMES, CHTX_COMPOSE_OVERRIDE_FILE_NAME, ENV_FILE_NAME], Array.map((fileName) => [`${tmpDir}/${fileName}`, `/docker-compose/${fileName}`]), Array.map(copyFileToComposeContainer(upgradeSvcProjectName(instanceName), UPGRADE_SVC_NAME)), Effect.all);
const copySSLFilesToNginxContainer = (instanceName) => (tmpDir) => pipe([SSL_CERT_FILE_NAME, SSL_KEY_FILE_NAME], Array.map((fileName) => [`${tmpDir}/${fileName}`, `/etc/nginx/private/${fileName}`]), Array.map(copyFileToComposeContainer(instanceName, NGINX_SVC_NAME)), Effect.all);
const copyEnvFileFromUpgradeSvcContainer = (instanceName, tmpDir) => pipe(upgradeSvcProjectName(instanceName), copyFileFromComposeContainer(UPGRADE_SVC_NAME, `/docker-compose/${ENV_FILE_NAME}`, `${tmpDir}/${ENV_FILE_NAME}`));
const copyEnvFileFromDanglingVolume = (tempDir, instanceName) => Effect
    .acquireUseRelease(writeUpgradeServiceCompose(tempDir)
    .pipe(Effect.andThen(createUpgradeSvcContainer(instanceName, {}, tempDir))), () => copyEnvFileFromUpgradeSvcContainer(instanceName, tempDir), () => rmTempUpgradeServiceContainer(instanceName))
    .pipe(Effect.scoped);
const getEnvarFromUpgradeSvcContainer = (instanceName, envar) => pipe(upgradeSvcProjectName(instanceName), serviceName => getEnvarFromComposeContainer(UPGRADE_SVC_NAME, envar, serviceName));
const getPortForInstance = (instanceName) => pipe(getEnvarFromUpgradeSvcContainer(instanceName, 'NGINX_HTTPS_PORT'), Effect.map(Number.parseInt), Effect.flatMap(value => Match
    .value(value)
    .pipe(Match.when(Number.isInteger, () => Effect.succeed(value.toString())), Match.orElse(() => Effect.fail(new Error(`Could not get port for instance ${instanceName}`))))));
const getInstanceStatus = (instanceName) => Effect
    .all([
    getContainersForComposeProject(instanceName, 'running'),
    getContainersForComposeProject(instanceName, 'exited', 'created', 'paused', 'restarting', 'removing', 'dead'),
])
    .pipe(Effect.map(Array.map(Array.isNonEmptyArray)), Effect.map(Match.value), Effect.map(Match.when([true, false], () => 'running')), Effect.map(Match.orElse(() => 'stopped')));
const getLocalChtInstanceInfo = (instanceName) => Effect
    .all([
    getInstanceStatus(instanceName),
    getEnvarFromUpgradeSvcContainer(instanceName, 'COUCHDB_USER'),
    getEnvarFromUpgradeSvcContainer(instanceName, 'COUCHDB_PASSWORD'),
    getPortForInstance(instanceName).pipe(Effect.catchAll(() => Effect.succeed(null))),
])
    .pipe(Effect.map(([status, username, password, port]) => ({
    name: instanceName,
    username,
    password: Redacted.make(password),
    status,
    port: Option.fromNullable(port)
})));
const waitForInstance = (port) => HttpClient.HttpClient.pipe(Effect.map(filterStatusOk), Effect.tap(Effect.logDebug(`Checking if local instance is up on port ${port}`)), Effect.flatMap(client => client.execute(HttpClientRequest.get(`https://localhost:${port}/api/info`))), Effect.retry({
    times: 180,
    schedule: Schedule.spaced(1000),
}), Effect.scoped);
const createUpgradeServiceFromDanglingVolume = (projectName) => () => createTmpDir()
    .pipe(Effect.flatMap(tmpDir => copyEnvFileFromDanglingVolume(tmpDir, projectName)
    .pipe(Effect.andThen(readJsonFile(ENV_FILE_NAME, tmpDir)), Effect.flatMap(Schema.decodeUnknown(ChtInstanceConfig)), Effect.flatMap(env => createUpgradeSvcContainer(projectName, ChtInstanceConfig.asRecord(env), tmpDir)))), Effect.scoped);
const ensureUpgradeServiceExists = (projectName) => assertChtxVolumeExists(projectName)
    .pipe(Effect.filterEffectOrElse({
    predicate: () => doesUpgradeServiceExist(projectName),
    orElse: createUpgradeServiceFromDanglingVolume(projectName),
}));
const serviceContext = Effect
    .all([
    HttpClient.HttpClient,
    FileSystem.FileSystem,
    CommandExecutor,
])
    .pipe(Effect.map(([httpClient, fileSystem, executor,]) => Context
    .make(HttpClient.HttpClient, httpClient)
    .pipe(Context.add(FileSystem.FileSystem, fileSystem), Context.add(CommandExecutor, executor))));
export class LocalInstanceService extends Effect.Service()('chtoolbox/LocalInstanceService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        create: (instanceName, version, localVolumePath) => assertChtxVolumeDoesNotExist(instanceName)
            .pipe(Effect.andThen(Effect.all([
            ChtInstanceConfig.generate(instanceName),
            createTmpDir(),
        ])), Effect.flatMap(([env, tmpDir]) => Effect
            .all([
            createLocalVolumeDirs(localVolumePath),
            writeComposeFiles(tmpDir, version, localVolumePath),
            writeJsonFile(`${tmpDir}/${ENV_FILE_NAME}`, env),
        ])
            .pipe(Effect.andThen(pullAllChtImages(instanceName, env, tmpDir)), Effect.andThen(createUpgradeSvcContainer(instanceName, ChtInstanceConfig.asRecord(env), tmpDir)), Effect.andThen(copyFilesToUpgradeSvcContainer(instanceName, tmpDir)))), Effect.mapError(x => x), Effect.scoped, Effect.provide(context)),
        start: (instanceName) => ensureUpgradeServiceExists(instanceName)
            .pipe(Effect.andThen(restartCompose(upgradeSvcProjectName(instanceName))), Effect.andThen(getLocalChtInstanceInfo(instanceName)), Effect.tap(({ port }) => port.pipe(Option.getOrThrow, waitForInstance)), 
        // Get status again after instance started
        Effect.flatMap(instanceData => getInstanceStatus(instanceName).pipe(Effect.map(status => ({
            ...instanceData,
            status,
        })))), Effect.mapError(x => x), Effect.provide(context)),
        stop: (instanceName) => assertChtxVolumeExists(instanceName)
            .pipe(Effect.andThen(Effect.all([
            stopCompose(instanceName),
            stopCompose(upgradeSvcProjectName(instanceName))
        ])), Effect.mapError(x => x), Effect.provide(context)),
        rm: (instanceName) => Effect
            .all([
            destroyCompose(instanceName),
            destroyCompose(upgradeSvcProjectName(instanceName)),
        ])
            .pipe(Effect.mapError(x => x), Effect.provide(context)),
        setSSLCerts: (instanceName, sslType) => ensureUpgradeServiceExists(instanceName)
            .pipe(Effect.andThen(startCompose(upgradeSvcProjectName(instanceName))), Effect.andThen(getPortForInstance(instanceName)), Effect.tap(waitForInstance), Effect.andThen(createTmpDir()), Effect.tap(writeSSLFiles(sslType)), Effect.flatMap(copySSLFilesToNginxContainer(instanceName)), Effect.andThen(restartComposeService(instanceName, NGINX_SVC_NAME)), Effect.mapError(x => x), Effect.provide(context), Effect.scoped),
        ls: () => getVolumeNamesWithLabel(CHTX_LABEL_NAME)
            .pipe(Effect.map(Array.map(getVolumeLabelValue(CHTX_LABEL_NAME))), Effect.flatMap(Effect.all), Effect.map(Array.map(getLocalChtInstanceInfo)), Effect.flatMap(Effect.all), Effect.mapError(x => x), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
//# sourceMappingURL=local-instance.js.map