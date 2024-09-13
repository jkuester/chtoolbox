import { Command } from '@effect/cli';
import { Array, Console, Effect, pipe } from 'effect';
import { CouchNodeSystem, CouchNodeSystemService } from '../services/couch/node-system';
import { CouchDbInfo, CouchDbsInfoService } from '../services/couch/dbs-info';

const getCouchNodeSystem = Effect.flatMap(CouchNodeSystemService, (couchSystem) => couchSystem.get());
const getCouchDbsInfo = Effect.flatMap(CouchDbsInfoService, (couchSystem) => couchSystem.get());

const dbInfoDbNames = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];

const getDbInfoColumns = (dbName: string) => [
  `${dbName}_sizes_file`,
  `${dbName}_sizes_active`,
];

const csvColumns = [
  'memory_atom',
  ...pipe(
    dbInfoDbNames,
    Array.flatMap(getDbInfoColumns)
  ),
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

const getCsvData = ([nodeSystem, dbsInfo]: [CouchNodeSystem, readonly CouchDbInfo[]]) => [
  nodeSystem.memory.atom,
  ...pipe(
    dbInfoDbNames,
    Array.flatMap(getDbInfoForDbName(dbsInfo))
  )
];

const formatCsvRow = (row: readonly (string | number)[]) => pipe(
  row,
  Array.map(value => String(value)),
  Array.join(', ')
);

const monitorData = Effect
  .all([getCouchNodeSystem, getCouchDbsInfo])
  .pipe(
    Effect.map(getCsvData),
    Effect.map(formatCsvRow),
    Effect.tap(Console.log),
    Effect.delay(1000)
  );

export const monitor = Command.make('monitor', {}, () => pipe(
  csvColumns,
  formatCsvRow,
  Console.log,
  Effect.andThen(Effect.repeat(monitorData, { until: () => false }))
));
