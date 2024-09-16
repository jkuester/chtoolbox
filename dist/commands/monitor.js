"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitor = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const node_system_1 = require("../services/couch/node-system");
const dbs_info_1 = require("../services/couch/dbs-info");
const index_1 = require("../index");
const DB_NAMES = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];
const getCouchNodeSystem = effect_1.Effect.flatMap(node_system_1.CouchNodeSystemService, (couchSystem) => couchSystem.get());
const getCouchDbsInfo = effect_1.Effect.flatMap(dbs_info_1.CouchDbsInfoService, (couchSystem) => couchSystem.get());
const getDbInfoColumns = (dbName) => [
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
    ...(0, effect_1.pipe)(DB_NAMES, effect_1.Array.flatMap(getDbInfoColumns)),
    ...NODE_SYSTEM_COLUMNS,
];
const getDbInfoData = (dbInfo) => [
    dbInfo?.info.sizes.file ?? -1,
    dbInfo?.info.sizes.active ?? -1,
];
const getDbInfoByName = (dbsInfo) => (dbName) => dbsInfo.find(db => db.key === dbName);
const getDbInfoForDbName = (dbsInfo) => (dbName) => (0, effect_1.pipe)(dbName, getDbInfoByName(dbsInfo), getDbInfoData);
const getNodeSystemData = ({ memory }) => [
    memory.other,
    memory.atom,
    memory.atom_used,
    memory.processes,
    memory.processes_used,
    memory.binary,
    memory.code,
    memory.ets,
];
const getCsvData = ([nodeSystem, dbsInfo]) => [
    ...(0, effect_1.pipe)(DB_NAMES, effect_1.Array.flatMap(getDbInfoForDbName(dbsInfo))),
    ...getNodeSystemData(nodeSystem),
];
const formatCsvRow = (row) => (0, effect_1.pipe)(row, effect_1.Array.map(value => String(value)), effect_1.Array.join(', '));
const monitorData = (interval) => effect_1.Effect
    .all([getCouchNodeSystem, getCouchDbsInfo])
    .pipe(effect_1.Effect.map(getCsvData), effect_1.Effect.map(formatCsvRow), effect_1.Effect.tap(effect_1.Console.log), effect_1.Effect.delay(interval * 1000));
const interval = cli_1.Options.integer('interval').pipe(cli_1.Options.withAlias('i'), cli_1.Options.withDescription('The interval in seconds to poll the data. Default is 1 second.'), cli_1.Options.withDefault(1));
exports.monitor = cli_1.Command.make('monitor', { interval }, ({ interval }) => (0, effect_1.pipe)(effect_1.Effect.flatMap(index_1.chtx, (parentConfig) => parentConfig.url.pipe(index_1.populateUrl)), effect_1.Effect.andThen(CSV_COLUMNS), effect_1.Effect.map(formatCsvRow), effect_1.Effect.tap(effect_1.Console.log), effect_1.Effect.andThen(effect_1.Effect.repeat(monitorData(interval), { until: () => false })))).pipe(cli_1.Command.withDescription(`Poll CHT metrics.`));
//# sourceMappingURL=monitor.js.map