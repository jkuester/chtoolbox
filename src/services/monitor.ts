import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchDbInfo, CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignInfo, CouchDesignInfoService } from './couch/design-info';
import { CouchNodeSystem, CouchNodeSystemService } from './couch/node-system';
import { Array, Clock, Number, Option, pipe } from 'effect';
import { LocalDiskUsageService } from './local-disk-usage';
import { PlatformError } from '@effect/platform/Error';
import { ResponseError } from '@effect/platform/HttpClientError';
import { NonEmptyArray } from 'effect/Array';

interface DatabaseInfo extends CouchDbInfo {
  designs: CouchDesignInfo[]
}

export interface MonitoringData extends CouchNodeSystem {
  unix_time: number,
  databases: DatabaseInfo[]
  directory_size: Option.Option<number>
}

export interface MonitorService {
  readonly get: (directory: Option.Option<string>) => Effect.Effect<MonitoringData, Error | PlatformError>,
  readonly getCsvHeader: (directory: Option.Option<string>) => string[],
  readonly getAsCsv: (directory: Option.Option<string>) => Effect.Effect<string[], Error | PlatformError>,
}

export const MonitorService = Context.GenericTag<MonitorService>('chtoolbox/MonitorService');

const currentTimeSec = Clock.currentTimeMillis.pipe(
  Effect.map(Number.unsafeDivide(1000)),
  Effect.map(Math.floor)
);

const DB_NAMES: NonEmptyArray<string> = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];
const VIEW_INDEXES_BY_DB: Record<typeof DB_NAMES[number], string[]> = {
  medic: [
    'medic',
    'medic-admin',
    'medic-client',
    'medic-conflicts',
    'medic-scripts',
    'medic-sms',
    ':staged:medic',
    ':staged:medic-admin',
    ':staged:medic-client',
    ':staged:medic-conflicts',
    ':staged:medic-scripts',
    ':staged:medic-sms',
  ],
  'medic-sentinel': [
    'sentinel',
    ':staged:sentinel',
  ],
  'medic-users-meta': [
    'users-meta',
    ':staged:users-meta',
  ],
  '_users': [
    'users',
    ':staged:users',
  ],
};

const getCouchNodeSystem = Effect.flatMap(CouchNodeSystemService, (couchSystem) => couchSystem.get());
const getCouchDbsInfo = Effect.flatMap(CouchDbsInfoService, (couchSystem) => couchSystem.post(DB_NAMES));
const emptyDesignInfo: CouchDesignInfo = {
  name: '',
  view_index: {
    compact_running: false,
    updater_running: false,
    sizes: {
      file: 0,
      active: 0,
    },
  },
} as CouchDesignInfo;
const getCouchDesignInfosForDb = (dbName: string) => CouchDesignInfoService.pipe(
  Effect.flatMap(service => Effect.all(pipe(
    VIEW_INDEXES_BY_DB[dbName],
    Array.map(designName => service.get(dbName, designName)),
    Array.map(Effect.catchIf(
      (error) => error instanceof ResponseError && error.response.status === 404,
      () => Effect.succeed(emptyDesignInfo),
    )),
  ))),
);

const getCouchDesignInfos = pipe(
  DB_NAMES,
  Array.map(getCouchDesignInfosForDb),
  Effect.all,
);

const getDirectorySize = (directory: Option.Option<string>) => LocalDiskUsageService.pipe(
  Effect.flatMap(service => directory.pipe(
    Option.map(dir => service.getSize(dir)),
    Option.getOrElse(() => Effect.succeed(null))
  )),
  Effect.map(Option.fromNullable),
);

const getMonitoringData = (directory: Option.Option<string>) => pipe(
  Effect.all([
    currentTimeSec,
    getCouchNodeSystem,
    getCouchDbsInfo,
    getCouchDesignInfos,
    getDirectorySize(directory),
  ]),
  Effect.map(([
    unixTime,
    nodeSystem,
    dbsInfo,
    designInfos,
    directory_size
  ]): MonitoringData => ({
    ...nodeSystem,
    unix_time: unixTime,
    databases: dbsInfo.map((dbInfo, i) => ({
      ...dbInfo,
      designs: designInfos[i]
    })),
    directory_size
  })),
);

const getCsvHeader = (directory: Option.Option<string>) => [
  'unix_time',
  ...DB_NAMES.flatMap(dbName => [
    `${dbName}_sizes_file`,
    `${dbName}_sizes_active`,
    `${dbName}_compact_running`,
    ...VIEW_INDEXES_BY_DB[dbName].flatMap(designName => [
      `${dbName}_${designName}_compact_running`,
      `${dbName}_${designName}_updater_running`,
      `${dbName}_${designName}_sizes_file`,
      `${dbName}_${designName}_sizes_active`,
    ])
  ]),
  'memory_processes_used',
  'memory_binary',
  ...(directory.pipe(
    Option.map(() => 'directory_size'),
    Option.map(Array.of),
    Option.getOrElse(() => []),
  ))
];

const getAsCsv = (directory: Option.Option<string>) => pipe(
  getMonitoringData(directory),
  Effect.map(data => [
    data.unix_time.toString(),
    ...data.databases.flatMap(db => [
      db.info.sizes.file.toString(),
      db.info.sizes.active.toString(),
      db.info.compact_running.toString(),
      ...db.designs.flatMap(design => [
        design.view_index.compact_running.toString(),
        design.view_index.updater_running.toString(),
        design.view_index.sizes.file.toString(),
        design.view_index.sizes.active.toString(),
      ])
    ]),
    data.memory.processes_used.toString(),
    data.memory.binary.toString(),
    ...(data.directory_size.pipe(
      Option.map(value => value.toString()),
      Option.map(Array.of),
      Option.getOrElse(() => []),
    )),
  ]),
);

const ServiceContext = Effect
  .all([
    CouchNodeSystemService,
    CouchDbsInfoService,
    CouchDesignInfoService,
    LocalDiskUsageService,
  ])
  .pipe(Effect.map(([
    couchNodeSystem,
    couchDbsInfo,
    couchDesignInfo,
    localDiskUsage,
  ]) => Context
    .make(CouchNodeSystemService, couchNodeSystem)
    .pipe(
      Context.add(CouchDbsInfoService, couchDbsInfo),
      Context.add(CouchDesignInfoService, couchDesignInfo),
      Context.add(LocalDiskUsageService, localDiskUsage),
    )));

export const MonitorServiceLive = Layer.effect(MonitorService, ServiceContext.pipe(Effect.map(
  context => MonitorService.of({
    get: (directory: Option.Option<string>) => getMonitoringData(directory)
      .pipe(Effect.provide(context)),
    getCsvHeader,
    getAsCsv: (directory: Option.Option<string>) => getAsCsv(directory)
      .pipe(Effect.provide(context)),
  })
)));
