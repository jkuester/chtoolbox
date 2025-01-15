import { Array, Effect, Logger, LogLevel, Match, pipe, Schedule, Schema, Option } from 'effect';
import * as Context from 'effect/Context';
import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import crypto from 'crypto';
import { createTmpDir, getRemoteFile, readJsonFile, writeFile, writeJsonFile, } from '../libs/file.js';
import { copyFileFromComposeContainer, copyFileToComposeContainer, createComposeContainers, destroyCompose, doesComposeProjectHaveContainers, doesVolumeExistWithLabel, getEnvarFromComposeContainer, getVolumeLabelValue, getVolumeNamesWithLabel, pullComposeImages, restartCompose, restartComposeService, rmComposeContainer, startCompose, stopCompose } from '../libs/docker.js';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { getFreePorts } from '../libs/local-network.js';
const CHTX_LABEL_NAME = 'chtx.instance';
const UPGRADE_SVC_NAME = 'cht-upgrade-service';
const NGINX_SVC_NAME = 'nginx';
const ENV_FILE_NAME = 'env.json';
const UPGRADE_SVC_COMPOSE_FILE_NAME = 'docker-compose.yml';
const CHT_COMPOSE_FILE_NAMES = [
    'cht-core.yml',
    'cht-couchdb.yml',
];
const SSL_CERT_FILE_NAME = 'cert.pem';
const SSL_KEY_FILE_NAME = 'key.pem';
const COUCHDB_USER = 'medic';
const COUCHDB_PASSWORD = 'password';
const COUCHDB_DATA = 'cht-credentials'; // This is a hack to put data in named volume instead of mapping it to host
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
      - COUCHDB_DATA
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
    COUCHDB_DATA: Schema.Literal('cht-credentials'),
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
        COUCHDB_DATA,
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
const chtComposeUrl = (version, fileName) => `https://staging.dev.medicmobile.org/_couch/builds_4/medic%3Amedic%3A${version}/docker-compose/${fileName}`;
const writeUpgradeServiceCompose = (dirPath) => pipe(UPGRADE_SERVICE_COMPOSE, writeFile(`${dirPath}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`));
const writeChtCompose = (dirPath, version) => (fileName) => pipe(chtComposeUrl(version, fileName), getRemoteFile, Effect.flatMap(writeFile(`${dirPath}/${fileName}`)));
const writeComposeFiles = (dirPath, version) => pipe(CHT_COMPOSE_FILE_NAMES, Array.map(writeChtCompose(dirPath, version)), Array.append(writeUpgradeServiceCompose(dirPath)), Effect.all);
const writeSSLFiles = (sslType) => (dirPath) => pipe(SSL_URL_DICT[sslType], Array.map(([name, url]) => getRemoteFile(url)
    .pipe(Effect.flatMap(writeFile(`${dirPath}/${name}`)))), Effect.all);
const doesUpgradeServiceExist = (instanceName) => pipe(upgradeSvcProjectName(instanceName), doesComposeProjectHaveContainers);
const doesChtxVolumeExist = (instanceName) => doesVolumeExistWithLabel(`${CHTX_LABEL_NAME}=${instanceName}`);
const assertChtxVolumeDoesNotExist = (instanceName) => doesChtxVolumeExist(instanceName)
    .pipe(Effect.flatMap(exists => Match
    .value(exists)
    .pipe(Match.when(true, () => Effect.fail(new Error(`Instance ${instanceName} already exists`))), Match.orElse(() => Effect.void))));
const assertChtxVolumeExists = (instanceName) => doesChtxVolumeExist(instanceName)
    .pipe(Effect.flatMap(exists => Match
    .value(exists)
    .pipe(Match.when(false, () => Effect.fail(new Error(`Instance ${instanceName} does not exist`))), Match.orElse(() => Effect.void))));
const pullAllChtImages = (instanceName, env, tmpDir) => pipe([...CHT_COMPOSE_FILE_NAMES, UPGRADE_SVC_COMPOSE_FILE_NAME], Array.map(fileName => `${tmpDir}/${fileName}`), pullComposeImages(instanceName, ChtInstanceConfig.asRecord(env)), 
// Log the output of the docker pull because this could take a very long time
Logger.withMinimumLogLevel(LogLevel.Debug));
const createUpgradeSvcContainer = (instanceName, env, tmpDir) => pipe(upgradeSvcProjectName(instanceName), createComposeContainers(env, `${tmpDir}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`));
const rmTempUpgradeServiceContainer = (instanceName) => pipe(upgradeSvcProjectName(instanceName), rmComposeContainer(UPGRADE_SVC_NAME), Effect.catchAll(() => Effect.void));
const copyFilesToUpgradeSvcContainer = (instanceName, tmpDir) => pipe([...CHT_COMPOSE_FILE_NAMES, ENV_FILE_NAME], Array.map((fileName) => [`${tmpDir}/${fileName}`, `/docker-compose/${fileName}`]), Array.map(copyFileToComposeContainer(upgradeSvcProjectName(instanceName), UPGRADE_SVC_NAME)), Effect.all);
const copySSLFilesToNginxContainer = (instanceName) => (tmpDir) => pipe([SSL_CERT_FILE_NAME, SSL_KEY_FILE_NAME], Array.map((fileName) => [`${tmpDir}/${fileName}`, `/etc/nginx/private/${fileName}`]), Array.map(copyFileToComposeContainer(instanceName, NGINX_SVC_NAME)), Effect.all);
const copyEnvFileFromUpgradeSvcContainer = (instanceName, tmpDir) => pipe(upgradeSvcProjectName(instanceName), copyFileFromComposeContainer(UPGRADE_SVC_NAME, `/docker-compose/${ENV_FILE_NAME}`, `${tmpDir}/${ENV_FILE_NAME}`));
const copyEnvFileFromDanglingVolume = (tempDir, instanceName) => Effect
    .acquireUseRelease(writeUpgradeServiceCompose(tempDir)
    .pipe(Effect.andThen(createUpgradeSvcContainer(instanceName, {}, tempDir))), () => copyEnvFileFromUpgradeSvcContainer(instanceName, tempDir), () => rmTempUpgradeServiceContainer(instanceName))
    .pipe(Effect.scoped);
const getPortForInstance = (instanceName) => pipe(upgradeSvcProjectName(instanceName), getEnvarFromComposeContainer(UPGRADE_SVC_NAME, 'NGINX_HTTPS_PORT'), Effect.map(Number.parseInt), Effect.flatMap(value => Match
    .value(value)
    .pipe(Match.when(Number.isInteger, () => Effect.succeed(value.toString())), Match.orElse(() => Effect.fail(new Error(`Could not get port for instance ${instanceName}`))))));
const waitForInstance = (port) => HttpClient.HttpClient.pipe(Effect.map(HttpClient.filterStatusOk), Effect.tap(Effect.logDebug(`Checking if local instance is up on port ${port}`)), Effect.flatMap(client => client.execute(HttpClientRequest.get(`https://localhost:${port}/api/info`))), Effect.retry({
    times: 180,
    schedule: Schedule.spaced(1000),
}), Effect.scoped);
const createUpgradeServiceFromDanglingVolume = (projectName) => () => createTmpDir()
    .pipe(Effect.flatMap(tmpDir => copyEnvFileFromDanglingVolume(tmpDir, projectName)
    .pipe(Effect.andThen(readJsonFile(ENV_FILE_NAME, tmpDir)), Effect.flatMap(Schema.decodeUnknown(ChtInstanceConfig)), Effect.flatMap(env => createUpgradeSvcContainer(projectName, ChtInstanceConfig.asRecord(env), tmpDir)))), Effect.scoped);
const ensureUpgradeServiceExists = (projectName) => assertChtxVolumeExists(projectName)
    .pipe(Effect.andThen(doesUpgradeServiceExist(projectName)), Effect.flatMap(exists => Match
    .value(exists)
    .pipe(Match.when(true, () => Effect.void), Match.orElse(createUpgradeServiceFromDanglingVolume(projectName)))));
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
        create: (instanceName, version) => assertChtxVolumeDoesNotExist(instanceName)
            .pipe(Effect.andThen(Effect.all([
            ChtInstanceConfig.generate(instanceName),
            createTmpDir(),
        ])), Effect.flatMap(([env, tmpDir]) => Effect
            .all([
            writeComposeFiles(tmpDir, version),
            writeJsonFile(`${tmpDir}/${ENV_FILE_NAME}`, env),
        ])
            .pipe(Effect.andThen(pullAllChtImages(instanceName, env, tmpDir)), Effect.andThen(createUpgradeSvcContainer(instanceName, ChtInstanceConfig.asRecord(env), tmpDir)), Effect.andThen(copyFilesToUpgradeSvcContainer(instanceName, tmpDir)))), Effect.mapError(x => x), Effect.scoped, Effect.provide(context)),
        start: (instanceName) => ensureUpgradeServiceExists(instanceName)
            .pipe(Effect.andThen(restartCompose(upgradeSvcProjectName(instanceName))), Effect.andThen(getPortForInstance(instanceName)), Effect.tap(waitForInstance), Effect.mapError(x => x), Effect.provide(context)),
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
            .pipe(Effect.map(Array.map(getVolumeLabelValue(CHTX_LABEL_NAME))), Effect.flatMap(Effect.all), Effect.map(Array.map(name => getPortForInstance(name).pipe(Effect.catchAll(() => Effect.succeed(null)), Effect.map(portVal => ({ name, port: Option.fromNullable(portVal) }))))), Effect.flatMap(Effect.all), Effect.mapError(x => x), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
//# sourceMappingURL=local-instance.js.map