import { Command, Options } from '@effect/cli';
import { Array, Clock, Console, Effect, Number, pipe } from 'effect';
import { CouchNodeSystem, CouchNodeSystemService } from '../services/couch/node-system';
import { CouchDbInfo, CouchDbsInfoService } from '../services/couch/dbs-info';
import { chtx, populateUrl } from '../index';
import { CouchDesignInfo, CouchDesignInfoService } from '../services/couch/design-info';

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

const getDbInfoColumnsForDb = (dbName: string) => [
  `${dbName}_sizes_file`,
  `${dbName}_sizes_active`,
  `${dbName}_compact_running`,
];

const getDbInfoColumns = () => pipe(
  DB_NAMES,
  Array.flatMap(getDbInfoColumnsForDb)
);

const NODE_SYSTEM_COLUMNS = [
  'memory_other',
  'memory_atom',
  'memory_atom_used',
  'memory_processes',
  'memory_processes_used',
  'memory_binary',
  'memory_code',
  'memory_ets',
];

const getDesignInfoColumnsForDb = (dbName: typeof DB_NAMES[number]) => pipe(
  VIEW_INDEXES_BY_DB[dbName],
  Array.flatMap(designName => [
    `${dbName}_${designName}_compact_running`,
    `${dbName}_${designName}_updater_running`,
    `${dbName}_${designName}_sizes_file`,
    `${dbName}_${designName}_sizes_active`,
  ])
);

const getDesignInfoColumns = () => pipe(
  DB_NAMES,
  Array.flatMap(getDesignInfoColumnsForDb)
);

const CSV_COLUMNS = [
  'unix_time',
  ...getDbInfoColumns(),
  ...NODE_SYSTEM_COLUMNS,
  ...getDesignInfoColumns(),
];

const getDbInfoData = (dbInfo?: CouchDbInfo) => [
  dbInfo?.info.sizes.file ?? -1,
  dbInfo?.info.sizes.active ?? -1,
  dbInfo?.info.compact_running ?? false,
];

const getDbInfoByName = (dbsInfo: readonly CouchDbInfo[]) => (dbName: string) => dbsInfo.find(db => db.key === dbName);
const getDbInfoForDbName = (dbsInfo: readonly CouchDbInfo[]) => (dbName: string) => pipe(
  dbName,
  getDbInfoByName(dbsInfo),
  getDbInfoData,
);

const getNodeSystemData = ({ memory }: CouchNodeSystem) => [
  memory.other,
  memory.atom,
  memory.atom_used,
  memory.processes,
  memory.processes_used,
  memory.binary,
  memory.code,
  memory.ets,
];

const getDesignInfoData = (designInfo: CouchDesignInfo) => [
  designInfo.view_index.compact_running,
  designInfo.view_index.updater_running,
  designInfo.view_index.sizes.file,
  designInfo.view_index.sizes.active,
];

const getDesignInfosData = (designInfos: readonly CouchDesignInfo[][]) => pipe(
  designInfos,
  Array.flatMap(Array.flatMap(getDesignInfoData)),
);

const getCsvData = ([unixTime, nodeSystem, dbsInfo, designInfos]: [
  number,
  CouchNodeSystem,
  readonly CouchDbInfo[],
  readonly CouchDesignInfo[][]
]) => [
  unixTime,
  ...pipe(
    DB_NAMES,
    Array.flatMap(getDbInfoForDbName(dbsInfo))
  ),
  ...getNodeSystemData(nodeSystem),
  ...getDesignInfosData(designInfos),
];

const formatCsvRow = (row: readonly (string | number | boolean)[]) => pipe(
  row,
  Array.map(value => String(value)),
  Array.join(', ')
);

const monitorData = (interval: number) => Effect
  .all([
    Clock.currentTimeMillis.pipe(
      Effect.map(Number.unsafeDivide(1000)),
      Effect.map(Math.floor)
    ),
    getCouchNodeSystem,
    getCouchDbsInfo,
    getCouchDesignInfos
  ])
  .pipe(
    Effect.map(getCsvData),
    Effect.map(formatCsvRow),
    Effect.tap(Console.log),
    Effect.delay(interval * 1000)
  );

const interval = Options
  .integer('interval')
  .pipe(
    Options.withAlias('i'),
    Options.withDescription('The interval in seconds to poll the data. Default is 1 second.'),
    Options.withDefault(1),
  );

export const monitor = Command
  .make('monitor', { interval }, ({ interval }) => pipe(
    Effect.flatMap(chtx, (parentConfig) => parentConfig.url.pipe(
      populateUrl
    )),
    Effect.andThen(CSV_COLUMNS),
    Effect.map(formatCsvRow),
    Effect.tap(Console.log),
    Effect.andThen(Effect.repeat(monitorData(interval), { until: () => false }))
  ))
  .pipe(
    Command.withDescription(`Poll CHT metrics.`),
  );
