import { Command, Options } from '@effect/cli';
import { Array, Console, Effect, pipe } from 'effect';
import { CouchNodeSystem, CouchNodeSystemService } from '../services/couch/node-system';
import { CouchDbInfo, CouchDbsInfoService } from '../services/couch/dbs-info';
import { chtx, populateUrl } from '../index';

const DB_NAMES = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];

const getCouchNodeSystem = Effect.flatMap(CouchNodeSystemService, (couchSystem) => couchSystem.get());
const getCouchDbsInfo = Effect.flatMap(CouchDbsInfoService, (couchSystem) => couchSystem.get());

const getDbInfoColumns = (dbName: string) => [
  `${dbName}_sizes_file`,
  `${dbName}_sizes_active`,
];

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

const CSV_COLUMNS = [
  ...pipe(
    DB_NAMES,
    Array.flatMap(getDbInfoColumns)
  ),
  ...NODE_SYSTEM_COLUMNS,
];

const getDbInfoData = (dbInfo?: CouchDbInfo) => [
  dbInfo?.info.sizes.file ?? -1,
  dbInfo?.info.sizes.active ?? -1,
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

const getCsvData = ([nodeSystem, dbsInfo]: [CouchNodeSystem, readonly CouchDbInfo[]]) => [
  ...pipe(
    DB_NAMES,
    Array.flatMap(getDbInfoForDbName(dbsInfo))
  ),
  ...getNodeSystemData(nodeSystem),
];

const formatCsvRow = (row: readonly (string | number)[]) => pipe(
  row,
  Array.map(value => String(value)),
  Array.join(', ')
);

const monitorData = (interval: number) => Effect
  .all([getCouchNodeSystem, getCouchDbsInfo])
  .pipe(
    Effect.map(getCsvData),
    Effect.map(formatCsvRow),
    Effect.tap(Console.log),
    Effect.delay(interval * 1000)
  );

const interval = Options.integer('interval').pipe(
  Options.withAlias('i'),
  Options.withDescription('The interval in seconds to poll the data. Default is 1 second.'),
  Options.withDefault(1),
);

export const monitor = Command.make('monitor', { interval }, ({ interval }) => pipe(
  Effect.flatMap(chtx, (parentConfig) => parentConfig.url.pipe(
    populateUrl
  )),
  Effect.tap(Console.log),
  Effect.andThen(CSV_COLUMNS),
  Effect.map(formatCsvRow),
  Effect.tap(Console.log),
  Effect.andThen(Effect.repeat(monitorData(interval), { until: () => false }))
)).pipe(
  Command.withDescription(`Poll CHT metrics.`),
);
