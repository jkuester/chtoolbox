import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { Effect, Either, Encoding, pipe, TestContext } from 'effect';
import esmock from 'esmock';
import * as MedicStagingLib from '../../src/libs/medic-staging.ts';
import { sandbox } from '../utils/base.ts';

const STAGING_BUILDS_COUCH_URL = 'https://staging.dev.medicmobile.org/_couch/builds_4';

const mockShim = { pouchDB: sandbox.stub() };

const {
  CHT_DDOC_ATTACHMENT_NAMES,
  CHT_DATABASE_BY_ATTACHMENT_NAME,
  DesignDocAttachment,
  getDesignDocAttachments
} = await esmock<
  typeof MedicStagingLib
>('../../src/libs/medic-staging.ts', {
  '../../src/libs/shim.ts': mockShim,
});

const run = (test: Effect.Effect<void, unknown>) => async (): Promise<void> => {
  await Effect.runPromise(test.pipe(Effect.provide(TestContext.TestContext)));
};

describe('medic-staging libs', () => {
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

  it('DesignDocAttachment - decodes base64 encoded JSON attachment', run(Effect.gen(function* () {
    const docs = [
      { _id: '_design/medic', views: { 'contacts_by_depth': {} } },
      { _id: '_design/medic-client', views: { 'contacts_by_freetext': {} } }
    ];
    const base64Data = pipe({ docs }, JSON.stringify, Encoding.encodeBase64);
    const attachment = { data: base64Data } as PouchDB.Core.FullAttachment;

    const result = yield* DesignDocAttachment.decode(attachment);

    expect(result.docs.length).to.equal(2);
    const [firstDoc, secondDoc] = result.docs;
    expect(firstDoc).to.deep.include(docs[0]);
    expect(secondDoc).to.deep.include(docs[1]);
  })));

  describe('getDesignDocAttachments', () => {
    const version = '4.5.0';
    let dbGet: sinon.SinonStub;

    const medicDdoc = { _id: '_design/medic', views: { 'contacts_by_depth': {} } };
    const medicClientDdoc = { _id: '_design/medic-client', views: { 'contacts_by_freetext': {} } };
    const medicDdocAttachment = { docs: [medicDdoc, medicClientDdoc] };

    const sentinelDdoc = { _id: '_design/sentinel', views: { 'tasks_by_state': {} } };
    const sentinelDdocAttachment = { docs: [sentinelDdoc] };

    const logsDdoc = { _id: '_design/logs', views: { 'connected_users': {} } };
    const logsDdocAttachment = { docs: [logsDdoc] };

    const usersMetaDdoc = { _id: '_design/users-meta', views: { 'device_by_user': {} } };
    const usersMetaDdocAttachment = { docs: [usersMetaDdoc] };

    const usersDdoc = { _id: '_design/users', views: { 'users_by_field': {} } };
    const usersDdocAttachment = { docs: [usersDdoc] };

    beforeEach(() => {
      dbGet = sinon.stub();
      mockShim.pouchDB.returns({ get: dbGet });
    });

    it('fetches and decodes design doc attachments from staging builds', run(Effect.gen(function* () {
      dbGet.resolves({
        _attachments: {
          'ddocs/medic.json': { data: pipe(medicDdocAttachment, JSON.stringify, Encoding.encodeBase64) },
          'ddocs/sentinel.json': { data: pipe(sentinelDdocAttachment, JSON.stringify, Encoding.encodeBase64) },
          'ddocs/logs.json': { data: pipe(logsDdocAttachment, JSON.stringify, Encoding.encodeBase64) },
          'ddocs/users-meta.json': { data: pipe(usersMetaDdocAttachment, JSON.stringify, Encoding.encodeBase64) },
          'ddocs/users.json': { data: pipe(usersDdocAttachment, JSON.stringify, Encoding.encodeBase64) },
        }
      });

      const result = yield* getDesignDocAttachments(version);

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
      expect(dbGet.calledOnceWithExactly(`medic:medic:${version}`, { attachments: true })).to.be.true;
    })));

    it('fails when there are no attachments ', run(Effect.gen(function* () {
      dbGet.resolves({ });

      const either = yield* Effect.either(getDesignDocAttachments(version));

      expect(Either.isLeft(either)).to.be.true;
      expect(mockShim.pouchDB.calledOnceWithExactly(STAGING_BUILDS_COUCH_URL)).to.be.true;
      expect(dbGet.calledOnceWithExactly(`medic:medic:${version}`, { attachments: true })).to.be.true;
    })));
  });
});
