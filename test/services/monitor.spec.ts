import { afterEach, describe, it } from 'mocha';
import { Effect, Either, Layer, Option, TestClock } from 'effect';
import { expect } from 'chai';
import { MonitorService } from '../../src/services/monitor';
import { CouchNodeSystem, CouchNodeSystemService } from '../../src/services/couch/node-system';
import sinon, { SinonStub } from 'sinon';
import * as CouchDbsInfo from '../../src/libs/couch/dbs-info';
import { CouchDbInfo } from '../../src/libs/couch/dbs-info';
import * as CouchDesignInfoLib from '../../src/services/couch/design-info';
import { CouchDesignInfo } from '../../src/services/couch/design-info';
import { LocalDiskUsageService } from '../../src/services/local-disk-usage';
import { createDbInfo, createDesignInfo, createNodeSystem } from '../utils/data-models';
import { ResponseError } from '@effect/platform/HttpClientError';
import { HttpClientRequest, HttpClientResponse } from '@effect/platform';
import { NonEmptyArray } from 'effect/Array';
import { genWithLayer, sandbox } from '../utils/base';
import { ChtClientService } from '../../src/services/cht-client';

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

const nodeSystemServiceGet = sandbox.stub();
const diskUsageServiceGetSize = sandbox.stub();

const run = MonitorService.Default.pipe(
  Layer.provide(Layer.succeed(CouchNodeSystemService, {
    get: nodeSystemServiceGet,
  } as unknown as CouchNodeSystemService)),
  Layer.provide(Layer.succeed(ChtClientService, {} as unknown as ChtClientService)),
  Layer.provide(Layer.succeed(LocalDiskUsageService, {
    getSize: diskUsageServiceGetSize,
  } as unknown as LocalDiskUsageService)),
  genWithLayer,
);

describe('Monitor service', () => {
  let designInfoServiceGet: SinonStub;
  let dbsInfoServicePost: SinonStub;

  beforeEach(() => {
    designInfoServiceGet = sinon.stub(CouchDesignInfoLib, 'getDesignInfo');
    dbsInfoServicePost = sinon.stub(CouchDbsInfo, 'getDbsInfoByName');
  });

  describe('get', () => {
    it('returns empty monitoring data', run(function* () {
      const nodeSystem = createNodeSystem();
      nodeSystemServiceGet.returns(Effect.succeed(nodeSystem));
      dbsInfoServicePost.returns(Effect.succeed([]));
      designInfoServiceGet.returns(Effect.void);
      diskUsageServiceGetSize.returns(Effect.succeed(0));

      const data = yield* MonitorService.get(Option.none());

      expect(data).to.deep.equal({
        ...nodeSystem,
        unix_time: yield* TestClock.currentTimeMillis,
        databases: [],
        directory_size: Option.none(),
      });
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(diskUsageServiceGetSize.notCalled).to.be.true;
    }));

    it('returns complete monitoring data', run(function* () {
      nodeSystemServiceGet.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(unix_time * 1000);
      dbsInfoServicePost.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      initializeDesignInfoServiceGet(designInfoServiceGet);
      const directory = 'directory';
      const directorySize = 444444;
      diskUsageServiceGetSize.returns(Effect.succeed(directorySize));

      const data = yield* MonitorService.get(Option.some(directory));

      expect(data).to.deep.equal({
        ...nodeSystem,
        unix_time,
        databases: [
          {
            ...medicDbInfo, designs: [
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
          },
          { ...sentinelDbInfo, designs: [sentinelDesignInfo, sentinelStagedDesignInfo] },
          { ...usersMetaDbInfo, designs: [usersMetaDesignInfo, usersMetaStagedDesignInfo] },
          { ...usersDbInfo, designs: [usersDesignInfo, usersStagedDesignInfo] },
        ],
        directory_size: Option.some(directorySize),
      });
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
    }));

    it('includes empty data for designs that do not exist', run(function* () {
      nodeSystemServiceGet.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(unix_time * 1000);
      dbsInfoServicePost.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      designInfoServiceGet.withArgs('medic', 'medic').returns(Effect.succeed(medicDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-admin').returns(Effect.succeed(medicAdminDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-client').returns(Effect.succeed(medicClientDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-conflicts').returns(Effect.succeed(medicConflictsDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-scripts').returns(Effect.succeed(medicScriptsDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-sms').returns(Effect.succeed(medicSmsDesignInfo));
      designInfoServiceGet.withArgs('medic-sentinel', 'sentinel').returns(Effect.succeed(sentinelDesignInfo));
      designInfoServiceGet.withArgs('medic-users-meta', 'users-meta').returns(Effect.succeed(usersMetaDesignInfo));
      designInfoServiceGet.withArgs('_users', 'users').returns(Effect.succeed(usersDesignInfo));
      designInfoServiceGet.returns(Effect.fail(new ResponseError({
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
        databases: [
          {
            ...medicDbInfo, designs: [
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
          },
          { ...sentinelDbInfo, designs: [sentinelDesignInfo, emptyDesignInfo] },
          { ...usersMetaDbInfo, designs: [usersMetaDesignInfo, emptyDesignInfo] },
          { ...usersDbInfo, designs: [usersDesignInfo, emptyDesignInfo] },
        ],
        directory_size: Option.some(directorySize),
      });
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
    }));

    it('fails when any other error is experienced', run(function* () {
      nodeSystemServiceGet.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(unix_time * 1000);
      dbsInfoServicePost.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      designInfoServiceGet.withArgs('medic', 'medic').returns(Effect.succeed(medicDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-admin').returns(Effect.succeed(medicAdminDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-client').returns(Effect.succeed(medicClientDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-conflicts').returns(Effect.succeed(medicConflictsDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-scripts').returns(Effect.succeed(medicScriptsDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-sms').returns(Effect.succeed(medicSmsDesignInfo));
      designInfoServiceGet.withArgs('medic-sentinel', 'sentinel').returns(Effect.succeed(sentinelDesignInfo));
      designInfoServiceGet.withArgs('medic-users-meta', 'users-meta').returns(Effect.succeed(usersMetaDesignInfo));
      designInfoServiceGet.withArgs('_users', 'users').returns(Effect.succeed(usersDesignInfo));
      const expectedError = new ResponseError({
        request: {} as unknown as HttpClientRequest.HttpClientRequest,
        response: { status: 500 } as unknown as HttpClientResponse.HttpClientResponse,
        reason: 'StatusCode'
      });
      designInfoServiceGet.returns(Effect.fail(expectedError));
      const directory = 'directory';
      const directorySize = 444444;
      diskUsageServiceGetSize.returns(Effect.succeed(directorySize));

      const failureOrSuccess = yield* Effect.either(MonitorService.get(Option.some(directory)));

      if (Either.isLeft(failureOrSuccess)) {
        const error = failureOrSuccess.left;
        expect(error).to.equal(expectedError);

        expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
        expect(dbsInfoServicePost.calledOnceWithExactly(DB_NAMES)).to.be.true;
        expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
        expect(diskUsageServiceGetSize.notCalled).to.be.true;
      } else {
        expect.fail('Expected error to be thrown');
      }
    }));

    it('trims milliseconds from unix_time value', run(function* () {
      const nodeSystem = createNodeSystem();
      nodeSystemServiceGet.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(123456789458);
      dbsInfoServicePost.returns(Effect.succeed([]));
      designInfoServiceGet.returns(Effect.void);
      diskUsageServiceGetSize.returns(Effect.succeed(0));

      const data = yield* MonitorService.get(Option.none());

      expect(data).to.deep.equal({
        ...nodeSystem,
        unix_time,
        databases: [],
        directory_size: Option.none(),
      });
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
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

    const getNodeSystemCsvData = (nodeSystem: CouchNodeSystem) => [
      nodeSystem.memory.processes_used.toString(),
      nodeSystem.memory.binary.toString(),
    ];

    const expectedCsvData = [
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
      nodeSystemServiceGet.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(unix_time * 1000);
      dbsInfoServicePost.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      initializeDesignInfoServiceGet(designInfoServiceGet);
      const directory = 'directory';
      const directorySize = 444444;
      diskUsageServiceGetSize.returns(Effect.succeed(directorySize));

      const data = yield* MonitorService.getAsCsv(Option.some(directory));

      expect(data).to.deep.equal([unix_time.toString(), ...expectedCsvData, directorySize.toString()]);
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
    }));

    it('includes empty data for designs that do not exist', run(function* () {
      nodeSystemServiceGet.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(unix_time * 1000);
      dbsInfoServicePost.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      designInfoServiceGet.withArgs('medic', 'medic').returns(Effect.succeed(medicDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-admin').returns(Effect.succeed(medicAdminDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-client').returns(Effect.succeed(medicClientDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-conflicts').returns(Effect.succeed(medicConflictsDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-scripts').returns(Effect.succeed(medicScriptsDesignInfo));
      designInfoServiceGet.withArgs('medic', 'medic-sms').returns(Effect.succeed(medicSmsDesignInfo));
      designInfoServiceGet.withArgs('medic-sentinel', 'sentinel').returns(Effect.succeed(sentinelDesignInfo));
      designInfoServiceGet.withArgs('medic-users-meta', 'users-meta').returns(Effect.succeed(usersMetaDesignInfo));
      designInfoServiceGet.withArgs('_users', 'users').returns(Effect.succeed(usersDesignInfo));
      designInfoServiceGet.returns(Effect.fail(new ResponseError({
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
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
    }));

    it('does not include directory_size column when no directory provided', run(function* () {
      nodeSystemServiceGet.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(123456789458);
      dbsInfoServicePost.returns(Effect.succeed([medicDbInfo, sentinelDbInfo, usersMetaDbInfo, usersDbInfo]));
      initializeDesignInfoServiceGet(designInfoServiceGet);

      const data = yield* MonitorService.getAsCsv(Option.none());

      expect(data).to.deep.equal([unix_time.toString(), ...expectedCsvData]);
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly(DB_NAMES)).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(diskUsageServiceGetSize.notCalled).to.be.true;
    }));
  });

  describe('getCsvHeader', () => {
    const expectedCsvHeader = [
      'unix_time',
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
      expect(nodeSystemServiceGet.notCalled).to.be.true;
      expect(dbsInfoServicePost.notCalled).to.be.true;
      expect(designInfoServiceGet.notCalled).to.be.true;
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
