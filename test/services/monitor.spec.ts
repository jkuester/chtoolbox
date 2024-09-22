import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, Option, TestClock, TestContext } from 'effect';
import { expect } from 'chai';
import { MonitorService, MonitorServiceLive } from '../../src/services/monitor';
import { CouchNodeSystemService } from '../../src/services/couch/node-system';
import sinon, { SinonStub } from 'sinon';
import { CouchDbsInfoService } from '../../src/services/couch/dbs-info';
import { CouchDesignInfoService } from '../../src/services/couch/design-info';
import { LocalDiskUsageService } from '../../src/services/local-disk-usage';

const EXPECTED_DESIGN_INFO_ARGS = [
  ['medic', 'medic'],
  ['medic', 'medic-admin'],
  ['medic', 'medic-client'],
  ['medic', 'medic-conflicts'],
  ['medic', 'medic-scripts'],
  ['medic', 'medic-sms'],
  ['medic-sentinel', 'sentinel'],
  ['medic-users-meta', 'users-meta'],
  ['_users', 'users'],
];

const createNodeSystem = ({
  other = 0,
  atom = 0,
  atom_used = 0,
  processes = 0,
  processes_used = 0,
  binary = 0,
  code = 0,
  ets = 0,
} = { }) => ({
  memory: {
    other,
    atom,
    atom_used,
    processes,
    processes_used,
    binary,
    code,
    ets,
  }
});

const createDbInfo = ({
  key = '',
  compact_running = false,
  file = 0,
  active = 0,
}) => ({
  key,
  info: {
    compact_running,
    sizes: {
      file,
      active,
    },
  },
});

const createDesignInfo = ({
  name = '',
  compact_running = false,
  updater_running = false,
  file = 0,
  active = 0
}) => ({
  name,
  view_index: {
    compact_running,
    updater_running,
    sizes: {
      file,
      active,
    },
  },
});

const nodeSystem = createNodeSystem({
  other: 12352352,
  atom: 235235,
  atom_used: 1453,
  processes: 32232,
  processes_used: 324116345634,
  binary: 34,
  code: 23232,
  ets: 999,
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
const medicAdminDesignInfo = createDesignInfo({ name: 'medic-admin', compact_running: true, file: 135232423 });
const medicClientDesignInfo = createDesignInfo({ name: 'medic-client', updater_running: true, active: 12345232 });
const medicConflictsDesignInfo = createDesignInfo({ name: 'medic-conflicts', file: 1212121, active: 42334534534});
const medicScriptsDesignInfo = createDesignInfo({ name: 'medic-scripts', file: 312121212 });
const medicSmsDesignInfo = createDesignInfo({ name: 'medic-sms', active: 1 });
const sentinelDesignInfo = createDesignInfo({ name: 'sentinel' });
const usersMetaDesignInfo = createDesignInfo({ name: 'users-meta' });
const usersDesignInfo = createDesignInfo({
  name: 'users',
  compact_running: true,
  updater_running: true,
  file: 12323234444,
  active: 23422232
});

describe('Monitor service', () => {
  let nodeSystemServiceGet: SinonStub;
  let dbsInfoServicePost: SinonStub;
  let designInfoServiceGet: SinonStub;
  let diskUsageServiceGetSize: SinonStub;

  beforeEach(() => {
    nodeSystemServiceGet = sinon.stub();
    dbsInfoServicePost = sinon.stub();
    designInfoServiceGet = sinon.stub();
    diskUsageServiceGetSize = sinon.stub();
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, MonitorService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(MonitorServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(CouchNodeSystemService, CouchNodeSystemService.of({
        get: nodeSystemServiceGet,
      }))),
      Effect.provide(Layer.succeed(CouchDbsInfoService, CouchDbsInfoService.of({
        post: dbsInfoServicePost,
      } as unknown as CouchDbsInfoService)),),
      Effect.provide(Layer.succeed(CouchDesignInfoService, CouchDesignInfoService.of({
        get: designInfoServiceGet,
      }))),
      Effect.provide(Layer.succeed(LocalDiskUsageService, LocalDiskUsageService.of({
        getSize: diskUsageServiceGetSize,
      }))),
    ));
  };

  describe('get', () => {
    it('returns empty monitoring data', run(Effect.gen(function* () {
      const nodeSystem = createNodeSystem();
      nodeSystemServiceGet.returns(Effect.succeed(nodeSystem));
      dbsInfoServicePost.returns(Effect.succeed([]));
      designInfoServiceGet.returns(Effect.void);
      diskUsageServiceGetSize.returns(Effect.succeed(0));

      const service = yield* MonitorService;
      const data = yield* service.get(Option.none());

      expect(data).to.deep.equal({
        ...nodeSystem,
        unix_time: yield* TestClock.currentTimeMillis,
        databases: [],
        directory_size: Option.none(),
      });
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly()).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(diskUsageServiceGetSize.notCalled).to.be.true;
    })));

    it('returns complete monitoring data', run(Effect.gen(function* () {
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
      const directory = 'directory';
      const directorySize = 444444;
      diskUsageServiceGetSize.returns(Effect.succeed(directorySize));

      const service = yield* MonitorService;
      const data = yield* service.get(Option.some(directory));

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
              medicSmsDesignInfo
            ],
          },
          { ...sentinelDbInfo, designs: [sentinelDesignInfo] },
          { ...usersMetaDbInfo, designs: [usersMetaDesignInfo] },
          { ...usersDbInfo, designs: [usersDesignInfo] },
        ],
        directory_size: Option.some(directorySize),
      });
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly()).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
    })));

    it('trims milliseconds from unix_time value', run(Effect.gen(function* () {
      const nodeSystem = createNodeSystem();
      nodeSystemServiceGet.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(123456789458);
      dbsInfoServicePost.returns(Effect.succeed([]));
      designInfoServiceGet.returns(Effect.void);
      diskUsageServiceGetSize.returns(Effect.succeed(0));

      const service = yield* MonitorService;
      const data = yield* service.get(Option.none());

      expect(data).to.deep.equal({
        ...nodeSystem,
        unix_time,
        databases: [],
        directory_size: Option.none(),
      });
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly()).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(diskUsageServiceGetSize.notCalled).to.be.true;
    })));
  });

  describe('getAsCsv', () => {
    const expectedCsvData = [
      medicDbInfo.info.sizes.file.toString(),
      medicDbInfo.info.sizes.active.toString(),
      medicDbInfo.info.compact_running.toString(),
      medicDesignInfo.view_index.compact_running.toString(),
      medicDesignInfo.view_index.updater_running.toString(),
      medicDesignInfo.view_index.sizes.file.toString(),
      medicDesignInfo.view_index.sizes.active.toString(),
      medicAdminDesignInfo.view_index.compact_running.toString(),
      medicAdminDesignInfo.view_index.updater_running.toString(),
      medicAdminDesignInfo.view_index.sizes.file.toString(),
      medicAdminDesignInfo.view_index.sizes.active.toString(),
      medicClientDesignInfo.view_index.compact_running.toString(),
      medicClientDesignInfo.view_index.updater_running.toString(),
      medicClientDesignInfo.view_index.sizes.file.toString(),
      medicClientDesignInfo.view_index.sizes.active.toString(),
      medicConflictsDesignInfo.view_index.compact_running.toString(),
      medicConflictsDesignInfo.view_index.updater_running.toString(),
      medicConflictsDesignInfo.view_index.sizes.file.toString(),
      medicConflictsDesignInfo.view_index.sizes.active.toString(),
      medicScriptsDesignInfo.view_index.compact_running.toString(),
      medicScriptsDesignInfo.view_index.updater_running.toString(),
      medicScriptsDesignInfo.view_index.sizes.file.toString(),
      medicScriptsDesignInfo.view_index.sizes.active.toString(),
      medicSmsDesignInfo.view_index.compact_running.toString(),
      medicSmsDesignInfo.view_index.updater_running.toString(),
      medicSmsDesignInfo.view_index.sizes.file.toString(),
      medicSmsDesignInfo.view_index.sizes.active.toString(),
      sentinelDbInfo.info.sizes.file.toString(),
      sentinelDbInfo.info.sizes.active.toString(),
      sentinelDbInfo.info.compact_running.toString(),
      sentinelDesignInfo.view_index.compact_running.toString(),
      sentinelDesignInfo.view_index.updater_running.toString(),
      sentinelDesignInfo.view_index.sizes.file.toString(),
      sentinelDesignInfo.view_index.sizes.active.toString(),
      usersMetaDbInfo.info.sizes.file.toString(),
      usersMetaDbInfo.info.sizes.active.toString(),
      usersMetaDbInfo.info.compact_running.toString(),
      usersMetaDesignInfo.view_index.compact_running.toString(),
      usersMetaDesignInfo.view_index.updater_running.toString(),
      usersMetaDesignInfo.view_index.sizes.file.toString(),
      usersMetaDesignInfo.view_index.sizes.active.toString(),
      usersDbInfo.info.sizes.file.toString(),
      usersDbInfo.info.sizes.active.toString(),
      usersDbInfo.info.compact_running.toString(),
      usersDesignInfo.view_index.compact_running.toString(),
      usersDesignInfo.view_index.updater_running.toString(),
      usersDesignInfo.view_index.sizes.file.toString(),
      usersDesignInfo.view_index.sizes.active.toString(),
      nodeSystem.memory.other.toString(),
      nodeSystem.memory.atom.toString(),
      nodeSystem.memory.atom_used.toString(),
      nodeSystem.memory.processes.toString(),
      nodeSystem.memory.processes_used.toString(),
      nodeSystem.memory.binary.toString(),
      nodeSystem.memory.code.toString(),
      nodeSystem.memory.ets.toString()
    ];

    it('returns complete monitoring data', run(Effect.gen(function* () {
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
      const directory = 'directory';
      const directorySize = 444444;
      diskUsageServiceGetSize.returns(Effect.succeed(directorySize));

      const service = yield* MonitorService;
      const data = yield* service.getAsCsv(Option.some(directory));

      expect(data).to.deep.equal([unix_time.toString(), ...expectedCsvData, directorySize.toString()]);
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly()).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(diskUsageServiceGetSize.calledOnceWithExactly(directory)).to.be.true;
    })));

    it('does not include directory_size column when no directory provided', run(Effect.gen(function* () {
      nodeSystemServiceGet.returns(Effect.succeed(nodeSystem));
      const unix_time = 123456789;
      yield* TestClock.setTime(123456789458);
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

      const service = yield* MonitorService;
      const data = yield* service.getAsCsv(Option.none());

      expect(data).to.deep.equal([unix_time.toString(), ...expectedCsvData]);
      expect(nodeSystemServiceGet.calledOnceWithExactly()).to.be.true;
      expect(dbsInfoServicePost.calledOnceWithExactly()).to.be.true;
      expect(designInfoServiceGet.args).to.deep.equal(EXPECTED_DESIGN_INFO_ARGS);
      expect(diskUsageServiceGetSize.notCalled).to.be.true;
    })));
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
      'medic-sentinel_sizes_file',
      'medic-sentinel_sizes_active',
      'medic-sentinel_compact_running',
      `medic-sentinel_sentinel_compact_running`,
      `medic-sentinel_sentinel_updater_running`,
      `medic-sentinel_sentinel_sizes_file`,
      `medic-sentinel_sentinel_sizes_active`,
      'medic-users-meta_sizes_file',
      'medic-users-meta_sizes_active',
      'medic-users-meta_compact_running',
      `medic-users-meta_users-meta_compact_running`,
      `medic-users-meta_users-meta_updater_running`,
      `medic-users-meta_users-meta_sizes_file`,
      `medic-users-meta_users-meta_sizes_active`,
      '_users_sizes_file',
      '_users_sizes_active',
      '_users_compact_running',
      `_users_users_compact_running`,
      `_users_users_updater_running`,
      `_users_users_sizes_file`,
      `_users_users_sizes_active`,
      'memory_other',
      'memory_atom',
      'memory_atom_used',
      'memory_processes',
      'memory_processes_used',
      'memory_binary',
      'memory_code',
      'memory_ets',
      'directory_size',
    ];

    afterEach(() => {
      expect(nodeSystemServiceGet.notCalled).to.be.true;
      expect(dbsInfoServicePost.notCalled).to.be.true;
      expect(designInfoServiceGet.notCalled).to.be.true;
      expect(diskUsageServiceGetSize.notCalled).to.be.true;
    });

    it('returns complete CSV header', run(Effect.gen(function* () {
      const directory = 'directory';

      const service = yield* MonitorService;
      const data = service.getCsvHeader(Option.some(directory));

      expect(data).to.deep.equal(expectedCsvHeader);
    })));

    it('does not include directory_size column when no directory provided', run(Effect.gen(function* () {
      const service = yield* MonitorService;
      const data = service.getCsvHeader(Option.none());

      expect(data).to.deep.equal(expectedCsvHeader.slice(0, -1));
    })));
  });
});
