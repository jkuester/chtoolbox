"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitor = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const node_system_1 = require("../services/couch/node-system");
const dbs_info_1 = require("../services/couch/dbs-info");
const index_1 = require("../index");
const design_info_1 = require("../services/couch/design-info");
const DB_NAMES = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];
const VIEW_INDEXES_BY_DB = {
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
const getCouchNodeSystem = effect_1.Effect.flatMap(node_system_1.CouchNodeSystemService, (couchSystem) => couchSystem.get());
const getCouchDbsInfo = effect_1.Effect.flatMap(dbs_info_1.CouchDbsInfoService, (couchSystem) => couchSystem.get());
const getCouchDesignInfosForDb = (dbName) => design_info_1.CouchDesignInfoService.pipe(effect_1.Effect.flatMap(service => effect_1.Effect.all((0, effect_1.pipe)(VIEW_INDEXES_BY_DB[dbName], effect_1.Array.map(designName => service.get(dbName, designName))))));
const getCouchDesignInfos = (0, effect_1.pipe)(DB_NAMES, effect_1.Array.map(getCouchDesignInfosForDb), effect_1.Effect.all);
const getDbInfoColumnsForDb = (dbName) => [
    `${dbName}_sizes_file`,
    `${dbName}_sizes_active`,
    `${dbName}_compact_running`,
];
const getDbInfoColumns = () => (0, effect_1.pipe)(DB_NAMES, effect_1.Array.flatMap(getDbInfoColumnsForDb));
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
const getDesignInfoColumnsForDb = (dbName) => (0, effect_1.pipe)(VIEW_INDEXES_BY_DB[dbName], effect_1.Array.flatMap(designName => [
    `${dbName}_${designName}_compact_running`,
    `${dbName}_${designName}_updater_running`,
    `${dbName}_${designName}_sizes_file`,
    `${dbName}_${designName}_sizes_active`,
]));
const getDesignInfoColumns = () => (0, effect_1.pipe)(DB_NAMES, effect_1.Array.flatMap(getDesignInfoColumnsForDb));
const CSV_COLUMNS = [
    'unix_time',
    ...getDbInfoColumns(),
    ...NODE_SYSTEM_COLUMNS,
    ...getDesignInfoColumns(),
];
const getDbInfoData = (dbInfo) => [
    dbInfo?.info.sizes.file ?? -1,
    dbInfo?.info.sizes.active ?? -1,
    dbInfo?.info.compact_running ?? false,
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
const getDesignInfoData = (designInfo) => [
    designInfo.view_index.compact_running,
    designInfo.view_index.updater_running,
    designInfo.view_index.sizes.file,
    designInfo.view_index.sizes.active,
];
const getDesignInfosData = (designInfos) => (0, effect_1.pipe)(designInfos, effect_1.Array.flatMap(effect_1.Array.flatMap(getDesignInfoData)));
const getCsvData = ([unixTime, nodeSystem, dbsInfo, designInfos]) => [
    unixTime,
    ...(0, effect_1.pipe)(DB_NAMES, effect_1.Array.flatMap(getDbInfoForDbName(dbsInfo))),
    ...getNodeSystemData(nodeSystem),
    ...getDesignInfosData(designInfos),
];
const formatCsvRow = (row) => (0, effect_1.pipe)(row, effect_1.Array.map(value => String(value)), effect_1.Array.join(', '));
const monitorData = (interval) => effect_1.Effect
    .all([
    effect_1.Clock.currentTimeMillis.pipe(effect_1.Effect.map(effect_1.Number.unsafeDivide(1000)), effect_1.Effect.map(Math.floor)),
    getCouchNodeSystem,
    getCouchDbsInfo,
    getCouchDesignInfos
])
    .pipe(effect_1.Effect.map(getCsvData), effect_1.Effect.map(formatCsvRow), effect_1.Effect.tap(effect_1.Console.log), effect_1.Effect.delay(interval * 1000));
const interval = cli_1.Options
    .integer('interval')
    .pipe(cli_1.Options.withAlias('i'), cli_1.Options.withDescription('The interval in seconds to poll the data. Default is 1 second.'), cli_1.Options.withDefault(1));
exports.monitor = cli_1.Command
    .make('monitor', { interval }, ({ interval }) => (0, effect_1.pipe)(index_1.initializeUrl, effect_1.Effect.andThen(CSV_COLUMNS), effect_1.Effect.map(formatCsvRow), effect_1.Effect.tap(effect_1.Console.log), effect_1.Effect.andThen(effect_1.Effect.repeat(monitorData(interval), { until: () => false }))))
    .pipe(cli_1.Command.withDescription(`Poll CHT metrics.`));
//# sourceMappingURL=monitor.js.map