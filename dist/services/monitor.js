import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { getDbsInfoByName } from '../libs/couch/dbs-info.js';
import { getDesignInfo } from '../libs/couch/design-info.js';
import { getCouchNodeSystem } from '../libs/couch/node-system.js';
import { Array, Clock, Number, Option, pipe } from 'effect';
import { LocalDiskUsageService } from './local-disk-usage.js';
import { ResponseError } from '@effect/platform/HttpClientError';
import { ChtClientService } from './cht-client.js';
import { getNouveauInfo } from '../libs/couch/nouveau-info.js';
import { getChtMonitoringData } from '../libs/cht/monitoring.js';
const currentTimeSec = Clock.currentTimeMillis.pipe(Effect.map(Number.unsafeDivide(1000)), Effect.map(Math.floor));
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
const getCouchDesignInfosForDb = (dbName) => Effect.all(pipe(VIEW_INDEXES_BY_DB[dbName], Array.map(designName => getDesignInfo(dbName, designName)), Array.map(Effect.catchIf((error) => error instanceof ResponseError && error.response.status === 404, () => Effect.succeed(emptyDesignInfo)))));
const getCouchDesignInfos = () => pipe(DB_NAMES, Array.map(getCouchDesignInfosForDb), Effect.all);
const NOUVEAU_INDEXES_BY_DB = {
    medic: [
        ['medic', 'contacts_by_freetext'],
        ['medic', 'reports_by_freetext'],
    ],
    'medic-sentinel': [],
    'medic-users-meta': [],
    '_users': [],
};
const emptyNouveauInfo = {
    name: '',
    search_index: {
        purge_seq: 0,
        update_seq: 0,
        disk_size: 0,
        num_docs: 0,
    },
};
const getNouveauInfosForDb = (dbName) => Effect.all(pipe(NOUVEAU_INDEXES_BY_DB[dbName], Array.map(([ddoc, index]) => getNouveauInfo(dbName, ddoc, index)), Array.map(Effect.catchIf((error) => error instanceof ResponseError && error.response.status === 404, () => Effect.succeed(emptyNouveauInfo)))));
const getNouveauInfos = () => pipe(DB_NAMES, Array.map(getNouveauInfosForDb), Effect.all);
const getDirectorySize = (directory) => LocalDiskUsageService.pipe(Effect.flatMap(service => directory.pipe(Option.map(dir => service.getSize(dir)), Option.getOrElse(() => Effect.succeed(null)))), Effect.map(Option.fromNullable));
const getChtMonitoring = () => getChtMonitoringData().pipe(Effect.catchAll((error) => {
    if (error instanceof ResponseError && error.response.status === 404) {
        return Effect.succeed({ version: { app: '', couchdb: '' } });
    }
    return Effect.fail(error);
}));
const getMonitoringData = (directory) => pipe(Effect.all([
    currentTimeSec,
    getCouchNodeSystem(),
    getDbsInfoByName(DB_NAMES),
    getCouchDesignInfos(),
    getNouveauInfos(),
    getDirectorySize(directory),
    getChtMonitoring()
]), Effect.map(([unixTime, nodeSystem, dbsInfo, designInfos, nouveauInfos, directory_size, { version }]) => ({
    ...nodeSystem,
    unix_time: unixTime,
    version,
    databases: dbsInfo.map((dbInfo, i) => ({
        ...dbInfo,
        designs: designInfos[i],
        nouveau_indexes: nouveauInfos[i],
    })),
    directory_size
})));
const getCsvHeader = (directory) => [
    'unix_time',
    'version_app',
    'version_couchdb',
    ...DB_NAMES.flatMap(dbName => [
        `${dbName}_sizes_file`,
        `${dbName}_sizes_active`,
        `${dbName}_compact_running`,
        ...VIEW_INDEXES_BY_DB[dbName].flatMap(designName => [
            `${dbName}_${designName}_compact_running`,
            `${dbName}_${designName}_updater_running`,
            `${dbName}_${designName}_sizes_file`,
            `${dbName}_${designName}_sizes_active`,
        ]),
        ...NOUVEAU_INDEXES_BY_DB[dbName].flatMap(([ddoc, index]) => [
            `${dbName}_${ddoc}_${index}_num_docs`,
            `${dbName}_${ddoc}_${index}_disk_size`,
        ]),
    ]),
    'memory_processes_used',
    'memory_binary',
    ...(directory.pipe(Option.map(() => 'directory_size'), Option.map(Array.of), Option.getOrElse(() => []))),
];
const getAsCsv = (directory) => pipe(getMonitoringData(directory), Effect.map(data => [
    data.unix_time.toString(),
    data.version.app,
    data.version.couchdb,
    ...data.databases.flatMap(db => [
        db.info.sizes.file.toString(),
        db.info.sizes.active.toString(),
        db.info.compact_running.toString(),
        ...db.designs.flatMap(design => [
            design.view_index.compact_running.toString(),
            design.view_index.updater_running.toString(),
            design.view_index.sizes.file.toString(),
            design.view_index.sizes.active.toString(),
        ]),
        ...db.nouveau_indexes.flatMap(nouveauInfo => [
            nouveauInfo.search_index.num_docs.toString(),
            nouveauInfo.search_index.disk_size.toString(),
        ]),
    ]),
    data.memory.processes_used.toString(),
    data.memory.binary.toString(),
    ...(data.directory_size.pipe(Option.map(value => value.toString()), Option.map(Array.of), Option.getOrElse(() => []))),
]));
const serviceContext = Effect
    .all([
    LocalDiskUsageService,
    ChtClientService,
])
    .pipe(Effect.map(([localDiskUsage, chtClient,]) => Context
    .make(LocalDiskUsageService, localDiskUsage)
    .pipe(Context.add(ChtClientService, chtClient))));
export class MonitorService extends Effect.Service()('chtoolbox/MonitorService', {
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
//# sourceMappingURL=monitor.js.map