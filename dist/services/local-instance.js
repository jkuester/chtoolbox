"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalInstanceService = void 0;
const effect_1 = require("effect");
const Context = __importStar(require("effect/Context"));
const platform_1 = require("@effect/platform");
const crypto_1 = __importDefault(require("crypto"));
const file_1 = require("../libs/file");
const docker_1 = require("../libs/docker");
const CommandExecutor_1 = require("@effect/platform/CommandExecutor");
const local_network_1 = require("../libs/local-network");
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
    name: CHT_NETWORK
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
class ChtInstanceConfig extends effect_1.Schema.Class('ChtInstanceConfig')({
    CHT_COMPOSE_PROJECT_NAME: effect_1.Schema.NonEmptyString,
    CHT_NETWORK: effect_1.Schema.NonEmptyString,
    COUCHDB_DATA: effect_1.Schema.Literal('cht-credentials'),
    COUCHDB_PASSWORD: effect_1.Schema.NonEmptyString,
    COUCHDB_SECRET: effect_1.Schema.NonEmptyString,
    COUCHDB_USER: effect_1.Schema.NonEmptyString,
    NGINX_HTTP_PORT: effect_1.Schema.Number,
    NGINX_HTTPS_PORT: effect_1.Schema.Number,
}) {
    static generate = (instanceName) => (0, local_network_1.getFreePorts)()
        .pipe(effect_1.Effect.map(([NGINX_HTTPS_PORT, NGINX_HTTP_PORT]) => ({
        CHT_COMPOSE_PROJECT_NAME: instanceName,
        CHT_NETWORK: instanceName,
        COUCHDB_DATA,
        COUCHDB_PASSWORD,
        COUCHDB_SECRET: crypto_1.default
            .randomBytes(16)
            .toString('hex'),
        COUCHDB_USER,
        NGINX_HTTP_PORT,
        NGINX_HTTPS_PORT,
    })), effect_1.Effect.flatMap(effect_1.Schema.decodeUnknown(ChtInstanceConfig)));
    static asRecord = (config) => config;
}
const upgradeSvcProjectName = (instanceName) => `${instanceName}-up`;
const chtComposeUrl = (version, fileName) => `https://staging.dev.medicmobile.org/_couch/builds_4/medic%3Amedic%3A${version}/docker-compose/${fileName}`;
const writeUpgradeServiceCompose = (dirPath) => (0, effect_1.pipe)(UPGRADE_SERVICE_COMPOSE, (0, file_1.writeFile)(`${dirPath}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`));
const writeChtCompose = (dirPath, version) => (fileName) => (0, effect_1.pipe)(chtComposeUrl(version, fileName), file_1.getRemoteFile, effect_1.Effect.flatMap((0, file_1.writeFile)(`${dirPath}/${fileName}`)));
const writeComposeFiles = (dirPath, version) => (0, effect_1.pipe)(CHT_COMPOSE_FILE_NAMES, effect_1.Array.map(writeChtCompose(dirPath, version)), effect_1.Array.append(writeUpgradeServiceCompose(dirPath)), effect_1.Effect.all);
const writeSSLFiles = (sslType) => (dirPath) => (0, effect_1.pipe)(SSL_URL_DICT[sslType], effect_1.Array.map(([name, url]) => (0, file_1.getRemoteFile)(url)
    .pipe(effect_1.Effect.flatMap((0, file_1.writeFile)(`${dirPath}/${name}`)))), effect_1.Effect.all);
const doesUpgradeServiceExist = (instanceName) => (0, effect_1.pipe)(upgradeSvcProjectName(instanceName), docker_1.doesComposeProjectHaveContainers);
const doesChtxVolumeExist = (instanceName) => (0, docker_1.doesVolumeExistWithLabel)(`${CHTX_LABEL_NAME}=${instanceName}`);
const assertChtxVolumeDoesNotExist = (instanceName) => doesChtxVolumeExist(instanceName)
    .pipe(effect_1.Effect.flatMap(exists => effect_1.Match
    .value(exists)
    .pipe(effect_1.Match.when(true, () => effect_1.Effect.fail(new Error(`Instance ${instanceName} already exists`))), effect_1.Match.orElse(() => effect_1.Effect.void))));
const assertChtxVolumeExists = (instanceName) => doesChtxVolumeExist(instanceName)
    .pipe(effect_1.Effect.flatMap(exists => effect_1.Match
    .value(exists)
    .pipe(effect_1.Match.when(false, () => effect_1.Effect.fail(new Error(`Instance ${instanceName} does not exist`))), effect_1.Match.orElse(() => effect_1.Effect.void))));
const pullAllChtImages = (instanceName, env, tmpDir) => (0, effect_1.pipe)([...CHT_COMPOSE_FILE_NAMES, UPGRADE_SVC_COMPOSE_FILE_NAME], effect_1.Array.map(fileName => `${tmpDir}/${fileName}`), (0, docker_1.pullComposeImages)(instanceName, ChtInstanceConfig.asRecord(env)));
const createUpgradeSvcContainer = (instanceName, env, tmpDir) => (0, effect_1.pipe)(upgradeSvcProjectName(instanceName), (0, docker_1.createComposeContainers)(env, `${tmpDir}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`));
const rmTempUpgradeServiceContainer = (instanceName) => (0, effect_1.pipe)(upgradeSvcProjectName(instanceName), (0, docker_1.rmComposeContainer)(UPGRADE_SVC_NAME), effect_1.Effect.catchAll(() => effect_1.Effect.void));
const copyFilesToUpgradeSvcContainer = (instanceName, tmpDir) => (0, effect_1.pipe)([...CHT_COMPOSE_FILE_NAMES, ENV_FILE_NAME], effect_1.Array.map((fileName) => [`${tmpDir}/${fileName}`, `/docker-compose/${fileName}`]), effect_1.Array.map((0, docker_1.copyFileToComposeContainer)(upgradeSvcProjectName(instanceName), UPGRADE_SVC_NAME)), effect_1.Effect.all);
const copySSLFilesToNginxContainer = (instanceName) => (tmpDir) => (0, effect_1.pipe)([SSL_CERT_FILE_NAME, SSL_KEY_FILE_NAME], effect_1.Array.map((fileName) => [`${tmpDir}/${fileName}`, `/etc/nginx/private/${fileName}`]), effect_1.Array.map((0, docker_1.copyFileToComposeContainer)(instanceName, NGINX_SVC_NAME)), effect_1.Effect.all);
const copyEnvFileFromUpgradeSvcContainer = (instanceName, tmpDir) => (0, effect_1.pipe)(upgradeSvcProjectName(instanceName), (0, docker_1.copyFileFromComposeContainer)(UPGRADE_SVC_NAME, `/docker-compose/${ENV_FILE_NAME}`, `${tmpDir}/${ENV_FILE_NAME}`));
const copyEnvFileFromDanglingVolume = (tempDir, instanceName) => effect_1.Effect
    .acquireUseRelease(writeUpgradeServiceCompose(tempDir)
    .pipe(effect_1.Effect.andThen(createUpgradeSvcContainer(instanceName, {}, tempDir))), () => copyEnvFileFromUpgradeSvcContainer(instanceName, tempDir), () => rmTempUpgradeServiceContainer(instanceName))
    .pipe(effect_1.Effect.scoped);
const getPortForInstance = (instanceName) => (0, effect_1.pipe)(upgradeSvcProjectName(instanceName), (0, docker_1.getEnvarFromComposeContainer)(UPGRADE_SVC_NAME, 'NGINX_HTTPS_PORT'), effect_1.Effect.map(Number.parseInt), effect_1.Effect.flatMap(value => effect_1.Match
    .value(value)
    .pipe(effect_1.Match.when(Number.isInteger, () => effect_1.Effect.succeed(value.toString())), effect_1.Match.orElse(() => effect_1.Effect.fail(new Error(`Could not get port for instance ${instanceName}`))))));
const waitForInstance = (port) => platform_1.HttpClient.HttpClient.pipe(effect_1.Effect.map(platform_1.HttpClient.filterStatusOk), effect_1.Effect.tap(effect_1.Effect.logDebug(`Checking if local instance is up on port ${port}`)), effect_1.Effect.flatMap(client => client.execute(platform_1.HttpClientRequest.get(`https://localhost:${port}/api/info`))), effect_1.Effect.retry({
    times: 180,
    schedule: effect_1.Schedule.spaced(1000),
}), effect_1.Effect.scoped);
const createUpgradeServiceFromDanglingVolume = (projectName) => () => (0, file_1.createTmpDir)()
    .pipe(effect_1.Effect.flatMap(tmpDir => copyEnvFileFromDanglingVolume(tmpDir, projectName)
    .pipe(effect_1.Effect.andThen((0, file_1.readJsonFile)(ENV_FILE_NAME, tmpDir)), effect_1.Effect.flatMap(effect_1.Schema.decodeUnknown(ChtInstanceConfig)), effect_1.Effect.flatMap(env => createUpgradeSvcContainer(projectName, ChtInstanceConfig.asRecord(env), tmpDir)))), effect_1.Effect.scoped);
const ensureUpgradeServiceExists = (projectName) => assertChtxVolumeExists(projectName)
    .pipe(effect_1.Effect.andThen(doesUpgradeServiceExist(projectName)), effect_1.Effect.flatMap(exists => effect_1.Match
    .value(exists)
    .pipe(effect_1.Match.when(true, () => effect_1.Effect.void), effect_1.Match.orElse(createUpgradeServiceFromDanglingVolume(projectName)))));
const serviceContext = effect_1.Effect
    .all([
    platform_1.HttpClient.HttpClient,
    platform_1.FileSystem.FileSystem,
    CommandExecutor_1.CommandExecutor,
])
    .pipe(effect_1.Effect.map(([httpClient, fileSystem, executor,]) => Context
    .make(platform_1.HttpClient.HttpClient, httpClient)
    .pipe(Context.add(platform_1.FileSystem.FileSystem, fileSystem), Context.add(CommandExecutor_1.CommandExecutor, executor))));
class LocalInstanceService extends effect_1.Effect.Service()('chtoolbox/LocalInstanceService', {
    effect: serviceContext.pipe(effect_1.Effect.map(context => ({
        create: (instanceName, version) => assertChtxVolumeDoesNotExist(instanceName)
            .pipe(effect_1.Effect.andThen(effect_1.Effect.all([
            ChtInstanceConfig.generate(instanceName),
            (0, file_1.createTmpDir)(),
        ])), effect_1.Effect.flatMap(([env, tmpDir]) => effect_1.Effect
            .all([
            writeComposeFiles(tmpDir, version),
            (0, file_1.writeJsonFile)(`${tmpDir}/${ENV_FILE_NAME}`, env),
        ])
            .pipe(effect_1.Effect.andThen(pullAllChtImages(instanceName, env, tmpDir)), effect_1.Effect.andThen(createUpgradeSvcContainer(instanceName, ChtInstanceConfig.asRecord(env), tmpDir)), effect_1.Effect.andThen(copyFilesToUpgradeSvcContainer(instanceName, tmpDir)))), effect_1.Effect.mapError(x => x), effect_1.Effect.scoped, effect_1.Effect.provide(context)),
        start: (instanceName) => ensureUpgradeServiceExists(instanceName)
            .pipe(effect_1.Effect.andThen((0, docker_1.restartCompose)(upgradeSvcProjectName(instanceName))), effect_1.Effect.andThen(getPortForInstance(instanceName)), effect_1.Effect.tap(waitForInstance), effect_1.Effect.mapError(x => x), effect_1.Effect.provide(context)),
        stop: (instanceName) => assertChtxVolumeExists(instanceName)
            .pipe(effect_1.Effect.andThen(effect_1.Effect.all([
            (0, docker_1.stopCompose)(instanceName),
            (0, docker_1.stopCompose)(upgradeSvcProjectName(instanceName))
        ])), effect_1.Effect.mapError(x => x), effect_1.Effect.provide(context)),
        rm: (instanceName) => effect_1.Effect
            .all([
            (0, docker_1.destroyCompose)(instanceName),
            (0, docker_1.destroyCompose)(upgradeSvcProjectName(instanceName)),
        ])
            .pipe(effect_1.Effect.mapError(x => x), effect_1.Effect.provide(context)),
        setSSLCerts: (instanceName, sslType) => ensureUpgradeServiceExists(instanceName)
            .pipe(effect_1.Effect.andThen((0, docker_1.startCompose)(upgradeSvcProjectName(instanceName))), effect_1.Effect.andThen(getPortForInstance(instanceName)), effect_1.Effect.tap(waitForInstance), effect_1.Effect.andThen((0, file_1.createTmpDir)()), effect_1.Effect.tap(writeSSLFiles(sslType)), effect_1.Effect.flatMap(copySSLFilesToNginxContainer(instanceName)), effect_1.Effect.andThen((0, docker_1.restartComposeService)(instanceName, NGINX_SVC_NAME)), effect_1.Effect.mapError(x => x), effect_1.Effect.provide(context), effect_1.Effect.scoped),
        ls: () => (0, docker_1.getVolumeNamesWithLabel)(CHTX_LABEL_NAME)
            .pipe(effect_1.Effect.map(effect_1.Array.map((0, docker_1.getVolumeLabelValue)(CHTX_LABEL_NAME))), effect_1.Effect.flatMap(effect_1.Effect.all), effect_1.Effect.mapError(x => x), effect_1.Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.LocalInstanceService = LocalInstanceService;
//# sourceMappingURL=local-instance.js.map