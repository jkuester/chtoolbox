import { afterEach, describe, it } from 'mocha';
import { Effect, Either, Layer, Option, TestClock } from 'effect';
import { expect } from 'chai';
import * as MonitorSvc from '../../src/services/monitor.ts';
import { CouchNodeSystem } from '../../src/libs/couch/node-system.ts';
import { type SinonStub } from 'sinon';
import { CouchDbInfo } from '../../src/libs/couch/dbs-info.ts';
import { CouchDesignInfo } from '../../src/libs/couch/design-info.ts';
import { LocalDiskUsageService } from '../../src/services/local-disk-usage.ts';
import { createDbInfo, createDesignInfo, createNodeSystem, createNouveauInfo, createChtMonitoringData } from '../utils/data-models.ts';
import { ResponseError } from '@effect/platform/HttpClientError';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import { type NonEmptyArray } from 'effect/Array';
import { genWithLayer, sandbox } from '../utils/base.ts';
import { ChtClientService } from '../../src/services/cht-client.ts';
import esmock from 'esmock';
import { NouveauInfo } from '../../src/libs/couch/nouveau-info.ts';
import { ChtMonitoringData } from '../../src/libs/cht/monitoring.ts';

const DB_NAMES: NonEmptyArray<string> = ['medic', 'medic-sentinel', 'medic-users-meta', '_users'];
const EXPECTED_DESIGN_INFO_ARGS = [
  ['medic', 'medic'],
  ['medic', 'medic-admin'],
  ['medic', 'medic-client'],
  ['medic', 'medic-conflicts'],
  ['medic', 'medic-scripts'],
  ['medic', 'medic-sms'],
  ['medic', ':staged:medic'],
  ['medic', ':staged:medic-admin'],
  ['medic', ':staged:medic-client'],
  ['medic', ':staged:medic-conflicts'],
  ['medic', ':staged:medic-scripts'],
  ['medic', ':staged:medic-sms'],
  ['medic-sentinel', 'sentinel'],
  ['medic-sentinel', ':staged:sentinel'],
  ['medic-users-meta', 'users-meta'],
  ['medic-users-meta', ':staged:users-meta'],
  ['_users', 'users'],
  ['_users', ':staged:users'],
];
const EXPECTED_NOUVEAU_INFO_ARGS = [
  ['medic', 'medic', 'contacts_by_freetext'],
  ['medic', 'medic', 'reports_by_freetext'],
];

const nodeSystem = createNodeSystem({
  processes_used: 324116345634,
  binary: 34,
});
const medicDbInfo = createDbInfo({ key: 'medic', compact_running: true, file: 123, active: 234 });
const sentinelDbInfo = createDbInfo({ key: 'medic-sentinel', file: 12 });
const usersMetaDbInfo = createDbInfo({ key: 'medic-users-meta', compact_running: true, active: 23412 });
const usersDbInfo = createDbInfo({ key: '_users', compact_running: true, file: 54, active: 23232 });
const medicDesignInfo = createDesignInfo({
  name: 'medic',
  compact_running: true,
  updater_running: true,
  file: 123,
  active: 234
});
const medicStagedDesignInfo = createDesignInfo({
  name: ':staged:medic',
  compact_running: true,
  updater_running: true,
  file: 1234523,
  active: 23453434
});
const medicAdminDesignInfo = createDesignInfo({ name: 'medic-admin', compact_running: true, file: 135232423 });
const medicAdminStagedDesignInfo = createDesignInfo({ name: ':staged:medic-admin', compact_running: true });
const medicClientDesignInfo = createDesignInfo({ name: 'medic-client', updater_running: true, active: 12345232 });
const medicClientStagedDesignInfo = createDesignInfo({ name: ':staged:medic-client', active: 122342345232 });
const medicConflictsDesignInfo = createDesignInfo({ name: 'medic-conflicts', file: 1212121, active: 42334534534});
const medicConflictsStagedDesignInfo = createDesignInfo({ name: ':staged:medic-conflicts', file: 121244121, });
const medicScriptsDesignInfo = createDesignInfo({ name: 'medic-scripts', file: 312121212 });
const medicScriptsStagedDesignInfo = createDesignInfo({ name: ':staged:medic-scripts', active: 2 });
const medicSmsDesignInfo = createDesignInfo({ name: 'medic-sms', active: 1 });
const medicSmsStagedDesignInfo = createDesignInfo({ name: ':staged:medic-sms', file: 1 });
const sentinelDesignInfo = createDesignInfo({ name: 'sentinel' });
const sentinelStagedDesignInfo = createDesignInfo({ name: ':staged:sentinel' });
const usersMetaDesignInfo = createDesignInfo({ name: 'users-meta' });
const usersMetaStagedDesignInfo = createDesignInfo({ name: ':staged:users-meta' });
const usersDesignInfo = createDesignInfo({
  name: 'users',
  compact_running: true,
  updater_running: true,
  file: 12323234444,
  active: 23422232
});
const usersStagedDesignInfo = createDesignInfo({
  name: ':staged:users',
  compact_running: true,
  updater_running: true,
  file: 1,
  active: 1
});
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

const initializeDesignInfoServiceGet = (designInfoServiceGet: SinonStub) => {
  designInfoServiceGet.withArgs('medic', 'medic').returns(Effect.succeed(medicDesignInfo));
  designInfoServiceGet.withArgs('medic', ':staged:medic').returns(Effect.succeed(medicStagedDesignInfo));
  designInfoServiceGet.withArgs('medic', 'medic-admin').returns(Effect.succeed(medicAdminDesignInfo));
  designInfoServiceGet.withArgs('medic', ':staged:medic-admin').returns(Effect.succeed(medicAdminStagedDesignInfo));
  designInfoServiceGet.withArgs('medic', 'medic-client').returns(Effect.succeed(medicClientDesignInfo));
  designInfoServiceGet
    .withArgs('medic', ':staged:medic-client')
    .returns(Effect.succeed(medicClientStagedDesignInfo));
  designInfoServiceGet.withArgs('medic', 'medic-conflicts').returns(Effect.succeed(medicConflictsDesignInfo));
  designInfoServiceGet
    .withArgs('medic', ':staged:medic-conflicts')
    .returns(Effect.succeed(medicConflictsStagedDesignInfo));
  designInfoServiceGet.withArgs('medic', 'medic-scripts').returns(Effect.succeed(medicScriptsDesignInfo));
  designInfoServiceGet
    .withArgs('medic', ':staged:medic-scripts')
    .returns(Effect.succeed(medicScriptsStagedDesignInfo));
  designInfoServiceGet.withArgs('medic', 'medic-sms').returns(Effect.succeed(medicSmsDesignInfo));
  designInfoServiceGet.withArgs('medic', ':staged:medic-sms').returns(Effect.succeed(medicSmsStagedDesignInfo));
  designInfoServiceGet.withArgs('medic-sentinel', 'sentinel').returns(Effect.succeed(sentinelDesignInfo));
  designInfoServiceGet
    .withArgs('medic-sentinel', ':staged:sentinel')
    .returns(Effect.succeed(sentinelStagedDesignInfo));
  designInfoServiceGet.withArgs('medic-users-meta', 'users-meta').returns(Effect.succeed(usersMetaDesignInfo));
  designInfoServiceGet
    .withArgs('medic-users-meta', ':staged:users-meta')
    .returns(Effect.succeed(usersMetaStagedDesignInfo));
  designInfoServiceGet.withArgs('_users', 'users').returns(Effect.succeed(usersDesignInfo));
  designInfoServiceGet.withArgs('_users', ':staged:users').returns(Effect.succeed(usersStagedDesignInfo));
};

const contactsByFreetextNouveauInfo = createNouveauInfo({
  name: '_design/medic/contacts_by_freetext',
  update_seq: 123,
  purge_seq: 456,
  num_docs: 789,
  disk_size: 1024,
});
const reportsByFreetextNouveauInfo = createNouveauInfo({
  name: '_design/medic/reports_by_freetext',
  update_seq: 321,
  purge_seq: 654,
  num_docs: 987,
  disk_size: 4201,
});
const emptyNouveauInfo = createNouveauInfo();
const initializeGetNouveauInfo = (getNouveauInfo: SinonStub) => {
  getNouveauInfo
    .withArgs('medic', 'medic', 'contacts_by_freetext')
    .returns(Effect.succeed(contactsByFreetextNouveauInfo));
  getNouveauInfo
    .withArgs('medic', 'medic', 'reports_by_freetext')
    .returns(Effect.succeed(reportsByFreetextNouveauInfo));
};
const chtMonitoringData = createChtMonitoringData({
  versionApp: 'app-version',
  versionCouchDb: 'couchdb-version',
});

const mockNodeSystemLib = { getCouchNodeSystem: sandbox.stub() };
const mockDesignInfoLib = { getDesignInfo: sandbox.stub() };
const mockNouveauInfoLib = { getNouveauInfo: sandbox.stub() };
const mockDbsInfoLib = { getDbsInfoByName: sandbox.stub() };
const mockChtMonitoringLib = { getChtMonitoringData: sandbox.stub() };
const diskUsageServiceGetSize = sandbox.stub();

const { MonitorService } = await esmock<typeof MonitorSvc>('../../src/services/monitor.ts', {
  '../../src/libs/couch/node-system.ts': mockNodeSystemLib,
  '../../src/libs/couch/dbs-info.ts': mockDbsInfoLib,
  '../../src/libs/couch/design-info.ts': mockDesignInfoLib,
  '../../src/libs/couch/nouveau-info.ts': mockNouveauInfoLib,
  '../../src/libs/cht/monitoring.ts': mockChtMonitoringLib,
});
const run = MonitorService.Default.pipe(
  Layer.provide(Layer.succeed(ChtClientService, {} as unknown as ChtClientService)),
  Layer.provide(Layer.succeed(LocalDiskUsageService, {
    getSize: diskUsageServiceGetSize,
  } as unknown as LocalDiskUsageService)),
  genWithLayer,
);

describe('Monitor service', () => {

  describe('get', () => {
    it('returns empty monitoring data', run(function* () {
      const nodeSystem = createNodeSystem();
      mockNodeSystemLib.getCouchNodeSystem.returns(Effect.succeed(nodeSystem));
      mockDbsInfoLib.getDbsInfoByName.returns(Effect.succeed([]));
      mockDesignInfoLib.getDesignInfo.returns(Effect.void);
      mockNouveauInfoLib.getNouveauInfo.returns(Effect.void);
      mockChtMonitoringLib.getChtMonitoringData.returns(Effect.succeed(createChtMonitoringData()));
      diskUsageServiceGetSize.returns(Effect.succeed(0));

      const data = yield* MonitorService.get(Option.none());

      expect(data).to.deep.equal({
        ...nodeSystem,
        unix_time: yield* TestClock.currentTimeMillis,
        version: {
          app: '',
          couchdb: '',
        },
        databases: [],
        directory_size: Option.none(),
      });
      expect(mockNodeSystemLib.getCouchNodeSystem.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getDbsInfoByName.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(mockNouveauInfoLib.getNouveauInfo.args).to.deep.equal(EXPECTED_NOUVEAU_INFO_ARGS);
      expect(mockChtMonitoringLib.getChtMonitoringData.calledOnceWithExactly()).to.be.true;
      expect(diskUsageServiceGetSize.notCalled).to.be.true;
    }));

    it('returns complete monitoring data', run(function* () {
      mockNodeSystemLib.getCouchNodeSystem.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(unix_time * 1000);
      mockDbsInfoLib.getDbsInfoByName.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      initializeDesignInfoServiceGet(mockDesignInfoLib.getDesignInfo);
      initializeGetNouveauInfo(mockNouveauInfoLib.getNouveauInfo);
      const directory = 'directory';
      const directorySize = 444444;
      diskUsageServiceGetSize.returns(Effect.succeed(directorySize));
      mockChtMonitoringLib.getChtMonitoringData.returns(Effect.succeed(chtMonitoringData));

      const data = yield* MonitorService.get(Option.some(directory));

      expect(data).to.deep.equal({
        ...nodeSystem,
        unix_time,
        version: chtMonitoringData.version,
        databases: [
          {
            ...medicDbInfo,
            designs: [
              medicDesignInfo,
              medicAdminDesignInfo,
              medicClientDesignInfo,
              medicConflictsDesignInfo,
              medicScriptsDesignInfo,
              medicSmsDesignInfo,
              medicStagedDesignInfo,
              medicAdminStagedDesignInfo,
              medicClientStagedDesignInfo,
              medicConflictsStagedDesignInfo,
              medicScriptsStagedDesignInfo,
              medicSmsStagedDesignInfo,
            ],
            nouveau_indexes: [
              contactsByFreetextNouveauInfo,
              reportsByFreetextNouveauInfo
            ]
          },
          { ...sentinelDbInfo, designs: [sentinelDesignInfo, sentinelStagedDesignInfo], nouveau_indexes: [] },
          { ...usersMetaDbInfo, designs: [usersMetaDesignInfo, usersMetaStagedDesignInfo], nouveau_indexes: [] },
          { ...usersDbInfo, designs: [usersDesignInfo, usersStagedDesignInfo], nouveau_indexes: [] },
        ],
        directory_size: Option.some(directorySize),
      });
      expect(mockNodeSystemLib.getCouchNodeSystem.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getDbsInfoByName.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(mockNouveauInfoLib.getNouveauInfo.args).to.deep.equal(EXPECTED_NOUVEAU_INFO_ARGS);
      expect(mockChtMonitoringLib.getChtMonitoringData.calledOnceWithExactly()).to.be.true;
      expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
    }));

    it('includes empty data for calls that 404', run(function* () {
      mockNodeSystemLib.getCouchNodeSystem.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(unix_time * 1000);
      mockDbsInfoLib.getDbsInfoByName.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic').returns(Effect.succeed(medicDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-admin').returns(Effect.succeed(medicAdminDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-client').returns(Effect.succeed(medicClientDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-conflicts').returns(Effect.succeed(medicConflictsDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-scripts').returns(Effect.succeed(medicScriptsDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-sms').returns(Effect.succeed(medicSmsDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic-sentinel', 'sentinel').returns(Effect.succeed(sentinelDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic-users-meta', 'users-meta').returns(Effect.succeed(usersMetaDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('_users', 'users').returns(Effect.succeed(usersDesignInfo));
      mockDesignInfoLib.getDesignInfo.returns(Effect.fail(new ResponseError({
        request: {} as unknown as HttpClientRequest.HttpClientRequest,
        response: { status: 404 } as unknown as HttpClientResponse.HttpClientResponse,
        reason: 'StatusCode'
      })));
      mockNouveauInfoLib.getNouveauInfo
        .withArgs('medic', 'medic', 'contacts_by_freetext')
        .returns(Effect.succeed(contactsByFreetextNouveauInfo))
      mockNouveauInfoLib.getNouveauInfo.returns(Effect.fail(new ResponseError({
        request: {} as unknown as HttpClientRequest.HttpClientRequest,
        response: { status: 404 } as unknown as HttpClientResponse.HttpClientResponse,
        reason: 'StatusCode'
      })));
      mockChtMonitoringLib.getChtMonitoringData.returns(Effect.fail(new ResponseError({
        request: {} as unknown as HttpClientRequest.HttpClientRequest,
        response: { status: 404 } as unknown as HttpClientResponse.HttpClientResponse,
        reason: 'StatusCode'
      })));

      const directory = 'directory';
      const directorySize = 444444;
      diskUsageServiceGetSize.returns(Effect.succeed(directorySize));

      const data = yield* MonitorService.get(Option.some(directory));

      expect(data).to.deep.equal({
        ...nodeSystem,
        unix_time,
        version: {
          app: '',
          couchdb: '',
        },
        databases: [
          {
            ...medicDbInfo,
            designs: [
              medicDesignInfo,
              medicAdminDesignInfo,
              medicClientDesignInfo,
              medicConflictsDesignInfo,
              medicScriptsDesignInfo,
              medicSmsDesignInfo,
              emptyDesignInfo,
              emptyDesignInfo,
              emptyDesignInfo,
              emptyDesignInfo,
              emptyDesignInfo,
              emptyDesignInfo,
            ],
            nouveau_indexes: [ contactsByFreetextNouveauInfo, emptyNouveauInfo ]
          },
          { ...sentinelDbInfo, designs: [sentinelDesignInfo, emptyDesignInfo], nouveau_indexes: [] },
          { ...usersMetaDbInfo, designs: [usersMetaDesignInfo, emptyDesignInfo], nouveau_indexes: [] },
          { ...usersDbInfo, designs: [usersDesignInfo, emptyDesignInfo], nouveau_indexes: [] },
        ],
        directory_size: Option.some(directorySize),
      });
      expect(mockNodeSystemLib.getCouchNodeSystem.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getDbsInfoByName.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(mockNouveauInfoLib.getNouveauInfo.args).to.deep.equal(EXPECTED_NOUVEAU_INFO_ARGS);
      expect(mockChtMonitoringLib.getChtMonitoringData.calledOnceWithExactly()).to.be.true;
      expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
    }));

    it('fails when a non-404 error is thrown getting design infos', run(function* () {
      mockNodeSystemLib.getCouchNodeSystem.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(unix_time * 1000);
      mockDbsInfoLib.getDbsInfoByName.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic').returns(Effect.succeed(medicDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-admin').returns(Effect.succeed(medicAdminDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-client').returns(Effect.succeed(medicClientDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-conflicts').returns(Effect.succeed(medicConflictsDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-scripts').returns(Effect.succeed(medicScriptsDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-sms').returns(Effect.succeed(medicSmsDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic-sentinel', 'sentinel').returns(Effect.succeed(sentinelDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic-users-meta', 'users-meta').returns(Effect.succeed(usersMetaDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('_users', 'users').returns(Effect.succeed(usersDesignInfo));
      const expectedError = new ResponseError({
        request: {} as unknown as HttpClientRequest.HttpClientRequest,
        response: { status: 500 } as unknown as HttpClientResponse.HttpClientResponse,
        reason: 'StatusCode'
      });
      mockDesignInfoLib.getDesignInfo.returns(Effect.fail(expectedError));
      mockNouveauInfoLib.getNouveauInfo
                        .withArgs('medic', 'medic', 'contacts_by_freetext')
                        .returns(Effect.succeed(contactsByFreetextNouveauInfo))
      mockNouveauInfoLib.getNouveauInfo.returns(Effect.fail(new ResponseError({
        request: {} as unknown as HttpClientRequest.HttpClientRequest,
        response: { status: 404 } as unknown as HttpClientResponse.HttpClientResponse,
        reason: 'StatusCode'
      })));

      const directory = 'directory';
      const directorySize = 444444;
      mockChtMonitoringLib.getChtMonitoringData.returns(Effect.succeed(chtMonitoringData));
      diskUsageServiceGetSize.returns(Effect.succeed(directorySize));

      const failureOrSuccess = yield* Effect.either(MonitorService.get(Option.some(directory)));

      if (Either.isLeft(failureOrSuccess)) {
        const error = failureOrSuccess.left;
        expect(error).to.equal(expectedError);

        expect(mockNodeSystemLib.getCouchNodeSystem.calledOnceWithExactly()).to.be.true;
        expect(mockDbsInfoLib.getDbsInfoByName.calledOnceWithExactly(DB_NAMES)).to.be.true;
        expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
        expect(mockNouveauInfoLib.getNouveauInfo.args).to.deep.equal(EXPECTED_NOUVEAU_INFO_ARGS);
        expect(mockChtMonitoringLib.getChtMonitoringData.calledOnceWithExactly()).to.be.true;
        expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
      } else {
        expect.fail('Expected error to be thrown');
      }
    }));

    it('fails when a non-404 error is thrown getting CHT monitoring data', run(function* () {
      mockNodeSystemLib.getCouchNodeSystem.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(unix_time * 1000);
      mockDbsInfoLib.getDbsInfoByName.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      initializeDesignInfoServiceGet(mockDesignInfoLib.getDesignInfo);
      initializeGetNouveauInfo(mockNouveauInfoLib.getNouveauInfo);
      const directory = 'directory';
      const directorySize = 444444;
      diskUsageServiceGetSize.returns(Effect.succeed(directorySize));
      const expectedError = new ResponseError({
        request: {} as unknown as HttpClientRequest.HttpClientRequest,
        response: { status: 500 } as unknown as HttpClientResponse.HttpClientResponse,
        reason: 'StatusCode'
      });
      mockChtMonitoringLib.getChtMonitoringData.returns(Effect.fail(expectedError));

      const failureOrSuccess = yield* Effect.either(MonitorService.get(Option.some(directory)));
      if (Either.isRight(failureOrSuccess)) {
        expect.fail('Expected error to be thrown');
      }

      const error = failureOrSuccess.left;
      expect(error).to.equal(expectedError);
      expect(mockNodeSystemLib.getCouchNodeSystem.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getDbsInfoByName.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(mockNouveauInfoLib.getNouveauInfo.args).to.deep.equal(EXPECTED_NOUVEAU_INFO_ARGS);
      expect(mockChtMonitoringLib.getChtMonitoringData.calledOnceWithExactly()).to.be.true;
      expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
    }));

    it('trims milliseconds from unix_time value', run(function* () {
      const nodeSystem = createNodeSystem();
      mockNodeSystemLib.getCouchNodeSystem.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(123456789458);
      mockDbsInfoLib.getDbsInfoByName.returns(Effect.succeed([]));
      mockDesignInfoLib.getDesignInfo.returns(Effect.void);
      mockNouveauInfoLib.getNouveauInfo.returns(Effect.void);
      mockChtMonitoringLib.getChtMonitoringData.returns(Effect.succeed(createChtMonitoringData()));
      diskUsageServiceGetSize.returns(Effect.succeed(0));

      const data = yield* MonitorService.get(Option.none());

      expect(data).to.deep.equal({
        ...nodeSystem,
        unix_time,
        version: {
          app: '',
          couchdb: '',
        },
        databases: [],
        directory_size: Option.none(),
      });
      expect(mockNodeSystemLib.getCouchNodeSystem.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getDbsInfoByName.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(mockNouveauInfoLib.getNouveauInfo.args).to.deep.equal(EXPECTED_NOUVEAU_INFO_ARGS);
      expect(mockChtMonitoringLib.getChtMonitoringData.calledOnceWithExactly()).to.be.true;
      expect(diskUsageServiceGetSize.notCalled).to.be.true;
    }));
  });

  describe('getAsCsv', () => {
    const getDbInfoCsvData = (dbInfo: CouchDbInfo) => [
      dbInfo.info.sizes.file.toString(),
      dbInfo.info.sizes.active.toString(),
      dbInfo.info.compact_running.toString(),
    ];

    const getDesignInfoCsvData = (designInfo: CouchDesignInfo) => [
      designInfo.view_index.compact_running.toString(),
      designInfo.view_index.updater_running.toString(),
      designInfo.view_index.sizes.file.toString(),
      designInfo.view_index.sizes.active.toString(),
    ];

    const getNouveauInfoCsvData = (nouveauInfo: NouveauInfo) => [
      nouveauInfo.search_index.num_docs.toString(),
      nouveauInfo.search_index.disk_size.toString(),
    ];

    const getNodeSystemCsvData = (nodeSystem: CouchNodeSystem) => [
      nodeSystem.memory.processes_used.toString(),
      nodeSystem.memory.binary.toString(),
    ];

    const getChtMonitoringCsvData = (chtMonitoringData: ChtMonitoringData) => [
      chtMonitoringData.version.app,
      chtMonitoringData.version.couchdb,
    ];

    const expectedCsvData = [
      ...getChtMonitoringCsvData(chtMonitoringData),
      ...getDbInfoCsvData(medicDbInfo),
      ...getDesignInfoCsvData(medicDesignInfo),
      ...getDesignInfoCsvData(medicAdminDesignInfo),
      ...getDesignInfoCsvData(medicClientDesignInfo),
      ...getDesignInfoCsvData(medicConflictsDesignInfo),
      ...getDesignInfoCsvData(medicScriptsDesignInfo),
      ...getDesignInfoCsvData(medicSmsDesignInfo),
      ...getDesignInfoCsvData(medicStagedDesignInfo),
      ...getDesignInfoCsvData(medicAdminStagedDesignInfo),
      ...getDesignInfoCsvData(medicClientStagedDesignInfo),
      ...getDesignInfoCsvData(medicConflictsStagedDesignInfo),
      ...getDesignInfoCsvData(medicScriptsStagedDesignInfo),
      ...getDesignInfoCsvData(medicSmsStagedDesignInfo),
      ...getNouveauInfoCsvData(contactsByFreetextNouveauInfo),
      ...getNouveauInfoCsvData(reportsByFreetextNouveauInfo),
      ...getDbInfoCsvData(sentinelDbInfo),
      ...getDesignInfoCsvData(sentinelDesignInfo),
      ...getDesignInfoCsvData(sentinelStagedDesignInfo),
      ...getDbInfoCsvData(usersMetaDbInfo),
      ...getDesignInfoCsvData(usersMetaDesignInfo),
      ...getDesignInfoCsvData(usersMetaStagedDesignInfo),
      ...getDbInfoCsvData(usersDbInfo),
      ...getDesignInfoCsvData(usersDesignInfo),
      ...getDesignInfoCsvData(usersStagedDesignInfo),
      ...getNodeSystemCsvData(nodeSystem),
    ];

    it('returns complete monitoring data', run(function* () {
      mockNodeSystemLib.getCouchNodeSystem.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(unix_time * 1000);
      mockDbsInfoLib.getDbsInfoByName.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      initializeDesignInfoServiceGet(mockDesignInfoLib.getDesignInfo);
      initializeGetNouveauInfo(mockNouveauInfoLib.getNouveauInfo);
      mockChtMonitoringLib.getChtMonitoringData.returns(Effect.succeed(chtMonitoringData));
      const directory = 'directory';
      const directorySize = 444444;
      diskUsageServiceGetSize.returns(Effect.succeed(directorySize));

      const data = yield* MonitorService.getAsCsv(Option.some(directory));
      expect(data).to.deep.equal([unix_time.toString(), ...expectedCsvData, directorySize.toString()]);
      expect(mockNodeSystemLib.getCouchNodeSystem.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getDbsInfoByName.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(mockNouveauInfoLib.getNouveauInfo.args).to.deep.equal(EXPECTED_NOUVEAU_INFO_ARGS);
      expect(mockChtMonitoringLib.getChtMonitoringData.calledOnceWithExactly()).to.be.true;
      expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
    }));

    it('includes empty data for designs that do not exist', run(function* () {
      mockNodeSystemLib.getCouchNodeSystem.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(unix_time * 1000);
      mockDbsInfoLib.getDbsInfoByName.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic').returns(Effect.succeed(medicDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-admin').returns(Effect.succeed(medicAdminDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-client').returns(Effect.succeed(medicClientDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-conflicts').returns(Effect.succeed(medicConflictsDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-scripts').returns(Effect.succeed(medicScriptsDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic', 'medic-sms').returns(Effect.succeed(medicSmsDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic-sentinel', 'sentinel').returns(Effect.succeed(sentinelDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('medic-users-meta', 'users-meta').returns(Effect.succeed(usersMetaDesignInfo));
      mockDesignInfoLib.getDesignInfo.withArgs('_users', 'users').returns(Effect.succeed(usersDesignInfo));
      mockDesignInfoLib.getDesignInfo.returns(Effect.fail(new ResponseError({
        request: {} as unknown as HttpClientRequest.HttpClientRequest,
        response: { status: 404 } as unknown as HttpClientResponse.HttpClientResponse,
        reason: 'StatusCode'
      })));
      mockNouveauInfoLib.getNouveauInfo
        .withArgs('medic', 'medic', 'contacts_by_freetext')
        .returns(Effect.succeed(contactsByFreetextNouveauInfo))
      mockNouveauInfoLib.getNouveauInfo.returns(Effect.fail(new ResponseError({
        request: {} as unknown as HttpClientRequest.HttpClientRequest,
        response: { status: 404 } as unknown as HttpClientResponse.HttpClientResponse,
        reason: 'StatusCode'
      })));
      mockChtMonitoringLib.getChtMonitoringData.returns(Effect.fail(new ResponseError({
        request: {} as unknown as HttpClientRequest.HttpClientRequest,
        response: { status: 404 } as unknown as HttpClientResponse.HttpClientResponse,
        reason: 'StatusCode'
      })));
      const directory = 'directory';
      const directorySize = 444444;
      diskUsageServiceGetSize.returns(Effect.succeed(directorySize));

      const data = yield* MonitorService.getAsCsv(Option.some(directory));

      const expectedCsvData = [
        unix_time.toString(),
        ...getChtMonitoringCsvData(createChtMonitoringData()),
        ...getDbInfoCsvData(medicDbInfo),
        ...getDesignInfoCsvData(medicDesignInfo),
        ...getDesignInfoCsvData(medicAdminDesignInfo),
        ...getDesignInfoCsvData(medicClientDesignInfo),
        ...getDesignInfoCsvData(medicConflictsDesignInfo),
        ...getDesignInfoCsvData(medicScriptsDesignInfo),
        ...getDesignInfoCsvData(medicSmsDesignInfo),
        ...getDesignInfoCsvData(emptyDesignInfo),
        ...getDesignInfoCsvData(emptyDesignInfo),
        ...getDesignInfoCsvData(emptyDesignInfo),
        ...getDesignInfoCsvData(emptyDesignInfo),
        ...getDesignInfoCsvData(emptyDesignInfo),
        ...getDesignInfoCsvData(emptyDesignInfo),
        ...getNouveauInfoCsvData(contactsByFreetextNouveauInfo),
        ...getNouveauInfoCsvData(emptyNouveauInfo),
        ...getDbInfoCsvData(sentinelDbInfo),
        ...getDesignInfoCsvData(sentinelDesignInfo),
        ...getDesignInfoCsvData(emptyDesignInfo),
        ...getDbInfoCsvData(usersMetaDbInfo),
        ...getDesignInfoCsvData(usersMetaDesignInfo),
        ...getDesignInfoCsvData(emptyDesignInfo),
        ...getDbInfoCsvData(usersDbInfo),
        ...getDesignInfoCsvData(usersDesignInfo),
        ...getDesignInfoCsvData(emptyDesignInfo),
        ...getNodeSystemCsvData(nodeSystem),
        directorySize.toString(),
      ];
      expect(data).to.deep.equal(expectedCsvData);
      expect(mockNodeSystemLib.getCouchNodeSystem.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getDbsInfoByName.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(mockNouveauInfoLib.getNouveauInfo.args).to.deep.equal(EXPECTED_NOUVEAU_INFO_ARGS);
      expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
    }));

    it('does not include directory_size column when no directory provided', run(function* () {
      mockNodeSystemLib.getCouchNodeSystem.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(123456789458);
      mockDbsInfoLib.getDbsInfoByName.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      mockChtMonitoringLib.getChtMonitoringData.returns(Effect.succeed(chtMonitoringData));
      initializeDesignInfoServiceGet(mockDesignInfoLib.getDesignInfo);
      initializeGetNouveauInfo(mockNouveauInfoLib.getNouveauInfo);

      const data = yield* MonitorService.getAsCsv(Option.none());

      expect(data).to.deep.equal([unix_time.toString(), ...expectedCsvData]);
      expect(mockNodeSystemLib.getCouchNodeSystem.calledOnceWithExactly()).to.be.true;
      expect(mockDbsInfoLib.getDbsInfoByName.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(mockNouveauInfoLib.getNouveauInfo.args).to.deep.equal(EXPECTED_NOUVEAU_INFO_ARGS);
      expect(mockChtMonitoringLib.getChtMonitoringData.calledOnceWithExactly()).to.be.true;
      expect(diskUsageServiceGetSize.notCalled).to.be.true;
    }));
  });

  describe('getCsvHeader', () => {
    const expectedCsvHeader = [
      'unix_time',
      'version_app',
      'version_couchdb',
      'medic_sizes_file',
      'medic_sizes_active',
      'medic_compact_running',
      `medic_medic_compact_running`,
      `medic_medic_updater_running`,
      `medic_medic_sizes_file`,
      `medic_medic_sizes_active`,
      `medic_medic-admin_compact_running`,
      `medic_medic-admin_updater_running`,
      `medic_medic-admin_sizes_file`,
      `medic_medic-admin_sizes_active`,
      `medic_medic-client_compact_running`,
      `medic_medic-client_updater_running`,
      `medic_medic-client_sizes_file`,
      `medic_medic-client_sizes_active`,
      `medic_medic-conflicts_compact_running`,
      `medic_medic-conflicts_updater_running`,
      `medic_medic-conflicts_sizes_file`,
      `medic_medic-conflicts_sizes_active`,
      `medic_medic-scripts_compact_running`,
      `medic_medic-scripts_updater_running`,
      `medic_medic-scripts_sizes_file`,
      `medic_medic-scripts_sizes_active`,
      `medic_medic-sms_compact_running`,
      `medic_medic-sms_updater_running`,
      `medic_medic-sms_sizes_file`,
      `medic_medic-sms_sizes_active`,
      `medic_:staged:medic_compact_running`,
      `medic_:staged:medic_updater_running`,
      `medic_:staged:medic_sizes_file`,
      `medic_:staged:medic_sizes_active`,
      `medic_:staged:medic-admin_compact_running`,
      `medic_:staged:medic-admin_updater_running`,
      `medic_:staged:medic-admin_sizes_file`,
      `medic_:staged:medic-admin_sizes_active`,
      `medic_:staged:medic-client_compact_running`,
      `medic_:staged:medic-client_updater_running`,
      `medic_:staged:medic-client_sizes_file`,
      `medic_:staged:medic-client_sizes_active`,
      `medic_:staged:medic-conflicts_compact_running`,
      `medic_:staged:medic-conflicts_updater_running`,
      `medic_:staged:medic-conflicts_sizes_file`,
      `medic_:staged:medic-conflicts_sizes_active`,
      `medic_:staged:medic-scripts_compact_running`,
      `medic_:staged:medic-scripts_updater_running`,
      `medic_:staged:medic-scripts_sizes_file`,
      `medic_:staged:medic-scripts_sizes_active`,
      `medic_:staged:medic-sms_compact_running`,
      `medic_:staged:medic-sms_updater_running`,
      `medic_:staged:medic-sms_sizes_file`,
      `medic_:staged:medic-sms_sizes_active`,
      'medic_medic_contacts_by_freetext_num_docs',
      'medic_medic_contacts_by_freetext_disk_size',
      'medic_medic_reports_by_freetext_num_docs',
      'medic_medic_reports_by_freetext_disk_size',
      'medic-sentinel_sizes_file',
      'medic-sentinel_sizes_active',
      'medic-sentinel_compact_running',
      `medic-sentinel_sentinel_compact_running`,
      `medic-sentinel_sentinel_updater_running`,
      `medic-sentinel_sentinel_sizes_file`,
      `medic-sentinel_sentinel_sizes_active`,
      `medic-sentinel_:staged:sentinel_compact_running`,
      `medic-sentinel_:staged:sentinel_updater_running`,
      `medic-sentinel_:staged:sentinel_sizes_file`,
      `medic-sentinel_:staged:sentinel_sizes_active`,
      'medic-users-meta_sizes_file',
      'medic-users-meta_sizes_active',
      'medic-users-meta_compact_running',
      `medic-users-meta_users-meta_compact_running`,
      `medic-users-meta_users-meta_updater_running`,
      `medic-users-meta_users-meta_sizes_file`,
      `medic-users-meta_users-meta_sizes_active`,
      `medic-users-meta_:staged:users-meta_compact_running`,
      `medic-users-meta_:staged:users-meta_updater_running`,
      `medic-users-meta_:staged:users-meta_sizes_file`,
      `medic-users-meta_:staged:users-meta_sizes_active`,
      '_users_sizes_file',
      '_users_sizes_active',
      '_users_compact_running',
      `_users_users_compact_running`,
      `_users_users_updater_running`,
      `_users_users_sizes_file`,
      `_users_users_sizes_active`,
      `_users_:staged:users_compact_running`,
      `_users_:staged:users_updater_running`,
      `_users_:staged:users_sizes_file`,
      `_users_:staged:users_sizes_active`,
      'memory_processes_used',
      'memory_binary',
      'directory_size',
    ];

    afterEach(() => {
      expect(mockNodeSystemLib.getCouchNodeSystem.notCalled).to.be.true;
      expect(mockDbsInfoLib.getDbsInfoByName.notCalled).to.be.true;
      expect(mockDesignInfoLib.getDesignInfo.notCalled).to.be.true;
      expect(diskUsageServiceGetSize.notCalled).to.be.true;
    });

    it('returns complete CSV header', run(function* () {
      const directory = 'directory';

      const service = yield* MonitorService;
      const data = service.getCsvHeader(Option.some(directory));

      expect(data).to.deep.equal(expectedCsvHeader);
    }));

    it('does not include directory_size column when no directory provided', run(function* () {
      const service = yield* MonitorService;
      const data = service.getCsvHeader(Option.none());

      expect(data).to.deep.equal(expectedCsvHeader.slice(0, -1));
    }));
  });
});
