import { Array, Effect, Logger, LogLevel, Match, Option, pipe, Redacted, Schedule, Schema } from 'effect';
import * as Context from 'effect/Context';
import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import crypto from 'crypto';
import { createTmpDir, getRemoteFile, readJsonFile, writeFile, writeJsonFile, } from '../libs/file.js';
import {
  copyFileFromComposeContainer,
  copyFileToComposeContainer,
  createComposeContainers,
  destroyCompose,
  doesComposeProjectHaveContainers,
  doesVolumeExistWithLabel,
  getEnvarFromComposeContainer,
  getVolumeLabelValue,
  getVolumeNamesWithLabel,
  pullComposeImages,
  restartCompose,
  restartComposeService,
  rmComposeContainer,
  startCompose,
  stopCompose
} from '../libs/docker.js';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { getFreePorts } from '../libs/local-network.js';
import { filterStatusOk } from '@effect/platform/HttpClient';
import { PlatformError } from '@effect/platform/Error';

const CHTX_LABEL_NAME = 'chtx.instance';
const UPGRADE_SVC_NAME = 'cht-upgrade-service';
const NGINX_SVC_NAME = 'nginx';

const ENV_FILE_NAME = 'env.json';
const UPGRADE_SVC_COMPOSE_FILE_NAME = 'docker-compose.yml';
const CHTX_COMPOSE_OVERRIDE_FILE_NAME = 'chtx-override.yml';
const CHT_COMPOSE_FILE_NAMES = [
  'cht-core.yml',
  'cht-couchdb.yml',
];
const SSL_CERT_FILE_NAME = 'cert.pem';
const SSL_KEY_FILE_NAME = 'key.pem';

const COUCHDB_USER = 'medic';
const COUCHDB_PASSWORD = 'password';

const UPGRADE_SERVICE_COMPOSE = `
configs:
  dockerfile_scratch:
    content: FROM tianon/true:latest

services:
  ${UPGRADE_SVC_NAME}:
    restart: always
    image: public.ecr.aws/s5s3h4s7/cht-upgrade-service:latest
    volumes:
      - \${DOCKER_HOST:-/var/run/docker.sock}:/var/run/docker.sock
      - chtx-compose-files:/docker-compose
    configs:
      - source: dockerfile_scratch
        target: /docker-compose/Dockerfile.scratch
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

const getLocalVolumeConfig = (subDirectory: string) => (devicePath: string) => `
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${devicePath}/${subDirectory}`;
const getVolumeConfig = (subDirectory: string) => (localVolumePath: Option.Option<string>) => localVolumePath.pipe(
  Option.map(getLocalVolumeConfig(subDirectory)),
  Option.getOrElse(() => ''),
);

const SUB_DIR_CREDENTIALS = 'credentials';
const SUB_DIR_COUCHDB = 'couchdb';
const SUB_DIR_NOUVEAU = 'nouveau';

// The contents of this file have to pass `docker compose config` validation
const getChtxComposeOverride = (localVolumePath: Option.Option<string>) => `
services:
  couchdb:
    # Not used - only here to appease config validation
    build: { context: . }
    volumes:
      - cht-credentials:/opt/couchdb/etc/local.d/
      - cht-couchdb-data:/opt/couchdb/data
  nouveau:
    # Used when running pre-nouveau instances
    build: { dockerfile: Dockerfile.scratch }
    volumes:
      - cht-nouveau-data:/data/nouveau
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
export type SSLType = keyof typeof SSL_URL_DICT;

class ChtInstanceConfig extends Schema.Class<ChtInstanceConfig>('ChtInstanceConfig')({
  CHT_COMPOSE_PROJECT_NAME: Schema.NonEmptyString,
  CHT_NETWORK: Schema.NonEmptyString,
  COUCHDB_PASSWORD: Schema.NonEmptyString,
  COUCHDB_SECRET: Schema.NonEmptyString,
  COUCHDB_USER: Schema.NonEmptyString,
  NGINX_HTTP_PORT: Schema.Number,
  NGINX_HTTPS_PORT: Schema.Number,
}) {
  static readonly generate = (instanceName: string): Effect.Effect<ChtInstanceConfig, Error> => getFreePorts()
    .pipe(
      Effect.map(([NGINX_HTTPS_PORT, NGINX_HTTP_PORT]) => ({
        CHT_COMPOSE_PROJECT_NAME: instanceName,
        CHT_NETWORK: instanceName,
        COUCHDB_PASSWORD,
        COUCHDB_SECRET: crypto
          .randomBytes(16)
          .toString('hex'),
        COUCHDB_USER,
        NGINX_HTTP_PORT,
        NGINX_HTTPS_PORT,
      })),
      Effect.flatMap(Schema.decodeUnknown(ChtInstanceConfig)),
    );

  static readonly asRecord = (
    config: ChtInstanceConfig
  ): Record<string, string> => config as unknown as Record<string, string>;
}

const upgradeSvcProjectName = (instanceName: string) => `${instanceName}-up`;

const makeDir = (dirPath: string) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.makeDirectory(dirPath, { recursive: true })));
const createLocalVolumeDirs = (localVolumePath: Option.Option<string>) => localVolumePath.pipe(
  Option.map(path => pipe(
    Array.make(SUB_DIR_CREDENTIALS, SUB_DIR_COUCHDB, SUB_DIR_NOUVEAU),
    Array.map(subDir => `${path}/${subDir}`),
    Array.map(makeDir),
    Effect.all,
  )),
  Option.getOrElse(() => Effect.void),
);

const chtComposeUrl = (
  version: string,
  fileName: string
) => `https://staging.dev.medicmobile.org/_couch/builds_4/medic%3Amedic%3A${version}/docker-compose/${fileName}`;

const writeUpgradeServiceCompose = (dirPath: string) => pipe(
  UPGRADE_SERVICE_COMPOSE,
  writeFile(`${dirPath}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`),
);
const writeChtxOverrideCompose = (dirPath: string, localVolumePath: Option.Option<string>) => pipe(
  getChtxComposeOverride(localVolumePath),
  writeFile(`${dirPath}/${CHTX_COMPOSE_OVERRIDE_FILE_NAME}`),
);
const writeChtCompose = (dirPath: string, version: string) => (fileName: string) => pipe(
  chtComposeUrl(version, fileName),
  getRemoteFile,
  Effect.flatMap(writeFile(`${dirPath}/${fileName}`)),
);
const writeComposeFiles = (dirPath: string, version: string, localVolumePath: Option.Option<string>) => pipe(
  CHT_COMPOSE_FILE_NAMES,
  Array.map(writeChtCompose(dirPath, version)),
  Array.append(writeUpgradeServiceCompose(dirPath)),
  Array.append(writeChtxOverrideCompose(dirPath, localVolumePath)),
  Effect.all,
);
const writeSSLFiles = (sslType: SSLType) => (dirPath: string) => pipe(
  SSL_URL_DICT[sslType],
  Array.map(([name, url]) => getRemoteFile(url)
    .pipe(Effect.flatMap(writeFile(`${dirPath}/${name}`)))),
  Effect.all,
);

const doesUpgradeServiceExist = (instanceName: string) => pipe(
  upgradeSvcProjectName(instanceName),
  doesComposeProjectHaveContainers,
);

const doesChtxVolumeExist = (instanceName: string) => doesVolumeExistWithLabel(`${CHTX_LABEL_NAME}=${instanceName}`);
const assertChtxVolumeDoesNotExist = (instanceName: string) => doesChtxVolumeExist(instanceName)
  .pipe(Effect.filterOrFail(
    exists => !exists,
    () => new Error(`Instance ${instanceName} already exists`)
  ));
const assertChtxVolumeExists = (instanceName: string) => doesChtxVolumeExist(instanceName)
  .pipe(Effect.filterOrFail(
    exists => exists,
    () => new Error(`Instance ${instanceName} does not exist`)
  ));

const pullAllChtImages = (instanceName: string, env: ChtInstanceConfig, tmpDir: string) => pipe(
  [...CHT_COMPOSE_FILE_NAMES, UPGRADE_SVC_COMPOSE_FILE_NAME, CHTX_COMPOSE_OVERRIDE_FILE_NAME],
  Array.map(fileName => `${tmpDir}/${fileName}`),
  pullComposeImages(instanceName, ChtInstanceConfig.asRecord(env)),
  // Log the output of the docker pull because this could take a very long time
  Logger.withMinimumLogLevel(LogLevel.Debug)
);

const createUpgradeSvcContainer = (
  instanceName: string,
  env: Record<string, string>,
  tmpDir: string
) => pipe(
  upgradeSvcProjectName(instanceName),
  createComposeContainers(env, `${tmpDir}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`)
);

const rmTempUpgradeServiceContainer = (
  instanceName: string
) => pipe(
  upgradeSvcProjectName(instanceName),
  rmComposeContainer(UPGRADE_SVC_NAME),
  Effect.catchAll(() => Effect.void)
);

const copyFilesToUpgradeSvcContainer = (instanceName: string, tmpDir: string) => pipe(
  [...CHT_COMPOSE_FILE_NAMES, CHTX_COMPOSE_OVERRIDE_FILE_NAME, ENV_FILE_NAME],
  Array.map((fileName): [string, string] => [`${tmpDir}/${fileName}`, `/docker-compose/${fileName}`]),
  Array.map(copyFileToComposeContainer(upgradeSvcProjectName(instanceName), UPGRADE_SVC_NAME)),
  Effect.all,
);
const copySSLFilesToNginxContainer = (instanceName: string) => (tmpDir: string) => pipe(
  [SSL_CERT_FILE_NAME, SSL_KEY_FILE_NAME],
  Array.map((fileName): [string, string] => [`${tmpDir}/${fileName}`, `/etc/nginx/private/${fileName}`]),
  Array.map(copyFileToComposeContainer(instanceName, NGINX_SVC_NAME)),
  Effect.all,
);
const copyEnvFileFromUpgradeSvcContainer = (instanceName: string, tmpDir: string) => pipe(
  upgradeSvcProjectName(instanceName),
  copyFileFromComposeContainer(UPGRADE_SVC_NAME, `/docker-compose/${ENV_FILE_NAME}`, `${tmpDir}/${ENV_FILE_NAME}`),
);
const copyEnvFileFromDanglingVolume = (
  tempDir: string,
  instanceName: string
) => Effect
  .acquireUseRelease(
    writeUpgradeServiceCompose(tempDir)
      .pipe(Effect.andThen(createUpgradeSvcContainer(instanceName, {}, tempDir))),
    () => copyEnvFileFromUpgradeSvcContainer(instanceName, tempDir),
    () => rmTempUpgradeServiceContainer(instanceName)
  )
  .pipe(Effect.scoped);

const getEnvarFromUpgradeSvcContainer = (instanceName: string, envar: string) => pipe(
  upgradeSvcProjectName(instanceName),
  serviceName => getEnvarFromComposeContainer(UPGRADE_SVC_NAME, envar, serviceName),
);

const getPortForInstance = (instanceName: string) => pipe(
  getEnvarFromUpgradeSvcContainer(instanceName, 'NGINX_HTTPS_PORT'),
  Effect.map(Number.parseInt),
  Effect.flatMap(value => Match
    .value(value)
    .pipe(
      Match.when(Number.isInteger, () => Effect.succeed(value.toString() as `${number}`)),
      Match.orElse(() => Effect.fail(new Error(`Could not get port for instance ${instanceName}`))),
    ))
);

const getLocalChtInstanceInfo = (instanceName: string): Effect.Effect<LocalChtInstance, PlatformError, CommandExecutor> => Effect
    .all([
      getEnvarFromUpgradeSvcContainer(instanceName, 'COUCHDB_USER'),
      getEnvarFromUpgradeSvcContainer(instanceName, 'COUCHDB_PASSWORD'),
      getPortForInstance(instanceName).pipe(Effect.catchAll(() => Effect.succeed(null))),
    ])
    .pipe(Effect.map(([username, password, port]) => ({
      name: instanceName,
      username,
      password: Redacted.make(password),
      port: Option.fromNullable(port)
    })));

const waitForInstance = (port: string) => HttpClient.HttpClient.pipe(
  Effect.map(filterStatusOk),
  Effect.tap(Effect.logDebug(`Checking if local instance is up on port ${port}`)),
  Effect.flatMap(client => client.execute(HttpClientRequest.get(`https://localhost:${port}/api/info`))),
  Effect.retry({
    times: 180,
    schedule: Schedule.spaced(1000),
  }),
  Effect.scoped,
);

const createUpgradeServiceFromDanglingVolume = (projectName: string) => () => createTmpDir()
  .pipe(
    Effect.flatMap(tmpDir => copyEnvFileFromDanglingVolume(tmpDir, projectName)
      .pipe(
        Effect.andThen(readJsonFile(ENV_FILE_NAME, tmpDir)),
        Effect.flatMap(Schema.decodeUnknown(ChtInstanceConfig)),
        Effect.flatMap(env => createUpgradeSvcContainer(
          projectName,
          ChtInstanceConfig.asRecord(env),
          tmpDir
        )),
      )),
    Effect.scoped,
  );
const ensureUpgradeServiceExists = (projectName: string) => assertChtxVolumeExists(projectName)
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
  .pipe(Effect.map(([
    httpClient,
    fileSystem,
    executor,
  ]) => Context
    .make(HttpClient.HttpClient, httpClient)
    .pipe(
      Context.add(FileSystem.FileSystem, fileSystem),
      Context.add(CommandExecutor, executor),
    )));

export interface LocalChtInstance {
  name: string,
  username: string,
  password: Redacted.Redacted,
  port: Option.Option<`${number}`>
}

export class LocalInstanceService extends Effect.Service<LocalInstanceService>()('chtoolbox/LocalInstanceService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    create: (
      instanceName: string,
      version: string,
      localVolumePath: Option.Option<string>
    ): Effect.Effect<void, Error> => assertChtxVolumeDoesNotExist(instanceName)
      .pipe(
        Effect.andThen(Effect.all([
          ChtInstanceConfig.generate(instanceName),
          createTmpDir(),
        ])),
        Effect.flatMap(([env, tmpDir]) => Effect
          .all([
            createLocalVolumeDirs(localVolumePath),
            writeComposeFiles(tmpDir, version, localVolumePath),
            writeJsonFile(`${tmpDir}/${ENV_FILE_NAME}`, env),
          ])
          .pipe(
            Effect.andThen(pullAllChtImages(instanceName, env, tmpDir)),
            Effect.andThen(createUpgradeSvcContainer(instanceName, ChtInstanceConfig.asRecord(env), tmpDir)),
            Effect.andThen(copyFilesToUpgradeSvcContainer(instanceName, tmpDir)),
          )),
        Effect.mapError(x => x as Error),
        Effect.scoped,
        Effect.provide(context),
      ),
    start: (
      instanceName: string
    ): Effect.Effect<LocalChtInstance, Error> => ensureUpgradeServiceExists(instanceName)
      .pipe(
        Effect.andThen(restartCompose(upgradeSvcProjectName(instanceName))),
        Effect.andThen(getLocalChtInstanceInfo(instanceName)),
        Effect.tap(({ port }) => port.pipe(
          Option.getOrThrow,
          waitForInstance
        )),
        Effect.mapError(x => x as Error),
        Effect.provide(context),
      ),
    stop: (
      instanceName: string
    ): Effect.Effect<void, Error> => assertChtxVolumeExists(instanceName)
      .pipe(
        Effect.andThen(Effect.all([
          stopCompose(instanceName),
          stopCompose(upgradeSvcProjectName(instanceName))
        ])),
        Effect.mapError(x => x as Error),
        Effect.provide(context),
      ),
    rm: (
      instanceName: string
    ): Effect.Effect<void, Error> => Effect
      .all([
        destroyCompose(instanceName),
        destroyCompose(upgradeSvcProjectName(instanceName)),
      ])
      .pipe(
        Effect.mapError(x => x as Error),
        Effect.provide(context),
      ),
    setSSLCerts: (
      instanceName: string,
      sslType: SSLType
    ): Effect.Effect<void, Error> => ensureUpgradeServiceExists(instanceName)
      .pipe(
        Effect.andThen(startCompose(upgradeSvcProjectName(instanceName))),
        Effect.andThen(getPortForInstance(instanceName)),
        Effect.tap(waitForInstance),
        Effect.andThen(createTmpDir()),
        Effect.tap(writeSSLFiles(sslType)),
        Effect.flatMap(copySSLFilesToNginxContainer(instanceName)),
        Effect.andThen(restartComposeService(instanceName, NGINX_SVC_NAME)),
        Effect.mapError(x => x as Error),
        Effect.provide(context),
        Effect.scoped,
      ),
    ls: (): Effect.Effect<LocalChtInstance[], Error> => getVolumeNamesWithLabel(CHTX_LABEL_NAME)
      .pipe(
        Effect.map(Array.map(getVolumeLabelValue(CHTX_LABEL_NAME))),
        Effect.flatMap(Effect.all),
        Effect.map(Array.map(getLocalChtInstanceInfo)),
        Effect.flatMap(Effect.all),
        Effect.mapError(x => x as unknown as Error),
        Effect.provide(context),
      ),
  }))),
  accessors: true,
}) {
}
