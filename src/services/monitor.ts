import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { CouchDbInfo, CouchDbsInfoService } from './couch/dbs-info';
import { CouchDesignInfo, CouchDesignInfoService } from './couch/design-info';
import { CouchNodeSystem, CouchNodeSystemService } from './couch/node-system';
import { Array, Clock, Number, pipe } from 'effect';

interface DatabaseInfo extends CouchDbInfo {
  designs: CouchDesignInfo[]
}

export interface MonitoringData extends CouchNodeSystem {
  unix_time: number,
  databases: DatabaseInfo[]
}

export interface MonitorService {
  readonly get: () => Effect.Effect<
    MonitoringData,
    Error,
    CouchNodeSystemService | CouchDbsInfoService | CouchDesignInfoService
  >,
  readonly getCsvHeader: () => string[],
  readonly getAsCsv: () => Effect.Effect<
    string[],
    Error,
    CouchNodeSystemService | CouchDbsInfoService | CouchDesignInfoService
  >,
}

export const MonitorService = Context.GenericTag<MonitorService>('chtoolbox/MonitorService');

const currentTimeSec = Clock.currentTimeMillis.pipe(
  Effect.map(Number.unsafeDivide(1000)),
  Effect.map(Math.floor)
);

const DB_NAMES = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];
const VIEW_INDEXES_BY_DB: Record<typeof DB_NAMES[number], string[]> = {
  medic: [
    'medic',
    'medic-admin',
    'medic-client',
    'medic-conflicts',
    'medic-scripts',
    'medic-sms',
  ],
  'medic-sentinel': ['sentinel'],
  'medic-users-meta': ['users-meta'],
  '_users': ['users'],
};

const getCouchNodeSystem = Effect.flatMap(CouchNodeSystemService, (couchSystem) => couchSystem.get());
const getCouchDbsInfo = Effect.flatMap(CouchDbsInfoService, (couchSystem) => couchSystem.get());
const getCouchDesignInfosForDb = (dbName: string) => CouchDesignInfoService.pipe(
  Effect.flatMap(service => Effect.all(pipe(
    VIEW_INDEXES_BY_DB[dbName],
    Array.map(designName => service.get(dbName, designName))
  )))
);
const getCouchDesignInfos = pipe(
  DB_NAMES,
  Array.map(getCouchDesignInfosForDb),
  Effect.all,
);

const getMonitoringData = pipe(
  Effect.all([
    currentTimeSec,
    getCouchNodeSystem,
    getCouchDbsInfo,
    getCouchDesignInfos
  ]),
  Effect.map(([unixTime, nodeSystem, dbsInfo, designInfos]): MonitoringData => ({
    ...nodeSystem,
    unix_time: unixTime,
    databases: dbsInfo.map((dbInfo, i) => ({
      ...dbInfo,
      designs: designInfos[i]
    })),
  })),
  x => x,
);

const getCsvHeader = () => [
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
  'memory_other',
  'memory_atom',
  'memory_atom_used',
  'memory_processes',
  'memory_processes_used',
  'memory_binary',
  'memory_code',
  'memory_ets',
];

const getAsCsv = () => pipe(
  getMonitoringData,
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
    data.memory.other.toString(),
    data.memory.atom.toString(),
    data.memory.atom_used.toString(),
    data.memory.processes.toString(),
    data.memory.processes_used.toString(),
    data.memory.binary.toString(),
    data.memory.code.toString(),
    data.memory.ets.toString(),
  ]),
);

const createMonitorService = pipe(
  MonitorService.of({
    get: () => getMonitoringData,
    getCsvHeader,
    getAsCsv,
  })
);

export const MonitorServiceLive = Layer.succeed(MonitorService, createMonitorService);
