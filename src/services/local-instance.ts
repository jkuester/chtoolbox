import { Array, Effect, Logger, LogLevel, Match, Option, pipe, Redacted, Schedule, Schema, Tuple } from 'effect';
import * as Context from 'effect/Context';
import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import crypto from 'node:crypto';
import { createDir, createTmpDir, getRemoteFile, isDirectoryEmpty, writeEnvFile, writeFile, } from '../libs/file.ts';
import {
  copyFileFromComposeContainer,
  copyFileToComposeContainer,
  createComposeContainers,
  destroyCompose,
  doesVolumeExistWithLabel,
  getContainersForComposeProject,
  getEnvarFromComposeContainer,
  getVolumeLabelValue,
  getVolumeNamesWithLabel,
  pullComposeImages,
  restartCompose,
  restartComposeService,
  rmComposeContainer,
  startCompose,
  stopCompose
} from '../libs/docker.ts';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { freePortsEffect } from '../libs/local-network.ts';
import { filterStatusOk } from '@effect/platform/HttpClient';
import { PlatformError } from '@effect/platform/Error';
import { v4 as uuid } from 'uuid';
import { mapErrorToGeneric } from '../libs/core.ts';

const CHTX_LABEL_NAME = 'chtx.instance';
const UPGRADE_SVC_NAME = 'cht-upgrade-service';
const CHTX_COMPOSE_FILES_VOLUME_NAME = 'chtx-compose-files';
const NGINX_SVC_NAME = 'nginx';

const ENV_FILE_NAME = '.env';
const UPGRADE_SVC_COMPOSE_FILE_NAME = 'docker-compose.yml';
const CHTX_COMPOSE_OVERRIDE_FILE_NAME = 'chtx-override.yml';
const UPGRADE_SVC_COMPOSE_OVERRIDE_FILE_NAME = 'compose.override.yml';
const CHT_COUCHDB_COMPOSE_FILE_NAME = 'cht-couchdb.yml';
const CHT_COMPOSE_FILE_NAMES = [
  'cht-core.yml',
  CHT_COUCHDB_COMPOSE_FILE_NAME,
];
const SSL_CERT_FILE_NAME = 'cert.pem';
const SSL_KEY_FILE_NAME = 'key.pem';
const DOCKERFILE_NOUVEAU_EMTPY_NAME = 'Dockerfile.nouveau.empty';

const COUCHDB_USER = 'medic';
const COUCHDB_PASSWORD = 'password';
const SUB_DIR_CREDENTIALS = 'credentials';
const SUB_DIR_COUCHDB = 'couchdb';
const SUB_DIR_NOUVEAU = `${SUB_DIR_COUCHDB}/nouveau`;
const SUB_DIR_DOCKER_COMPOSE = 'compose';
const SUB_DIR_SSL = 'ssl';
const SUB_DIR_UPGRADE_SERVICE = 'upgrade-service';

const CHT_UPGRADE_SERVICE_COMPOSE_URL = 'https://raw.githubusercontent.com/medic/cht-upgrade-service/main/docker-compose.yml';

const DOCKERFILE_NOUVEAU_EMPTY = `# Placeholder image for nouveau container when running pre-5.0 CHT
FROM busybox:1.36.1-uclibc

# Keep the container alive (no-op)
CMD ["sh", "-c", "tail -f /dev/null"]`;

const getLocalVolumeDriver = (device: Option.Option<string>) => pipe(
  device,
  Option.map(device => `  
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${device}
  `)
);

const getUpgradeServiceComposeOverride = (chtxVolumeDriver: Option.Option<string>) => `
# Override for upgrade service compose config
volumes:
  ${CHTX_COMPOSE_FILES_VOLUME_NAME}:
    labels:
      - "chtx.instance=\${CHT_COMPOSE_PROJECT_NAME}"
${pipe(chtxVolumeDriver, Option.getOrElse(() => ''))}
`;

// The contents of this file have to pass `docker compose config` validation
const getChtxComposeOverride = (localVolumePath: Option.Option<string>) => `# Override for CHT compose config
services:
  couchdb:
    # Not used - only here to appease config validation
    build: { context: . }
    volumes:
      - cht-credentials:/opt/couchdb/etc/local.d/:rw
      - chtx-couchdb-data:/opt/couchdb/data:rw

  nouveau:
    # Only used when running a pre-5.0 CHT version without nouveau
    build:
      context: .
      dockerfile: ${DOCKERFILE_NOUVEAU_EMTPY_NAME}
    volumes:
      - chtx-nouveau-data:/data/nouveau:rw

volumes:
  cht-credentials:${pipe(
    localVolumePath,
    Option.map(path => `${path}/${SUB_DIR_CREDENTIALS}`),
    getLocalVolumeDriver,
    Option.getOrElse(() => '')
  )}
  cht-ssl:${pipe(
    localVolumePath,
    Option.map(path => `${path}/${SUB_DIR_SSL}`),
    getLocalVolumeDriver,
    Option.getOrElse(() => '')
  )}
  chtx-couchdb-data:${pipe(
    localVolumePath,
    Option.map(() => `\${COUCHDB_DATA}`),
    getLocalVolumeDriver,
    Option.getOrElse(() => '')
  )}
  chtx-nouveau-data:${pipe(
    localVolumePath,
    Option.map(() => `\${COUCHDB_DATA}/nouveau`),
    getLocalVolumeDriver,
    Option.getOrElse(() => '')
  )}
`;

export type SSLType = 'local-ip' | 'expired' | 'self-signed';
const SSL_URL_DICT: Record<SSLType, [[string, string], [string, string]]> = {
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

/**
 * Base configuration required for creating a CHT Upgrade Service container. See {@link ChtInstanceConfig} for the full
 * configuration required for deploy an actual CHT with the Upgrade Service.
 */
class ChtUpgradeSvcConfig extends Schema.Class<ChtUpgradeSvcConfig>('ChtUpgradeSvcConfig')({
  CHT_COMPOSE_PATH: Schema.Literal(CHTX_COMPOSE_FILES_VOLUME_NAME),
  CHT_COMPOSE_PROJECT_NAME: Schema.NonEmptyTrimmedString,
  DOCKER_CONFIG_PATH: Schema.Literal(CHTX_COMPOSE_FILES_VOLUME_NAME),
}) {
  static readonly generate = (instanceName: string) => ({
    CHT_COMPOSE_PATH: CHTX_COMPOSE_FILES_VOLUME_NAME,
    CHT_COMPOSE_PROJECT_NAME: instanceName,
    // This is a hack. The envar is required by the upgrade service compose, but is not used.
    DOCKER_CONFIG_PATH: CHTX_COMPOSE_FILES_VOLUME_NAME,
  });
}

/**
 * Full configuration required for deploying a CHT instance with the Upgrade Service.
 */
class ChtInstanceConfig extends ChtUpgradeSvcConfig.extend<ChtInstanceConfig>('ChtInstanceConfig')({
  CHT_NETWORK: Schema.NonEmptyTrimmedString,
  COMPOSE_PROJECT_NAME: Schema.NonEmptyTrimmedString,
  COUCHDB_DATA: Schema.String,
  COUCHDB_PASSWORD: Schema.NonEmptyTrimmedString,
  COUCHDB_SECRET: Schema.NonEmptyTrimmedString,
  COUCHDB_USER: Schema.NonEmptyTrimmedString,
  COUCHDB_UUID: Schema.NonEmptyTrimmedString,
  NGINX_HTTP_PORT: Schema.Number,
  NGINX_HTTPS_PORT: Schema.Number,
}) {

  static readonly generate = Effect.fn((
    instanceName: string,
    couchDbDataPath: string
  ) => pipe(
    freePortsEffect,
    Effect.map(([NGINX_HTTPS_PORT, NGINX_HTTP_PORT]) => ({
      ...ChtUpgradeSvcConfig.generate(instanceName),
      CHT_NETWORK: instanceName,
      COUCHDB_DATA: couchDbDataPath,
      COUCHDB_PASSWORD,
      COUCHDB_SECRET: crypto
        .randomBytes(16)
        .toString('hex'),
      COUCHDB_USER,
      COUCHDB_UUID: uuid(),
      NGINX_HTTP_PORT,
      NGINX_HTTPS_PORT,
      COMPOSE_PROJECT_NAME: upgradeSvcProjectName(instanceName),
    })),
    Effect.flatMap(Schema.decodeUnknown(ChtInstanceConfig)),
  ));

  static readonly asRecord = (
    config: ChtInstanceConfig
  ): Record<string, string> => config as unknown as Record<string, string>;
}

const getCouchDbDataPath = (localProjectPath: Option.Option<string>) => pipe(
  localProjectPath,
  Option.map(path => `${path}/${SUB_DIR_COUCHDB}`),
  Option.getOrElse(() => '')
);

const upgradeSvcProjectName = (instanceName: string) => `${instanceName}-up`;

const assertLocalVolumeEmpty = Effect.fn((localVolumePath: string) => pipe(
  isDirectoryEmpty(localVolumePath),
  Effect.filterOrFail(
    isEmpty => isEmpty,
    () => new Error(`Local directory ${localVolumePath} is not empty.`)
  ),
  Effect.map(() => localVolumePath),
));

const createVolumeDirsAtPath = Effect.fn((projectPath: string) => pipe(
  Array.make(
    SUB_DIR_CREDENTIALS,
    SUB_DIR_COUCHDB,
    SUB_DIR_NOUVEAU,
    SUB_DIR_DOCKER_COMPOSE,
    SUB_DIR_SSL,
    SUB_DIR_UPGRADE_SERVICE
  ),
  Array.map(subDir => `${projectPath}/${subDir}`),
  Array.map(createDir),
  Effect.allWith({ concurrency: 'unbounded' }),
));

const createProjectDir = Effect.fn((localVolumePath: Option.Option<string>) => pipe(
  localVolumePath,
  Option.map(Effect.succeed),
  Option.getOrElse(createTmpDir),
  Effect.flatMap(assertLocalVolumeEmpty),
  Effect.tap(createVolumeDirsAtPath)
));

const chtComposeUrl = (
  version: string,
  fileName: string
) => `https://staging.dev.medicmobile.org/_couch/builds_4/medic%3Amedic%3A${version}/docker-compose/${fileName}`;

const writeUpgradeServiceCompose = Effect.fn((projectPath: string) => pipe(
  CHT_UPGRADE_SERVICE_COMPOSE_URL,
  getRemoteFile,
  Effect.flatMap(writeFile(`${projectPath}/${SUB_DIR_UPGRADE_SERVICE}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`)),
));

const writeUpgradeServiceChtxOverride = Effect.fn((projectPath: string, localVolumePath: Option.Option<string>) => pipe(
  localVolumePath,
  Option.map(() => `${projectPath}/${SUB_DIR_DOCKER_COMPOSE}`),
  getLocalVolumeDriver,
  getUpgradeServiceComposeOverride,
  writeFile(`${projectPath}/${SUB_DIR_UPGRADE_SERVICE}/${UPGRADE_SVC_COMPOSE_OVERRIDE_FILE_NAME}`),
));

const writeComposeChtxOverride = Effect.fn((
  projectPath: string,
  localVolumePath: Option.Option<string>
) => pipe(
  getChtxComposeOverride(localVolumePath),
  writeFile(`${projectPath}/${SUB_DIR_DOCKER_COMPOSE}/${CHTX_COMPOSE_OVERRIDE_FILE_NAME}`),
));
const writeChtCompose = (dirPath: string, version: string) => Effect.fn((fileName: string) => pipe(
  chtComposeUrl(version, fileName),
  getRemoteFile,
  Effect.flatMap(writeFile(`${dirPath}/${SUB_DIR_DOCKER_COMPOSE}/${fileName}`)),
));
const writeEmptyNouveauDockerfile = Effect.fn((dirPath: string) => pipe(
  DOCKERFILE_NOUVEAU_EMPTY,
  writeFile(`${dirPath}/${SUB_DIR_DOCKER_COMPOSE}/Dockerfile.nouveau.empty`),
));

const writeComposeFiles = Effect.fn((
  projectPath: string,
  version: string,
  localVolumePath: Option.Option<string>
) => pipe(
  CHT_COMPOSE_FILE_NAMES,
  Array.map(writeChtCompose(projectPath, version)),
  Array.append(writeUpgradeServiceCompose(projectPath)),
  Array.append(writeUpgradeServiceChtxOverride(projectPath, localVolumePath)),
  Array.append(writeComposeChtxOverride(projectPath, localVolumePath)),
  Effect.allWith({ concurrency: 'unbounded' }),
));
const writeSSLFiles = (sslType: SSLType) => Effect.fn((dirPath: string) => pipe(
  SSL_URL_DICT[sslType],
  Array.map(([name, url]) => getRemoteFile(url)
    .pipe(Effect.flatMap(writeFile(`${dirPath}/${name}`)))),
  Effect.allWith({ concurrency: 'unbounded' }),
));

const doesUpgradeServiceExist = Effect.fn((instanceName: string) => pipe(
  upgradeSvcProjectName(instanceName),
  getContainersForComposeProject,
  Effect.map(Array.isNonEmptyArray)
));

const doesChtxVolumeExist = Effect.fn((instanceName: string) => doesVolumeExistWithLabel(
  `${CHTX_LABEL_NAME}=${instanceName}`
));
const assertChtxVolumeDoesNotExist = Effect.fn((instanceName: string) => doesChtxVolumeExist(instanceName)
  .pipe(Effect.filterOrFail(
    exists => !exists,
    () => new Error(`Instance ${instanceName} already exists`)
  )));
const assertChtxVolumeExists = Effect.fn((instanceName: string) => doesChtxVolumeExist(instanceName)
  .pipe(Effect.filterOrFail(
    exists => exists,
    () => new Error(`Instance ${instanceName} does not exist`)
  )));

const pullAllChtImages = Effect.fn((
  env: ChtInstanceConfig,
  projectPath: string,
) => pipe(
  [
    ...pipe(
      [...CHT_COMPOSE_FILE_NAMES, CHTX_COMPOSE_OVERRIDE_FILE_NAME],
      Array.map(fileName => `${projectPath}/${SUB_DIR_DOCKER_COMPOSE}/${fileName}`)
    ),
    ...pipe(
      [UPGRADE_SVC_COMPOSE_FILE_NAME, UPGRADE_SVC_COMPOSE_OVERRIDE_FILE_NAME],
      Array.map(fileName => `${projectPath}/${SUB_DIR_UPGRADE_SERVICE}/${fileName}`)
    )
  ],
  pullComposeImages('tmp', ChtInstanceConfig.asRecord(env)),
  // Log the output of the docker pull because this could take a very long time
  Logger.withMinimumLogLevel(LogLevel.Debug)
));

const createUpgradeSvcContainer = Effect.fn((instanceName: string, projectPath: string) => pipe(
  upgradeSvcProjectName(instanceName),
  createComposeContainers(
    {},
    `${projectPath}/${SUB_DIR_UPGRADE_SERVICE}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`,
    `${projectPath}/${SUB_DIR_UPGRADE_SERVICE}/${UPGRADE_SVC_COMPOSE_OVERRIDE_FILE_NAME}`
  )
));

const rmTempUpgradeServiceContainer = Effect.fn((
  instanceName: string
) => pipe(
  upgradeSvcProjectName(instanceName),
  rmComposeContainer(UPGRADE_SVC_NAME),
  Effect.catchAll(() => Effect.void)
));

const copyFilesToUpgradeSvcContainer = Effect.fn((instanceName: string, projectPath: string) => pipe(
  [...CHT_COMPOSE_FILE_NAMES, CHTX_COMPOSE_OVERRIDE_FILE_NAME],
  Array.map((fileName) => Tuple.make(
    `${projectPath}/${SUB_DIR_DOCKER_COMPOSE}/${fileName}`,
    `/docker-compose/${fileName}`
  )),
  Array.append(Tuple.make(
    `${projectPath}/${SUB_DIR_UPGRADE_SERVICE}/${ENV_FILE_NAME}`,
    `/docker-compose/${ENV_FILE_NAME}`
  )),
  Array.map(copyFileToComposeContainer(upgradeSvcProjectName(instanceName), UPGRADE_SVC_NAME)),
  Effect.allWith({ concurrency: 'unbounded' }),
));
const copySSLFilesToNginxContainer = (instanceName: string) => Effect.fn((tmpDir: string) => pipe(
  [SSL_CERT_FILE_NAME, SSL_KEY_FILE_NAME],
  Array.map((fileName): [string, string] => [`${tmpDir}/${fileName}`, `/etc/nginx/private/${fileName}`]),
  Array.map(copyFileToComposeContainer(instanceName, NGINX_SVC_NAME)),
  Effect.allWith({ concurrency: 'unbounded' }),
));
const copyEnvFileFromUpgradeSvcContainer = Effect.fn((instanceName: string, tmpDir: string) => pipe(
  upgradeSvcProjectName(instanceName),
  copyFileFromComposeContainer(
    UPGRADE_SVC_NAME,
    `/docker-compose/${ENV_FILE_NAME}`,
    `${tmpDir}/${SUB_DIR_UPGRADE_SERVICE}/${ENV_FILE_NAME}`
  ),
));
const copyEnvFileFromDanglingVolume = Effect.fn((
  tempDir: string,
  instanceName: string
) => Effect
  .acquireUseRelease(
    pipe(
      writeEnvFile(
        `${tempDir}/${SUB_DIR_UPGRADE_SERVICE}/${ENV_FILE_NAME}`,
        ChtUpgradeSvcConfig.generate(instanceName)
      ),
      Effect.andThen(createUpgradeSvcContainer(instanceName, tempDir))
    ),
    () => copyEnvFileFromUpgradeSvcContainer(instanceName, tempDir),
    () => rmTempUpgradeServiceContainer(instanceName)
  )
  .pipe(Effect.scoped));
const copyFilesToDanglingVolume = Effect.fn((
  projectPath: string,
  instanceName: string
) => Effect
  .acquireUseRelease(
    createUpgradeSvcContainer(instanceName, projectPath),
    () => copyFilesToUpgradeSvcContainer(instanceName, projectPath),
    () => rmTempUpgradeServiceContainer(instanceName)
  )
  .pipe(Effect.scoped));

const getEnvarFromUpgradeSvcContainer = Effect.fn((instanceName: string, envar: string) => pipe(
  upgradeSvcProjectName(instanceName),
  serviceName => getEnvarFromComposeContainer(UPGRADE_SVC_NAME, envar, serviceName),
));

const getPortForInstance = Effect.fn((instanceName: string) => pipe(
  getEnvarFromUpgradeSvcContainer(instanceName, 'NGINX_HTTPS_PORT'),
  Effect.map(Number.parseInt),
  Effect.flatMap(value => Match
    .value(value)
    .pipe(
      Match.when(Number.isInteger, () => Effect.succeed(value.toString() as `${number}`)),
      Match.orElse(() => Effect.fail(new Error(`Could not get port for instance ${instanceName}`))),
    ))
));

const getInstanceStatus = Effect.fn(
  (instanceName: string) => Effect.all([
    getContainersForComposeProject(instanceName, 'running'),
    getContainersForComposeProject(instanceName, 'exited', 'created', 'paused', 'restarting', 'removing', 'dead'),
  ]),
  Effect.map(Array.map(Array.isNonEmptyArray)),
  Effect.map(Match.value),
  Effect.map(Match.when([true, false], () => 'running' as const)),
  Effect.map(Match.orElse(() => 'stopped' as const)),
);

const getLocalChtInstanceInfo = Effect.fn((
  instanceName: string
): Effect.Effect<LocalChtInstance, PlatformError, CommandExecutor> => Effect
  .all([
    getInstanceStatus(instanceName),
    getEnvarFromUpgradeSvcContainer(instanceName, 'COUCHDB_USER'),
    getEnvarFromUpgradeSvcContainer(instanceName, 'COUCHDB_PASSWORD'),
    getPortForInstance(instanceName)
      .pipe(Effect.catchAll(() => Effect.succeed(null))),
  ])
  .pipe(Effect.map(([status, username, password, port]) => ({
    name: instanceName,
    username,
    password: Redacted.make(password),
    status,
    port: Option.fromNullable(port)
  }))));

const waitForInstance = Effect.fn((port: string) => HttpClient.HttpClient.pipe(
  Effect.map(filterStatusOk),
  Effect.tap(Effect.logDebug(`Checking if local instance is up on port ${port}`)),
  Effect.flatMap(client => client.execute(HttpClientRequest.get(`https://localhost:${port}/api/info`))),
  Effect.retry({
    times: 180,
    schedule: Schedule.spaced(1000),
  }),
  Effect.scoped,
));

const createUpgradeServiceFromLocalVolume = Effect.fn((
  projectName: string,
  localVolumePath: string
) => pipe(
  assertChtxVolumeDoesNotExist(projectName),
  Effect.andThen(() => createUpgradeSvcContainer(projectName, localVolumePath)),
));
const createUpgradeServiceFromDanglingVolume = (projectName: string) => Effect.fn(() => pipe(
  createProjectDir(Option.none()),
  Effect.flatMap(tmpDir => pipe(
    Effect.all([
      writeUpgradeServiceCompose(tmpDir),
      writeUpgradeServiceChtxOverride(tmpDir, Option.none()),
    ], { concurrency: 'unbounded' }),
    Effect.andThen(copyEnvFileFromDanglingVolume(tmpDir, projectName)),
    Effect.andThen(() => createUpgradeSvcContainer(projectName, tmpDir)),
  )),
  Effect.scoped,
));
const ensureUpgradeServiceExists = Effect.fn((
  projectName: string,
  localVolumePath: Option.Option<string>
) => pipe(
  localVolumePath,
  Option.map(path => createUpgradeServiceFromLocalVolume(projectName, path)),
  Option.getOrElse(() => pipe(
    assertChtxVolumeExists(projectName),
    Effect.filterEffectOrElse({
      predicate: () => doesUpgradeServiceExist(projectName),
      orElse: createUpgradeServiceFromDanglingVolume(projectName),
    }),
  )),
));

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
  status: 'running' | 'stopped',
  port: Option.Option<`${number}`>
}

export class LocalInstanceService extends Effect.Service<LocalInstanceService>()('chtoolbox/LocalInstanceService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    create: Effect.fn((
      instanceName: string,
      version: string,
      localProjectPath: Option.Option<string>
    ): Effect.Effect<void, Error> => pipe(
      assertChtxVolumeDoesNotExist(instanceName),
      Effect.andThen(Effect.all([
        ChtInstanceConfig.generate(instanceName, getCouchDbDataPath(localProjectPath)),
        createProjectDir(localProjectPath)
      ], { concurrency: 'unbounded' })),
      Effect.flatMap(([env, projectPath]) => pipe(
        Effect.all([
          writeComposeFiles(projectPath, version, localProjectPath),
          writeEmptyNouveauDockerfile(projectPath),
          writeEnvFile(`${projectPath}/${SUB_DIR_UPGRADE_SERVICE}/${ENV_FILE_NAME}`, ChtInstanceConfig.asRecord(env)),
        ], { concurrency: 'unbounded' }),
        Effect.andThen(pullAllChtImages(env, projectPath)),
        Effect.andThen(pipe(
          copyFilesToDanglingVolume(projectPath, instanceName),
          Effect.when(() => Option.isNone(localProjectPath))
        )),
      )),
      mapErrorToGeneric,
      Effect.scoped,
      Effect.provide(context),
    )),
    start: Effect.fn((
      instanceName: string,
      localVolumePath: Option.Option<string>
    ): Effect.Effect<LocalChtInstance, Error> => pipe(
      ensureUpgradeServiceExists(instanceName, localVolumePath),
      Effect.andThen(restartCompose(upgradeSvcProjectName(instanceName))),
      Effect.andThen(getLocalChtInstanceInfo(instanceName)),
      Effect.tap(({ port }) => port.pipe(
        Option.getOrThrow,
        waitForInstance
      )),
      // Get status again after instance started
      Effect.flatMap(instanceData => getInstanceStatus(instanceName)
        .pipe(
          Effect.map(status => ({
            ...instanceData,
            status,
          }))
        )),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
    stop: Effect.fn((
      instanceName: string
    ): Effect.Effect<void, Error> => pipe(
      assertChtxVolumeExists(instanceName),
      Effect.andThen(Effect.all([
        stopCompose(instanceName),
        stopCompose(upgradeSvcProjectName(instanceName))
      ], { concurrency: 'unbounded' })),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
    rm: Effect.fn((
      instanceName: string
    ): Effect.Effect<void, Error> => pipe(
      Effect.all([
        destroyCompose(instanceName),
        destroyCompose(upgradeSvcProjectName(instanceName)),
      ]),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
    setSSLCerts: Effect.fn((
      instanceName: string,
      sslType: SSLType
    ): Effect.Effect<void, Error> => pipe(
      ensureUpgradeServiceExists(instanceName, Option.none()),
      Effect.andThen(startCompose(upgradeSvcProjectName(instanceName))),
      Effect.andThen(getPortForInstance(instanceName)),
      Effect.tap(waitForInstance),
      Effect.andThen(createTmpDir()),
      Effect.tap(writeSSLFiles(sslType)),
      Effect.flatMap(copySSLFilesToNginxContainer(instanceName)),
      Effect.andThen(restartComposeService(instanceName, NGINX_SVC_NAME)),
      mapErrorToGeneric,
      Effect.provide(context),
      Effect.scoped,
    )),
    ls: Effect.fn((): Effect.Effect<LocalChtInstance[], Error> => pipe(
      getVolumeNamesWithLabel(CHTX_LABEL_NAME),
      Effect.map(Array.map(getVolumeLabelValue(CHTX_LABEL_NAME))),
      Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
      Effect.map(Array.map(getLocalChtInstanceInfo)),
      Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })),
      mapErrorToGeneric,
      Effect.provide(context),
    )),
  }))),
  accessors: true,
}) {
}
