import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { Effect, Either, Encoding, Layer, pipe } from 'effect';
import esmock from 'esmock';
import * as MedicStagingLib from '../../src/libs/medic-staging.ts';
import { genWithLayer, sandbox } from '../utils/base.ts';
import { CouchDesign } from '../../src/libs/couch/design.ts';
import { ChtClientService } from '../../src/services/cht-client.ts';
import { PouchDBService } from '../../src/services/pouchdb.ts';

const STAGING_BUILDS_COUCH_URL = 'https://staging.dev.medicmobile.org/_couch/builds_4';

const mockShim = { pouchDB: sandbox.stub() };
const mockDesignLib = { CouchDesign, getCouchDesign: sandbox.stub() };
const mockPouchLib = { getAllDocs: sandbox.stub() };

const currentVersion = '4.4.0';
const targetVersion = '4.5.0';
const medicDdoc = {
  _id: '_design/medic',
  views: { contacts_by_depth: {} }
} as const;
const medicClientDdoc = {
  _id: '_design/medic-client',
  views: { contacts_by_freetext: {} }
} as const;
const sentinelDdoc = {
  _id: '_design/sentinel',
  views: { tasks_by_state: {} }
} as const;
const logsDdoc = {
  _id: '_design/logs',
  views: { connected_users: {} }
} as const;
const usersMetaDdoc = {
  _id: '_design/users-meta',
  views: { device_by_user: {} }
} as const;
const usersDdoc = {
  _id: '_design/users',
  views: { users_by_field: {} }
} as const;

const createAttachment = (docs: Record<string, unknown>[]) => pipe(
  { docs },
  JSON.stringify,
  Encoding.encodeBase64,
  data => ({ data } as PouchDB.Core.FullAttachment)
);

const {
  CHT_DDOC_ATTACHMENT_NAMES,
  CHT_DATABASE_BY_ATTACHMENT_NAME,
  DesignDocAttachment,
  getDesignDocAttachments,
  getDesignDocsDiff,
  getStagingDdocsDiff
} = await esmock<
  typeof MedicStagingLib
>('../../src/libs/medic-staging.ts', {
  '../../src/libs/shim.ts': mockShim,
  '../../src/libs/couch/design.ts': mockDesignLib,
  '../../src/services/pouchdb.ts': mockPouchLib,
});

const run = pipe(
  Layer.succeed(ChtClientService, {} as unknown as ChtClientService),
  Layer.merge(Layer.succeed(PouchDBService, {} as unknown as PouchDBService)),
  genWithLayer,
);

describe('medic-staging libs', () => {
  let dbGet: sinon.SinonStub;

  beforeEach(() => {
    dbGet = sinon.stub();
    mockShim.pouchDB.returns({ get: dbGet });
  });

  it('CHT_DDOC_ATTACHMENT_NAMES', () => {
    expect(CHT_DDOC_ATTACHMENT_NAMES).to.deep.equal([
      'ddocs/medic.json',
      'ddocs/sentinel.json',
      'ddocs/logs.json',
      'ddocs/users-meta.json',
      'ddocs/users.json'
    ]);
  });

  it('CHT_DATABASE_BY_ATTACHMENT_NAME', () => {
    expect(CHT_DATABASE_BY_ATTACHMENT_NAME).to.deep.equal({
      'ddocs/medic.json': 'medic',
      'ddocs/sentinel.json': 'medic-sentinel',
      'ddocs/logs.json': 'medic-logs',
      'ddocs/users-meta.json': 'medic-users-meta',
      'ddocs/users.json': '_users'
    });
  });

  it('DesignDocAttachment - decodes base64 encoded JSON attachment', run(function* () {
    const docs = [
      { _id: '_design/medic', views: { 'contacts_by_depth': {} } },
      { _id: '_design/medic-client', views: { 'contacts_by_freetext': {} } }
    ];
    const attachment = createAttachment(docs);

    const result = yield* DesignDocAttachment.decode(attachment);

    expect(result.docs.length).to.equal(2);
    const [firstDoc, secondDoc] = result.docs;
    expect(firstDoc).to.deep.include(docs[0]);
    expect(secondDoc).to.deep.include(docs[1]);
  }));

  describe('getDesignDocAttachments', () => {
    const medicDdoc = { _id: '_design/medic', views: { 'contacts_by_depth': {} } };
    const medicClientDdoc = { _id: '_design/medic-client', views: { 'contacts_by_freetext': {} } };
    const medicDdocAttachment = [medicDdoc, medicClientDdoc];

    const sentinelDdoc = { _id: '_design/sentinel', views: { 'tasks_by_state': {} } };
    const sentinelDdocAttachment = [sentinelDdoc];

    const logsDdoc = { _id: '_design/logs', views: { 'connected_users': {} } };
    const logsDdocAttachment = [logsDdoc];

    const usersMetaDdoc = { _id: '_design/users-meta', views: { 'device_by_user': {} } };
    const usersMetaDdocAttachment = [usersMetaDdoc];

    const usersDdoc = { _id: '_design/users', views: { 'users_by_field': {} } };
    const usersDdocAttachment = [usersDdoc];

    it('fetches and decodes design doc attachments from staging builds', run(function* () {
      dbGet.resolves({
        _attachments: {
          'ddocs/medic.json': createAttachment(medicDdocAttachment),
          'ddocs/sentinel.json': createAttachment(sentinelDdocAttachment),
          'ddocs/logs.json': createAttachment(logsDdocAttachment),
          'ddocs/users-meta.json': createAttachment(usersMetaDdocAttachment),
          'ddocs/users.json': createAttachment(usersDdocAttachment),
        }
      });

      const result = yield* getDesignDocAttachments(currentVersion);

      expect(result.length).to.equal(5);
      expect(result.map(([, name]) => name)).to.deep.equal([
        'ddocs/medic.json',
        'ddocs/sentinel.json',
        'ddocs/logs.json',
        'ddocs/users-meta.json',
        'ddocs/users.json'
      ]);
      expect(result.map(([attachment]) => attachment.docs.map(d => d._id))).to.deep.equal([
        ['_design/medic', '_design/medic-client'],
        ['_design/sentinel'],
        ['_design/logs'],
        ['_design/users-meta'],
        ['_design/users']
      ]);
      expect(mockShim.pouchDB.calledOnceWithExactly(STAGING_BUILDS_COUCH_URL)).to.be.true;
      expect(dbGet.calledOnceWithExactly(`medic:medic:${currentVersion}`, { attachments: true })).to.be.true;
    }));

    it('fails when there are no attachments ', run(function* () {
      dbGet.resolves({ });

      const either = yield* Effect.either(getDesignDocAttachments(currentVersion));

      expect(Either.isLeft(either)).to.be.true;
      expect(mockShim.pouchDB.calledOnceWithExactly(STAGING_BUILDS_COUCH_URL)).to.be.true;
      expect(dbGet.calledOnceWithExactly(`medic:medic:${currentVersion}`, { attachments: true })).to.be.true;
    }));
  });

  describe('getDesignDocsDiff', () => {
    afterEach(() => {
      expect(mockDesignLib.getCouchDesign).to.have.been.calledOnceWithExactly('medic', 'medic');
      expect(dbGet.args).to.deep.equal([
        [`medic:medic:${currentVersion}`, { attachments: true }],
        [`medic:medic:${targetVersion}`, { attachments: true }]
      ]);
      expect(mockPouchLib.getAllDocs.args).to.deep.equal([
        ['medic'],
        ['medic-sentinel'],
        ['medic-logs'],
        ['medic-users-meta'],
        ['_users']
      ]);
    });

    it('returns empty diffs when current and target ddocs are identical', run(function* () {
      mockDesignLib.getCouchDesign.returns(Effect.succeed({ build_info: { base_version: currentVersion } }));
      const stagingAttachments = { _attachments: {
        'ddocs/medic.json': createAttachment([medicDdoc, medicClientDdoc]),
        'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
        'ddocs/logs.json': createAttachment([logsDdoc]),
        'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
        'ddocs/users.json': createAttachment([usersDdoc]),
      } };
      dbGet.resolves(stagingAttachments);
      mockPouchLib.getAllDocs.callsFake((dbName: string) => () => {
        const docsByDb: Record<string, object[]> = {
          'medic': [medicDdoc, medicClientDdoc],
          'medic-sentinel': [sentinelDdoc],
          'medic-logs': [logsDdoc],
          'medic-users-meta': [usersMetaDdoc],
          '_users': [usersDdoc],
        };
        return Effect.succeed(docsByDb[dbName] ?? []);
      });

      const result = yield* getDesignDocsDiff(targetVersion);

      expect(result).to.deep.equal({
        'medic': { created: [], deleted: [], updated: [] },
        'medic-sentinel': { created: [], deleted: [], updated: [] },
        'medic-logs': { created: [], deleted: [], updated: [] },
        'medic-users-meta': { created: [], deleted: [], updated: [] },
        '_users': { created: [], deleted: [], updated: [] },
      });
    }));

    it('detects created ddocs in target version', run(function* () {
      mockDesignLib.getCouchDesign.returns(Effect.succeed({ build_info: { base_version: currentVersion } }));
      const newDdoc = { _id: '_design/new-ddoc', views: { new_view: {} } };
      const currentStagingAttachments = { _attachments: {
        'ddocs/medic.json': createAttachment([medicDdoc]),
        'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
        'ddocs/logs.json': createAttachment([logsDdoc]),
        'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
        'ddocs/users.json': createAttachment([usersDdoc]),
      } };
      const targetStagingAttachments = { _attachments: {
        'ddocs/medic.json': createAttachment([medicDdoc, newDdoc]),
        'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
        'ddocs/logs.json': createAttachment([logsDdoc]),
        'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
        'ddocs/users.json': createAttachment([usersDdoc]),
      } };
      dbGet
        .withArgs(`medic:medic:${currentVersion}`, { attachments: true }).resolves(currentStagingAttachments)
        .withArgs(`medic:medic:${targetVersion}`, { attachments: true }).resolves(targetStagingAttachments);
      mockPouchLib.getAllDocs.callsFake((dbName: string) => () => {
        const docsByDb: Record<string, object[]> = {
          'medic': [medicDdoc],
          'medic-sentinel': [sentinelDdoc],
          'medic-logs': [logsDdoc],
          'medic-users-meta': [usersMetaDdoc],
          '_users': [usersDdoc],
        };
        return Effect.succeed(docsByDb[dbName] ?? []);
      });

      const result = yield* getDesignDocsDiff(targetVersion);

      expect(result.medic.created.length).to.equal(1);
      expect(result.medic.created[0]).to.deep.include(newDdoc);
      expect(result.medic.deleted).to.deep.equal([]);
      expect(result.medic.updated).to.deep.equal([]);
      expect(result).to.deep.include({
        'medic-sentinel': { created: [], deleted: [], updated: [] },
        'medic-logs': { created: [], deleted: [], updated: [] },
        'medic-users-meta': { created: [], deleted: [], updated: [] },
        '_users': { created: [], deleted: [], updated: [] },
      });
    }));

    it('detects deleted ddocs in target version', run(function* () {
      mockDesignLib.getCouchDesign.returns(Effect.succeed({ build_info: { base_version: currentVersion } }));
      const deletedDdoc = { _id: '_design/deleted-ddoc', views: { old_view: {} } };
      const currentStagingAttachments = { _attachments: {
        'ddocs/medic.json': createAttachment([medicDdoc, deletedDdoc]),
        'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
        'ddocs/logs.json': createAttachment([logsDdoc]),
        'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
        'ddocs/users.json': createAttachment([usersDdoc]),
      } };
      const targetStagingAttachments = { _attachments: {
        'ddocs/medic.json': createAttachment([medicDdoc]),
        'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
        'ddocs/logs.json': createAttachment([logsDdoc]),
        'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
        'ddocs/users.json': createAttachment([usersDdoc]),
      } };
      dbGet
        .withArgs(`medic:medic:${currentVersion}`, { attachments: true }).resolves(currentStagingAttachments)
        .withArgs(`medic:medic:${targetVersion}`, { attachments: true }).resolves(targetStagingAttachments);
      mockPouchLib.getAllDocs.callsFake((dbName: string) => () => {
        const docsByDb: Record<string, object[]> = {
          'medic': [medicDdoc, deletedDdoc],
          'medic-sentinel': [sentinelDdoc],
          'medic-logs': [logsDdoc],
          'medic-users-meta': [usersMetaDdoc],
          '_users': [usersDdoc],
        };
        return Effect.succeed(docsByDb[dbName] ?? []);
      });

      const result = yield* getDesignDocsDiff(targetVersion);

      expect(result.medic.created).to.deep.equal([]);
      expect(result.medic.deleted.length).to.equal(1);
      expect(result.medic.deleted[0]).to.deep.include(deletedDdoc);
      expect(result.medic.updated).to.deep.equal([]);
      expect(result).to.deep.include({
        'medic-sentinel': { created: [], deleted: [], updated: [] },
        'medic-logs': { created: [], deleted: [], updated: [] },
        'medic-users-meta': { created: [], deleted: [], updated: [] },
        '_users': { created: [], deleted: [], updated: [] },
      });
    }));

    [
      {
        currentMedicDdoc: { _id: '_design/medic', views: { contacts_by_depth: { map: 'old' } } },
        targetMedicDdoc: { _id: '_design/medic', views: { contacts_by_depth: { map: 'new' } } }
      },
      {
        currentMedicDdoc: { _id: '_design/medic', views: {}, nouveau: { search: 'old' } },
        targetMedicDdoc: { _id: '_design/medic', views: {}, nouveau: { search: 'new' } },
      }
    ].forEach(({ currentMedicDdoc, targetMedicDdoc }) => {
      it('detects updated ddocs when views change', run(function* () {
        mockDesignLib.getCouchDesign.returns(Effect.succeed({ build_info: { base_version: currentVersion } }));
        const currentStagingAttachments = { _attachments: {
          'ddocs/medic.json': createAttachment([currentMedicDdoc]),
          'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
          'ddocs/logs.json': createAttachment([logsDdoc]),
          'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
          'ddocs/users.json': createAttachment([usersDdoc]),
        } };
        const targetStagingAttachments = { _attachments: {
          'ddocs/medic.json': createAttachment([targetMedicDdoc]),
          'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
          'ddocs/logs.json': createAttachment([logsDdoc]),
          'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
          'ddocs/users.json': createAttachment([usersDdoc]),
        } };
        dbGet
          .withArgs(`medic:medic:${currentVersion}`, { attachments: true }).resolves(currentStagingAttachments)
          .withArgs(`medic:medic:${targetVersion}`, { attachments: true }).resolves(targetStagingAttachments);
        mockPouchLib.getAllDocs.callsFake((dbName: string) => () => {
          const docsByDb: Record<string, object[]> = {
            'medic': [currentMedicDdoc],
            'medic-sentinel': [sentinelDdoc],
            'medic-logs': [logsDdoc],
            'medic-users-meta': [usersMetaDdoc],
            '_users': [usersDdoc],
          };
          return Effect.succeed(docsByDb[dbName] ?? []);
        });

        const result = yield* getDesignDocsDiff(targetVersion);

        expect(result.medic.created).to.deep.equal([]);
        expect(result.medic.deleted).to.deep.equal([]);
        expect(result.medic.updated.length).to.equal(1);
        expect(result.medic.updated[0]).to.deep.include(targetMedicDdoc);
        expect(result).to.deep.include({
          'medic-sentinel': { created: [], deleted: [], updated: [] },
          'medic-logs': { created: [], deleted: [], updated: [] },
          'medic-users-meta': { created: [], deleted: [], updated: [] },
          '_users': { created: [], deleted: [], updated: [] },
        });
      }));
    });
  });

  describe('getStagingDdocsDiff', () => {
    afterEach(() => {
      expect(dbGet.args).to.deep.equal([
        [`medic:medic:${currentVersion}`, { attachments: true }],
        [`medic:medic:${targetVersion}`, { attachments: true }]
      ]);
    });

    it('returns empty diffs when base and target ddocs are identical', run(function* () {
      const stagingAttachments = { _attachments: {
        'ddocs/medic.json': createAttachment([medicDdoc, medicClientDdoc]),
        'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
        'ddocs/logs.json': createAttachment([logsDdoc]),
        'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
        'ddocs/users.json': createAttachment([usersDdoc]),
      } };
      dbGet.resolves(stagingAttachments);

      const result = yield* getStagingDdocsDiff(currentVersion, targetVersion);

      expect(result).to.deep.equal({
        'medic': { created: [], deleted: [], updated: [] },
        'medic-sentinel': { created: [], deleted: [], updated: [] },
        'medic-logs': { created: [], deleted: [], updated: [] },
        'medic-users-meta': { created: [], deleted: [], updated: [] },
        '_users': { created: [], deleted: [], updated: [] },
      });
    }));

    it('detects created ddocs in target version', run(function* () {
      const newDdoc = { _id: '_design/new-ddoc', views: { new_view: {} } };
      const baseStagingAttachments = { _attachments: {
        'ddocs/medic.json': createAttachment([medicDdoc]),
        'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
        'ddocs/logs.json': createAttachment([logsDdoc]),
        'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
        'ddocs/users.json': createAttachment([usersDdoc]),
      } };
      const targetStagingAttachments = { _attachments: {
        'ddocs/medic.json': createAttachment([medicDdoc, newDdoc]),
        'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
        'ddocs/logs.json': createAttachment([logsDdoc]),
        'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
        'ddocs/users.json': createAttachment([usersDdoc]),
      } };
      dbGet
        .withArgs(`medic:medic:${currentVersion}`, { attachments: true }).resolves(baseStagingAttachments)
        .withArgs(`medic:medic:${targetVersion}`, { attachments: true }).resolves(targetStagingAttachments);

      const result = yield* getStagingDdocsDiff(currentVersion, targetVersion);

      expect(result.medic.created.length).to.equal(1);
      expect(result.medic.created[0]).to.deep.include(newDdoc);
      expect(result.medic.deleted).to.deep.equal([]);
      expect(result.medic.updated).to.deep.equal([]);
      expect(result).to.deep.include({
        'medic-sentinel': { created: [], deleted: [], updated: [] },
        'medic-logs': { created: [], deleted: [], updated: [] },
        'medic-users-meta': { created: [], deleted: [], updated: [] },
        '_users': { created: [], deleted: [], updated: [] },
      });
    }));

    it('detects deleted ddocs in target version', run(function* () {
      const deletedDdoc = { _id: '_design/deleted-ddoc', views: { old_view: {} } };
      const baseStagingAttachments = { _attachments: {
        'ddocs/medic.json': createAttachment([medicDdoc, deletedDdoc]),
        'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
        'ddocs/logs.json': createAttachment([logsDdoc]),
        'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
        'ddocs/users.json': createAttachment([usersDdoc]),
      } };
      const targetStagingAttachments = { _attachments: {
        'ddocs/medic.json': createAttachment([medicDdoc]),
        'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
        'ddocs/logs.json': createAttachment([logsDdoc]),
        'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
        'ddocs/users.json': createAttachment([usersDdoc]),
      } };
      dbGet
        .withArgs(`medic:medic:${currentVersion}`, { attachments: true }).resolves(baseStagingAttachments)
        .withArgs(`medic:medic:${targetVersion}`, { attachments: true }).resolves(targetStagingAttachments);

      const result = yield* getStagingDdocsDiff(currentVersion, targetVersion);

      expect(result.medic.created).to.deep.equal([]);
      expect(result.medic.deleted.length).to.equal(1);
      expect(result.medic.deleted[0]).to.deep.include(deletedDdoc);
      expect(result.medic.updated).to.deep.equal([]);
      expect(result).to.deep.include({
        'medic-sentinel': { created: [], deleted: [], updated: [] },
        'medic-logs': { created: [], deleted: [], updated: [] },
        'medic-users-meta': { created: [], deleted: [], updated: [] },
        '_users': { created: [], deleted: [], updated: [] },
      });
    }));

    [
      {
        baseMedicDdoc: { _id: '_design/medic', views: { contacts_by_depth: { map: 'old' } } },
        targetMedicDdoc: { _id: '_design/medic', views: { contacts_by_depth: { map: 'new' } } }
      },
      {
        baseMedicDdoc: { _id: '_design/medic', views: {}, nouveau: { search: 'old' } },
        targetMedicDdoc: { _id: '_design/medic', views: {}, nouveau: { search: 'new' } },
      }
    ].forEach(({ baseMedicDdoc, targetMedicDdoc }) => {
      it('detects updated ddocs when views change', run(function* () {
        const baseStagingAttachments = { _attachments: {
          'ddocs/medic.json': createAttachment([baseMedicDdoc]),
          'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
          'ddocs/logs.json': createAttachment([logsDdoc]),
          'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
          'ddocs/users.json': createAttachment([usersDdoc]),
        } };
        const targetStagingAttachments = { _attachments: {
          'ddocs/medic.json': createAttachment([targetMedicDdoc]),
          'ddocs/sentinel.json': createAttachment([sentinelDdoc]),
          'ddocs/logs.json': createAttachment([logsDdoc]),
          'ddocs/users-meta.json': createAttachment([usersMetaDdoc]),
          'ddocs/users.json': createAttachment([usersDdoc]),
        } };
        dbGet
          .withArgs(`medic:medic:${currentVersion}`, { attachments: true }).resolves(baseStagingAttachments)
          .withArgs(`medic:medic:${targetVersion}`, { attachments: true }).resolves(targetStagingAttachments);

        const result = yield* getStagingDdocsDiff(currentVersion, targetVersion);

        expect(result.medic.created).to.deep.equal([]);
        expect(result.medic.deleted).to.deep.equal([]);
        expect(result.medic.updated.length).to.equal(1);
        expect(result.medic.updated[0]).to.deep.include(targetMedicDdoc);
        expect(result).to.deep.include({
          'medic-sentinel': { created: [], deleted: [], updated: [] },
          'medic-logs': { created: [], deleted: [], updated: [] },
          'medic-users-meta': { created: [], deleted: [], updated: [] },
          '_users': { created: [], deleted: [], updated: [] },
        });
      }));
    });
  });
});
