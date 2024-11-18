import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { CouchDbInfo, getDbsInfoByName } from '../libs/couch/dbs-info.js';
import { CouchDesignInfo, getDesignInfo } from '../libs/couch/design-info.js';
import { CouchNodeSystem, getCouchNodeSystem } from '../libs/couch/node-system.js';
import { Array, Clock, Number, Option, pipe } from 'effect';
import { LocalDiskUsageService } from './local-disk-usage.js';
import { ResponseError } from '@effect/platform/HttpClientError';
import { NonEmptyArray } from 'effect/Array';
import { PlatformError } from '@effect/platform/Error';
import { ChtClientService } from './cht-client.js';

interface DatabaseInfo extends CouchDbInfo {
  designs: CouchDesignInfo[]
}

interface MonitoringData extends CouchNodeSystem {
  unix_time: number,
  databases: DatabaseInfo[]
  nouveau: NouveauInfo[]
  couchdb_directory_size: Option.Option<number>
  nouveau_directory_size: Option.Option<number>
}

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
const getCouchDesignInfosForDb = (dbName: string) => Effect.all(pipe(
  VIEW_INDEXES_BY_DB[dbName],
  Array.map(designName => getDesignInfo(dbName, designName)),
  Array.map(Effect.catchIf(
    (error) => error instanceof ResponseError && error.response.status === 404,
    () => Effect.succeed(emptyDesignInfo),
  )),
));

const getCouchDesignInfos = () => pipe(
  DB_NAMES,
  Array.map(getCouchDesignInfosForDb),
  Effect.all,
);

const NOUVEAU_INDEXES = [
  'contacts_by_type_freetext',
  'contacts_by_freetext',
  'reports_by_freetext',
];

const emptyNouveauInfo: NouveauInfo = {
  name: '',
  search_index: {
    purge_seq: 0,
    update_seq: 0,
    disk_size: 0,
    num_docs: 0,
  },
};

const getNouveauInfos = pipe(
  NOUVEAU_INDEXES,
  Array.map(indexName => NouveauInfoService.get('medic', 'medic-nouveau', indexName)),
  Array.map(Effect.catchIf(
    (error) => error instanceof ResponseError && error.response.status === 404,
    () => Effect.succeed(emptyNouveauInfo),
  )),
  Effect.all,
);

const getDirectorySize = (couchDbDirectory: Option.Option<string>) => LocalDiskUsageService.pipe(
  Effect.flatMap(service => couchDbDirectory.pipe(
    Option.map(dir => service.getSize(dir)),
    Option.getOrElse(() => Effect.succeed(null))
  )),
  Effect.map(Option.fromNullable),
);

const getMonitoringData = (couchDbDirectory: Option.Option<string>, nouveauDirectory: Option.Option<string>) => pipe(
  Effect.all([
    currentTimeSec,
    getCouchNodeSystem(),
    getDbsInfoByName(DB_NAMES),
    getCouchDesignInfos(),
    getNouveauInfos,
    getDirectorySize(couchDbDirectory),
    getDirectorySize(nouveauDirectory),
  ]),
  Effect.map(([
    unixTime,
    nodeSystem,
    dbsInfo,
    designInfos,
    nouveauInfos,
    couchdb_directory_size,
    nouveau_directory_size,
  ]): MonitoringData => ({
    ...nodeSystem,
    unix_time: unixTime,
    databases: dbsInfo.map((dbInfo, i) => ({
      ...dbInfo,
      designs: designInfos[i]
    })),
    nouveau: nouveauInfos,
    couchdb_directory_size,
    nouveau_directory_size,
  })),
);

const getCsvHeader = (couchDbDirectory: Option.Option<string>, nouveauDirectory: Option.Option<string>): string[] => [
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
  ...(couchDbDirectory.pipe(
    Option.map(() => 'couchdb_directory_size'),
    Option.map(Array.of),
    Option.getOrElse(() => []),
  )),
  ...(nouveauDirectory.pipe(
    Option.map(() => 'nouveau_directory_size'),
    Option.map(Array.of),
    Option.getOrElse(() => []),
  )),
  ...NOUVEAU_INDEXES.flatMap(indexName => [
    `medic_medic-nouveau_${indexName}_num_docs`,
    `medic_medic-nouveau_${indexName}_disk_size`,
  ]),
];

const getAsCsv = (couchDbDirectory: Option.Option<string>, nouveauDirectory: Option.Option<string>) => pipe(
  getMonitoringData(couchDbDirectory, nouveauDirectory),
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
    ...(data.couchdb_directory_size.pipe(
      Option.map(value => value.toString()),
      Option.map(Array.of),
      Option.getOrElse(() => []),
    )),
    ...(data.nouveau_directory_size.pipe(
      Option.map(value => value.toString()),
      Option.map(Array.of),
      Option.getOrElse(() => []),
    )),
    ...data.nouveau.flatMap(nouveauInfo => [
      nouveauInfo.search_index.num_docs,
      nouveauInfo.search_index.disk_size,
    ]),
  ]),
);

const serviceContext = Effect
  .all([
    LocalDiskUsageService,
    ChtClientService,
  ])
  .pipe(Effect.map(([
    localDiskUsage,
    chtClient,
  ]) => Context
    .make(LocalDiskUsageService, localDiskUsage)
    .pipe(Context.add(ChtClientService, chtClient))));

export class MonitorService extends Effect.Service<MonitorService>()('chtoolbox/MonitorService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    get: (
      couchDbDirectory: Option.Option<string>,
      nouveauDirectory: Option.Option<string>,
    ): Effect.Effect<MonitoringData, Error | PlatformError> => getMonitoringData(couchDbDirectory, nouveauDirectory)
      .pipe(Effect.provide(context)),
    getCsvHeader,
    getAsCsv: (
      couchDbDirectory: Option.Option<string>,
      nouveauDirectory: Option.Option<string>,
    ): Effect.Effect<(string | number)[], Error | PlatformError> => getAsCsv(couchDbDirectory, nouveauDirectory)
      .pipe(Effect.provide(context)),
  }))),
  accessors: true,
}) {
}
