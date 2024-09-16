"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitorServiceLive = exports.MonitorService = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const dbs_info_1 = require("./couch/dbs-info");
const design_info_1 = require("./couch/design-info");
const node_system_1 = require("./couch/node-system");
const effect_1 = require("effect");
exports.MonitorService = Context.GenericTag('chtoolbox/MonitorService');
const currentTimeSec = effect_1.Clock.currentTimeMillis.pipe(Effect.map(effect_1.Number.unsafeDivide(1000)), Effect.map(Math.floor));
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
const getCouchNodeSystem = Effect.flatMap(node_system_1.CouchNodeSystemService, (couchSystem) => couchSystem.get());
const getCouchDbsInfo = Effect.flatMap(dbs_info_1.CouchDbsInfoService, (couchSystem) => couchSystem.get());
const getCouchDesignInfosForDb = (dbName) => design_info_1.CouchDesignInfoService.pipe(Effect.flatMap(service => Effect.all((0, effect_1.pipe)(VIEW_INDEXES_BY_DB[dbName], effect_1.Array.map(designName => service.get(dbName, designName))))));
const getCouchDesignInfos = (0, effect_1.pipe)(DB_NAMES, effect_1.Array.map(getCouchDesignInfosForDb), Effect.all);
const getMonitoringData = (0, effect_1.pipe)(Effect.all([
    currentTimeSec,
    getCouchNodeSystem,
    getCouchDbsInfo,
    getCouchDesignInfos
]), Effect.map(([unixTime, nodeSystem, dbsInfo, designInfos]) => ({
    ...nodeSystem,
    unix_time: unixTime,
    databases: dbsInfo.map((dbInfo, i) => ({
        ...dbInfo,
        designs: designInfos[i]
    })),
})), x => x);
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
const getAsCsv = () => (0, effect_1.pipe)(getMonitoringData, Effect.map(data => [
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
]));
const createMonitorService = (0, effect_1.pipe)(exports.MonitorService.of({
    get: () => getMonitoringData,
    getCsvHeader,
    getAsCsv,
}));
exports.MonitorServiceLive = Layer.succeed(exports.MonitorService, createMonitorService);
//# sourceMappingURL=monitor.js.map