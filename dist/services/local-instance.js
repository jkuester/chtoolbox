import { Array, Effect, Logger, LogLevel, Match, Option, pipe, Redacted, Schedule, Schema, String } from 'effect';
import * as Context from 'effect/Context';
import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import crypto from 'crypto';
import { createDir, createTmpDir, getRemoteFile, isDirectoryEmpty, readJsonFile, writeEnvFile, writeFile, writeJsonFile } from "../libs/file.js";
import { copyFileFromComposeContainer, copyFileToComposeContainer, createComposeContainers, destroyCompose, doesVolumeExistWithLabel, getContainersForComposeProject, getEnvarFromComposeContainer, getVolumeLabelValue, getVolumeNamesWithLabel, pullComposeImages, restartCompose, restartComposeService, rmComposeContainer, startCompose, stopCompose } from "../libs/docker.js";
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { getFreePorts } from "../libs/local-network.js";
import { filterStatusOk } from '@effect/platform/HttpClient';
import { PlatformError } from '@effect/platform/Error';
const CHTX_LABEL_NAME = 'chtx.instance';
const UPGRADE_SVC_NAME = 'cht-upgrade-service';
const NGINX_SVC_NAME = 'nginx';
const ENV_FILE_NAME = '.env';
const ENV_JSON_FILE_NAME = 'env.json';
const UPGRADE_SVC_COMPOSE_FILE_NAME = 'compose.yaml';
const CHTX_COMPOSE_OVERRIDE_FILE_NAME = 'chtx-override.yaml';
const CHT_COUCHDB_COMPOSE_FILE_NAME = 'cht-couchdb.yml';
const CHT_COMPOSE_FILE_NAMES = [
    'cht-core.yml',
    CHT_COUCHDB_COMPOSE_FILE_NAME,
];
const SSL_CERT_FILE_NAME = 'cert.pem';
const SSL_KEY_FILE_NAME = 'key.pem';
const COUCHDB_USER = 'medic';
const COUCHDB_PASSWORD = 'password';
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
const SUB_DIR_DOCKER_COMPOSE = 'docker-compose';
const getUpgradeServiceCompose = (localVolumePath) => `
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
  chtx-compose-files:${localVolumePath.pipe(getVolumeConfig(SUB_DIR_DOCKER_COMPOSE))}
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
    CHT_COMPOSE_PROJECT_NAME: Schema.NonEmptyTrimmedString,
    CHT_NETWORK: Schema.NonEmptyTrimmedString,
    COMPOSE_PROJECT_NAME: Schema.NonEmptyTrimmedString,
    COUCHDB_PASSWORD: Schema.NonEmptyTrimmedString,
    COUCHDB_SECRET: Schema.NonEmptyTrimmedString,
    COUCHDB_USER: Schema.NonEmptyTrimmedString,
    NGINX_HTTP_PORT: Schema.Number,
    NGINX_HTTPS_PORT: Schema.Number,
}) {
    static generate = Effect.fn((instanceName) => getFreePorts()
        .pipe(Effect.map(([NGINX_HTTPS_PORT, NGINX_HTTP_PORT]) => ({
        CHT_COMPOSE_PROJECT_NAME: instanceName,
        CHT_NETWORK: instanceName,
        COMPOSE_PROJECT_NAME: upgradeSvcProjectName(instanceName),
        COUCHDB_PASSWORD,
        COUCHDB_SECRET: crypto
            .randomBytes(16)
            .toString('hex'),
        COUCHDB_USER,
        NGINX_HTTP_PORT,
        NGINX_HTTPS_PORT,
    })), Effect.flatMap(Schema.decodeUnknown(ChtInstanceConfig))));
    static asRecord = (config) => config;
}
const upgradeSvcProjectName = (instanceName) => `${instanceName}-up`;
const assertLocalVolumeEmpty = Effect.fn((localVolumePath) => isDirectoryEmpty(localVolumePath).pipe(Effect.filterOrFail(isEmpty => isEmpty, () => new Error(`Local directory ${localVolumePath} is not empty.`)), Effect.map(() => localVolumePath)));
const createLocalVolumeDirs = Effect.fn((localVolumePath) => localVolumePath.pipe(Option.map(path => assertLocalVolumeEmpty(path)), Option.map(Effect.flatMap(path => pipe(Array.make(SUB_DIR_CREDENTIALS, SUB_DIR_COUCHDB, SUB_DIR_NOUVEAU, SUB_DIR_DOCKER_COMPOSE), Array.map(subDir => `${path}/${subDir}`), Array.map(createDir), Effect.allWith({ concurrency: 'unbounded' })))), Option.getOrElse(() => Effect.void)));
const chtComposeUrl = (version, fileName) => `https://staging.dev.medicmobile.org/_couch/builds_4/medic%3Amedic%3A${version}/docker-compose/${fileName}`;
const writeUpgradeServiceCompose = Effect.fn((dirPath, localVolumePath) => pipe(getUpgradeServiceCompose(localVolumePath), writeFile(`${localVolumePath.pipe(Option.getOrElse(() => dirPath))}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`)));
const getNouveauOverride = Effect.fn((dirPath) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.readFileString(`${dirPath}/${CHT_COUCHDB_COMPOSE_FILE_NAME}`)), Effect.map(Option.liftPredicate(String.includes('nouveau:'))), Effect.map(Option.map(() => NOUVEAU_SERVICE_OVERRIDE))));
const writeChtxOverrideCompose = Effect.fn((dirPath, localVolumePath) => getNouveauOverride(dirPath)
    .pipe(Effect.map(getChtxComposeOverride(localVolumePath)), Effect.flatMap(writeFile(`${dirPath}/${CHTX_COMPOSE_OVERRIDE_FILE_NAME}`))));
const writeChtCompose = (dirPath, version) => Effect.fn((fileName) => pipe(chtComposeUrl(version, fileName), getRemoteFile, Effect.flatMap(writeFile(`${dirPath}/${fileName}`))));
const writeComposeFiles = Effect.fn((dirPath, version, localVolumePath) => pipe(CHT_COMPOSE_FILE_NAMES, Array.map(writeChtCompose(dirPath, version)), Array.append(writeUpgradeServiceCompose(dirPath, localVolumePath)), Array.append(writeChtxOverrideCompose(dirPath, localVolumePath)), Effect.all));
const writeConfigFile = Effect.fn((tmpDir, localVolumePath, env) => localVolumePath.pipe(
// Write .env file when mapping to local dir. Not used by chtx, but useful for directly manipulating compose files.
Option.map(dir => writeEnvFile(`${dir}/${ENV_FILE_NAME}`, ChtInstanceConfig.asRecord(env))), Option.getOrElse(() => Effect.void), Effect.andThen(writeJsonFile(`${tmpDir}/${ENV_JSON_FILE_NAME}`, env))));
const writeSSLFiles = (sslType) => Effect.fn((dirPath) => pipe(SSL_URL_DICT[sslType], Array.map(([name, url]) => getRemoteFile(url)
    .pipe(Effect.flatMap(writeFile(`${dirPath}/${name}`)))), Effect.allWith({ concurrency: 'unbounded' })));
const doesUpgradeServiceExist = Effect.fn((instanceName) => pipe(upgradeSvcProjectName(instanceName), getContainersForComposeProject, Effect.map(Array.isNonEmptyArray)));
const doesChtxVolumeExist = Effect.fn((instanceName) => doesVolumeExistWithLabel(`${CHTX_LABEL_NAME}=${instanceName}`));
const assertChtxVolumeDoesNotExist = Effect.fn((instanceName) => doesChtxVolumeExist(instanceName)
    .pipe(Effect.filterOrFail(exists => !exists, () => new Error(`Instance ${instanceName} already exists`))));
const assertChtxVolumeExists = Effect.fn((instanceName) => doesChtxVolumeExist(instanceName)
    .pipe(Effect.filterOrFail(exists => exists, () => new Error(`Instance ${instanceName} does not exist`))));
const pullAllChtImages = Effect.fn((instanceName, env, tmpDir, localVolumePath) => pipe([...CHT_COMPOSE_FILE_NAMES, CHTX_COMPOSE_OVERRIDE_FILE_NAME], Array.map(fileName => `${tmpDir}/${fileName}`), Array.append(`${localVolumePath.pipe(Option.getOrElse(() => tmpDir))}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`), pullComposeImages(instanceName, ChtInstanceConfig.asRecord(env)), 
// Log the output of the docker pull because this could take a very long time
Logger.withMinimumLogLevel(LogLevel.Debug)));
const createUpgradeSvcContainer = Effect.fn((instanceName, env, dir) => pipe(upgradeSvcProjectName(instanceName), createComposeContainers(env, `${dir}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`)));
const rmTempUpgradeServiceContainer = Effect.fn((instanceName) => pipe(upgradeSvcProjectName(instanceName), rmComposeContainer(UPGRADE_SVC_NAME), Effect.catchAll(() => Effect.void)));
const copyFilesToUpgradeSvcContainer = Effect.fn((instanceName, tmpDir) => pipe([...CHT_COMPOSE_FILE_NAMES, CHTX_COMPOSE_OVERRIDE_FILE_NAME, ENV_JSON_FILE_NAME], Array.map((fileName) => [`${tmpDir}/${fileName}`, `/docker-compose/${fileName}`]), Array.map(copyFileToComposeContainer(upgradeSvcProjectName(instanceName), UPGRADE_SVC_NAME)), Effect.allWith({ concurrency: 'unbounded' })));
const copySSLFilesToNginxContainer = (instanceName) => Effect.fn((tmpDir) => pipe([SSL_CERT_FILE_NAME, SSL_KEY_FILE_NAME], Array.map((fileName) => [`${tmpDir}/${fileName}`, `/etc/nginx/private/${fileName}`]), Array.map(copyFileToComposeContainer(instanceName, NGINX_SVC_NAME)), Effect.allWith({ concurrency: 'unbounded' })));
const copyEnvFileFromUpgradeSvcContainer = Effect.fn((instanceName, tmpDir) => pipe(upgradeSvcProjectName(instanceName), copyFileFromComposeContainer(UPGRADE_SVC_NAME, `/docker-compose/${ENV_JSON_FILE_NAME}`, `${tmpDir}/${ENV_JSON_FILE_NAME}`)));
const copyEnvFileFromDanglingVolume = Effect.fn((tempDir, instanceName) => Effect
    .acquireUseRelease(writeUpgradeServiceCompose(tempDir, Option.none())
    .pipe(Effect.andThen(createUpgradeSvcContainer(instanceName, {}, tempDir))), () => copyEnvFileFromUpgradeSvcContainer(instanceName, tempDir), () => rmTempUpgradeServiceContainer(instanceName))
    .pipe(Effect.scoped));
const getEnvarFromUpgradeSvcContainer = Effect.fn((instanceName, envar) => pipe(upgradeSvcProjectName(instanceName), serviceName => getEnvarFromComposeContainer(UPGRADE_SVC_NAME, envar, serviceName)));
const getPortForInstance = Effect.fn((instanceName) => pipe(getEnvarFromUpgradeSvcContainer(instanceName, 'NGINX_HTTPS_PORT'), Effect.map(Number.parseInt), Effect.flatMap(value => Match
    .value(value)
    .pipe(Match.when(Number.isInteger, () => Effect.succeed(value.toString())), Match.orElse(() => Effect.fail(new Error(`Could not get port for instance ${instanceName}`)))))));
const getInstanceStatus = Effect.fn((instanceName) => Effect.all([
    getContainersForComposeProject(instanceName, 'running'),
    getContainersForComposeProject(instanceName, 'exited', 'created', 'paused', 'restarting', 'removing', 'dead'),
]), Effect.map(Array.map(Array.isNonEmptyArray)), Effect.map(Match.value), Effect.map(Match.when([true, false], () => 'running')), Effect.map(Match.orElse(() => 'stopped')));
const getLocalChtInstanceInfo = Effect.fn((instanceName) => Effect
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
}))));
const waitForInstance = Effect.fn((port) => HttpClient.HttpClient.pipe(Effect.map(filterStatusOk), Effect.tap(Effect.logDebug(`Checking if local instance is up on port ${port}`)), Effect.flatMap(client => client.execute(HttpClientRequest.get(`https://localhost:${port}/api/info`))), Effect.retry({
    times: 180,
    schedule: Schedule.spaced(1000),
}), Effect.scoped));
const createUpgradeServiceFromLocalVolume = Effect.fn((projectName, localVolumePath) => assertChtxVolumeDoesNotExist(projectName).pipe(Effect.andThen(readJsonFile(ENV_JSON_FILE_NAME, `${localVolumePath}/${SUB_DIR_DOCKER_COMPOSE}`)), Effect.flatMap(Schema.decodeUnknown(ChtInstanceConfig)), Effect.flatMap(env => createUpgradeSvcContainer(projectName, ChtInstanceConfig.asRecord(env), localVolumePath))));
const createUpgradeServiceFromDanglingVolume = (projectName) => Effect.fn(() => createTmpDir()
    .pipe(Effect.flatMap(tmpDir => copyEnvFileFromDanglingVolume(tmpDir, projectName)
    .pipe(Effect.andThen(readJsonFile(ENV_JSON_FILE_NAME, tmpDir)), Effect.flatMap(Schema.decodeUnknown(ChtInstanceConfig)), Effect.flatMap(env => createUpgradeSvcContainer(projectName, ChtInstanceConfig.asRecord(env), tmpDir)))), Effect.scoped));
const ensureUpgradeServiceExists = Effect.fn((projectName, localVolumePath) => localVolumePath.pipe(Option.map(path => createUpgradeServiceFromLocalVolume(projectName, path)), Option.getOrElse(() => assertChtxVolumeExists(projectName).pipe(Effect.filterEffectOrElse({
    predicate: () => doesUpgradeServiceExist(projectName),
    orElse: createUpgradeServiceFromDanglingVolume(projectName),
})))));
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
        create: Effect.fn((instanceName, version, localVolumePath) => assertChtxVolumeDoesNotExist(instanceName)
            .pipe(Effect.andThen(Effect.all([
            ChtInstanceConfig.generate(instanceName),
            createTmpDir(),
            createLocalVolumeDirs(localVolumePath)
        ], { concurrency: 'unbounded' })), Effect.flatMap(([env, tmpDir]) => Effect
            .all([
            writeComposeFiles(tmpDir, version, localVolumePath),
            writeConfigFile(tmpDir, localVolumePath, env),
        ])
            .pipe(Effect.andThen(pullAllChtImages(instanceName, env, tmpDir, localVolumePath)), Effect.andThen(createUpgradeSvcContainer(instanceName, ChtInstanceConfig.asRecord(env), localVolumePath.pipe(Option.getOrElse(() => tmpDir)))), Effect.andThen(copyFilesToUpgradeSvcContainer(instanceName, tmpDir)))), Effect.mapError(x => x), Effect.scoped, Effect.provide(context))),
        start: Effect.fn((instanceName, localVolumePath) => ensureUpgradeServiceExists(instanceName, localVolumePath)
            .pipe(Effect.andThen(restartCompose(upgradeSvcProjectName(instanceName))), Effect.andThen(getLocalChtInstanceInfo(instanceName)), Effect.tap(({ port }) => port.pipe(Option.getOrThrow, waitForInstance)), 
        // Get status again after instance started
        Effect.flatMap(instanceData => getInstanceStatus(instanceName).pipe(Effect.map(status => ({
            ...instanceData,
            status,
        })))), Effect.mapError(x => x), Effect.provide(context))),
        stop: Effect.fn((instanceName) => assertChtxVolumeExists(instanceName)
            .pipe(Effect.andThen(Effect.all([
            stopCompose(instanceName),
            stopCompose(upgradeSvcProjectName(instanceName))
        ], { concurrency: 'unbounded' })), Effect.mapError(x => x), Effect.provide(context))),
        rm: Effect.fn((instanceName) => Effect
            .all([
            destroyCompose(instanceName),
            destroyCompose(upgradeSvcProjectName(instanceName)),
        ])
            .pipe(Effect.mapError(x => x), Effect.provide(context))),
        setSSLCerts: Effect.fn((instanceName, sslType) => ensureUpgradeServiceExists(instanceName, Option.none())
            .pipe(Effect.andThen(startCompose(upgradeSvcProjectName(instanceName))), Effect.andThen(getPortForInstance(instanceName)), Effect.tap(waitForInstance), Effect.andThen(createTmpDir()), Effect.tap(writeSSLFiles(sslType)), Effect.flatMap(copySSLFilesToNginxContainer(instanceName)), Effect.andThen(restartComposeService(instanceName, NGINX_SVC_NAME)), Effect.mapError(x => x), Effect.provide(context), Effect.scoped)),
        ls: Effect.fn(() => getVolumeNamesWithLabel(CHTX_LABEL_NAME)
            .pipe(Effect.map(Array.map(getVolumeLabelValue(CHTX_LABEL_NAME))), Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })), Effect.map(Array.map(getLocalChtInstanceInfo)), Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })), Effect.mapError(x => x), Effect.provide(context))),
    }))),
    accessors: true,
}) {
}
