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
exports.MonitorService = void 0;
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const dbs_info_1 = require("../libs/couch/dbs-info");
const design_info_1 = require("../libs/couch/design-info");
const node_system_1 = require("./couch/node-system");
const effect_1 = require("effect");
const local_disk_usage_1 = require("./local-disk-usage");
const HttpClientError_1 = require("@effect/platform/HttpClientError");
const cht_client_1 = require("./cht-client");
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
const emptyDesignInfo = {
    name: '',
    view_index: {
        compact_running: false,
        updater_running: false,
        sizes: {
            file: 0,
            active: 0,
        },
    },
};
const getCouchDesignInfosForDb = (dbName) => Effect.all((0, effect_1.pipe)(VIEW_INDEXES_BY_DB[dbName], effect_1.Array.map(designName => (0, design_info_1.getDesignInfo)(dbName, designName)), effect_1.Array.map(Effect.catchIf((error) => error instanceof HttpClientError_1.ResponseError && error.response.status === 404, () => Effect.succeed(emptyDesignInfo)))));
const getCouchDesignInfos = () => (0, effect_1.pipe)(DB_NAMES, effect_1.Array.map(getCouchDesignInfosForDb), Effect.all);
const getDirectorySize = (directory) => local_disk_usage_1.LocalDiskUsageService.pipe(Effect.flatMap(service => directory.pipe(effect_1.Option.map(dir => service.getSize(dir)), effect_1.Option.getOrElse(() => Effect.succeed(null)))), Effect.map(effect_1.Option.fromNullable));
const getMonitoringData = (directory) => (0, effect_1.pipe)(Effect.all([
    currentTimeSec,
    (0, node_system_1.getCouchNodeSystem)(),
    (0, dbs_info_1.getDbsInfoByName)(DB_NAMES),
    getCouchDesignInfos(),
    getDirectorySize(directory),
]), Effect.map(([unixTime, nodeSystem, dbsInfo, designInfos, directory_size]) => ({
    ...nodeSystem,
    unix_time: unixTime,
    databases: dbsInfo.map((dbInfo, i) => ({
        ...dbInfo,
        designs: designInfos[i]
    })),
    directory_size
})));
const getCsvHeader = (directory) => [
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
    ...(directory.pipe(effect_1.Option.map(() => 'directory_size'), effect_1.Option.map(effect_1.Array.of), effect_1.Option.getOrElse(() => [])))
];
const getAsCsv = (directory) => (0, effect_1.pipe)(getMonitoringData(directory), Effect.map(data => [
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
    ...(data.directory_size.pipe(effect_1.Option.map(value => value.toString()), effect_1.Option.map(effect_1.Array.of), effect_1.Option.getOrElse(() => []))),
]));
const serviceContext = Effect
    .all([
    local_disk_usage_1.LocalDiskUsageService,
    cht_client_1.ChtClientService,
])
    .pipe(Effect.map(([localDiskUsage, chtClient,]) => Context
    .make(local_disk_usage_1.LocalDiskUsageService, localDiskUsage)
    .pipe(Context.add(cht_client_1.ChtClientService, chtClient))));
class MonitorService extends Effect.Service()('chtoolbox/MonitorService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        get: (directory) => getMonitoringData(directory)
            .pipe(Effect.provide(context)),
        getCsvHeader,
        getAsCsv: (directory) => getAsCsv(directory)
            .pipe(Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.MonitorService = MonitorService;
//# sourceMappingURL=monitor.js.map