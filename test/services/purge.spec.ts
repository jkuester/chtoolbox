import { describe, it } from 'mocha';
import { Array, Chunk, Effect, Layer, Option, Stream } from 'effect';
import sinon, { SinonStub } from 'sinon';
import * as pouchDBService from '../../src/services/pouchdb.js';
import { PouchDBService } from '../../src/services/pouchdb.js';
import { expect } from 'chai';
import { PurgeService } from '../../src/services/purge.js';
import * as couchPurgeService from '../../src/libs/couch/purge.js';
import { genWithLayer, sandbox } from '../utils/base.js';
import { ChtClientService } from '../../src/services/cht-client.js';

const FAKE_DB = { name: 'test-db', allDocs: () => null } as const;

const pouchGet = sandbox.stub();
const purgeFromInner = sandbox.stub();

const run = PurgeService.Default.pipe(
  Layer.provide(Layer.succeed(PouchDBService, {
    get: pouchGet,
  } as unknown as PouchDBService),),
  Layer.provide(Layer.succeed(ChtClientService, {} as unknown as ChtClientService)),
  genWithLayer,
);

describe('Purge Service', () => {
  let purgeFrom: SinonStub;

  beforeEach(() => {
    purgeFromInner.returns(Effect.void);
    purgeFrom = sinon.stub(couchPurgeService, 'purgeFrom').returns(purgeFromInner);
    pouchGet.returns(Effect.succeed(FAKE_DB));
  });

  describe('purgeAll', () => {
    let streamAllDocPagesInner: SinonStub;
    let streamAllDocPages: SinonStub;

    beforeEach(() => {
      streamAllDocPagesInner = sinon.stub();
      streamAllDocPages = sinon.stub(pouchDBService, 'streamAllDocPages').returns(streamAllDocPagesInner);
    });

    it('purges all rows except ddocs', run(function* () {
      const expectedResponses = [
        { rows: [{ id: '1', value: { rev: 'a' } }, { id: '_design/3', value: { rev: 'c' } }] },
        { rows: [{ id: '2', value: { rev: 'b' } }] },
        { rows: [{ id: '_design/4', value: { rev: 'd' } }] },
      ];
      streamAllDocPagesInner.returns(Stream.make(...expectedResponses));

      const stream = yield* PurgeService.purgeAll(FAKE_DB.name);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal(expectedResponses);
      expect(pouchGet.calledOnceWithExactly(FAKE_DB.name)).to.be.true;
      expect(streamAllDocPages.calledOnceWithExactly({ limit: 100, skip: 0 })).to.be.true;
      expect(streamAllDocPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(purgeFrom.args).to.deep.equal(Array.replicate([FAKE_DB.name], 3));
      expect(purgeFromInner.args).to.deep.equal([
        [[{ _id: '1', _rev: 'a' }]],
        [[{ _id: '2', _rev: 'b' }]],
      ]);
    }));

    it('purges all rows when purgeDdocs is true', run(function* () {
      const expectedResponses = [
        { rows: [{ id: '1', value: { rev: 'a' } }, { id: '_design/3', value: { rev: 'c' } }] },
        { rows: [{ id: '2', value: { rev: 'b' } }] },
      ];
      streamAllDocPagesInner.returns(Stream.make(...expectedResponses));

      const stream = yield* PurgeService.purgeAll(FAKE_DB.name, true);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal(expectedResponses);
      expect(pouchGet.calledOnceWithExactly(FAKE_DB.name)).to.be.true;
      expect(streamAllDocPages.calledOnceWithExactly({ limit: 100, skip: 0 })).to.be.true;
      expect(streamAllDocPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(purgeFrom.args).to.deep.equal(Array.replicate([FAKE_DB.name], 2));
      expect(purgeFromInner.args).to.deep.equal([
        [[{ _id: '1', _rev: 'a' }, { _id: '_design/3', _rev: 'c' }]],
        [[{ _id: '2', _rev: 'b' }]],
      ]);
    }));

    it('does not purge anything if nothing is found', run(function* () {
      streamAllDocPagesInner.returns(Stream.empty);

      const stream = yield* PurgeService.purgeAll(FAKE_DB.name, true);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([]);
      expect(pouchGet.calledOnceWithExactly(FAKE_DB.name)).to.be.true;
      expect(streamAllDocPages.calledOnceWithExactly({ limit: 100, skip: 0 })).to.be.true;
      expect(streamAllDocPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(purgeFrom.notCalled).to.be.true;
      expect(purgeFromInner.notCalled).to.be.true;
    }));
  });

  describe('purgeReports', () => {
    const viewName = 'medic-client/reports_by_date';
    let streamQueryPagesInner: SinonStub;
    let streamQueryPages: SinonStub;
    let dbAllDocs: SinonStub;

    beforeEach(() => {
      streamQueryPagesInner = sinon.stub();
      streamQueryPages = sinon.stub(pouchDBService, 'streamQueryPages').returns(streamQueryPagesInner);
      dbAllDocs = sinon.stub(FAKE_DB, 'allDocs');
    });

    it('purges all rows returned from medic-client/reports_by_date', run(function* () {
      const streamQueryResponses = [
        { rows: [{ id: '1' }, { id: '3' }] },
        { rows: [{ id: '2' }] },
        { rows: [{ id: '4' }] },
      ];
      streamQueryPagesInner.returns(Stream.make(...streamQueryResponses));
      dbAllDocs.onFirstCall().resolves({ rows: [{ id: '1', value: { rev: 'a' } }, { id: '3', value: { rev: 'b' } }] });
      dbAllDocs.onSecondCall().resolves({ rows: [{ id: '2', value: { rev: 'c' } }] });
      dbAllDocs.onThirdCall().resolves({ rows: [{ id: '4', value: { rev: 'd' } }] });
      const opts = { since: Option.none(), before: Option.none() };

      const stream = yield* PurgeService.purgeReports(FAKE_DB.name, opts);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal(streamQueryResponses);
      expect(pouchGet.args).to.deep.equal(Array.replicate([FAKE_DB.name], 4));
      expect(streamQueryPages.calledOnceWithExactly(
        viewName,
        { limit: 100, skip: 0, startkey: undefined, endkey: undefined }
      )).to.be.true;
      expect(streamQueryPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(dbAllDocs.args).to.deep.equal([
        [{ keys: ['1', '3'] }],
        [{ keys: ['2'] }],
        [{ keys: ['4'] }],
      ]);
      expect(purgeFrom.args).to.deep.equal(Array.replicate([FAKE_DB.name], 3));
      expect(purgeFromInner.args).to.deep.equal([
        [[{ _id: '1', _rev: 'a' }, { _id: '3', _rev: 'b' }]],
        [[{ _id: '2', _rev: 'c' }]],
        [[{ _id: '4', _rev: 'd' }]],
      ]);
    }));

    it('does not purge anything if nothing is found when querying', run(function* () {
      streamQueryPagesInner.returns(Stream.empty);
      const opts = { since: Option.none(), before: Option.none() };

      const stream = yield* PurgeService.purgeReports(FAKE_DB.name, opts);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([]);
      expect(pouchGet.calledOnceWithExactly(FAKE_DB.name)).to.be.true;
      expect(streamQueryPages.calledOnceWithExactly(
        viewName,
        { limit: 100, skip: 0, startkey: undefined, endkey: undefined }
      )).to.be.true;
      expect(streamQueryPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(dbAllDocs.notCalled).to.be.true;
      expect(purgeFrom.notCalled).to.be.true;
      expect(purgeFromInner.notCalled).to.be.true;
    }));

    it('does not purge anything if none of the queried docs exist', run(function* () {
      const streamQueryResponses = [
        { rows: [{ id: '1' }, { id: '3' }] },
        { rows: [{ id: '2' }] },
        { rows: [{ id: '4' }] },
      ];
      streamQueryPagesInner.returns(Stream.make(...streamQueryResponses));
      dbAllDocs.onFirstCall().resolves({ rows: [{ error: 'not_found' }, { error: 'not_found' }] });
      dbAllDocs.onSecondCall().resolves({ rows: [{ error: 'not_found' }] });
      dbAllDocs.onThirdCall().resolves({ rows: [] });
      const opts = { since: Option.none(), before: Option.none() };

      const stream = yield* PurgeService.purgeReports(FAKE_DB.name, opts);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal(streamQueryResponses);
      expect(pouchGet.args).to.deep.equal(Array.replicate([FAKE_DB.name], 4));
      expect(streamQueryPages.calledOnceWithExactly(
        viewName,
        { limit: 100, skip: 0, startkey: undefined, endkey: undefined }
      )).to.be.true;
      expect(streamQueryPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(dbAllDocs.args).to.deep.equal([
        [{ keys: ['1', '3'] }],
        [{ keys: ['2'] }],
        [{ keys: ['4'] }],
      ]);
      expect(purgeFrom.args).to.deep.equal(Array.replicate([FAKE_DB.name], 3));
      expect(purgeFromInner.notCalled).to.be.true;
    }));

    it('purges rows for query filtered by provided options', run(function* () {
      const streamQueryResponses = [
        { rows: [{ id: '1' }] },
      ];
      streamQueryPagesInner.returns(Stream.make(...streamQueryResponses));
      dbAllDocs.resolves({ rows: [{ id: '1', value: { rev: 'a' } }] });
      const sinceDate = new Date('2021-01-01');
      const beforeDate = new Date('2021-02-01');
      const opts = { since: Option.some(sinceDate), before: Option.some(beforeDate) };

      const stream = yield* PurgeService.purgeReports(FAKE_DB.name, opts);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal(streamQueryResponses);
      expect(pouchGet.args).to.deep.equal(Array.replicate([FAKE_DB.name], 2));
      expect(streamQueryPages.calledOnceWithExactly(
        viewName,
        { limit: 100, skip: 0, startkey: [sinceDate.getTime()], endkey: [beforeDate.getTime()] }
      )).to.be.true;
      expect(streamQueryPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(dbAllDocs.args).to.deep.equal([[{ keys: ['1'] }]]);
      expect(purgeFrom.args).to.deep.equal(Array.replicate([FAKE_DB.name], 1));
      expect(purgeFromInner.args).to.deep.equal([[[{ _id: '1', _rev: 'a' }]]]);
    }));
  });

  describe('purgeContacts', () => {
    const viewName = 'medic-client/contacts_by_type';
    let streamQueryPagesInner: SinonStub;
    let streamQueryPages: SinonStub;
    let dbAllDocs: SinonStub;

    beforeEach(() => {
      streamQueryPagesInner = sinon.stub();
      streamQueryPages = sinon.stub(pouchDBService, 'streamQueryPages').returns(streamQueryPagesInner);
      dbAllDocs = sinon.stub(FAKE_DB, 'allDocs');
    });

    it('purges all rows returned from medic-client/contacts_by_type', run(function* () {
      const streamQueryResponses = [
        { rows: [{ id: '1' }, { id: '3' }] },
        { rows: [{ id: '2' }] },
        { rows: [{ id: '4' }] },
      ];
      streamQueryPagesInner.returns(Stream.make(...streamQueryResponses));
      dbAllDocs.onFirstCall().resolves({ rows: [{ id: '1', value: { rev: 'a' } }, { id: '3', value: { rev: 'b' } }] });
      dbAllDocs.onSecondCall().resolves({ rows: [{ id: '2', value: { rev: 'c' } }] });
      dbAllDocs.onThirdCall().resolves({ rows: [{ id: '4', value: { rev: 'd' } }] });
      const contactType = 'person';

      const stream = yield* PurgeService.purgeContacts(FAKE_DB.name, contactType);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal(streamQueryResponses);
      expect(pouchGet.args).to.deep.equal(Array.replicate([FAKE_DB.name], 4));
      expect(streamQueryPages.calledOnceWithExactly(
        viewName,
        { limit: 100, skip: 0, key: [contactType] }
      )).to.be.true;
      expect(streamQueryPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(dbAllDocs.args).to.deep.equal([
        [{ keys: ['1', '3'] }],
        [{ keys: ['2'] }],
        [{ keys: ['4'] }],
      ]);
      expect(purgeFrom.args).to.deep.equal(Array.replicate([FAKE_DB.name], 3));
      expect(purgeFromInner.args).to.deep.equal([
        [[{ _id: '1', _rev: 'a' }, { _id: '3', _rev: 'b' }]],
        [[{ _id: '2', _rev: 'c' }]],
        [[{ _id: '4', _rev: 'd' }]],
      ]);
    }));

    it('does not purge anything if nothing is found when querying', run(function* () {
      streamQueryPagesInner.returns(Stream.empty);
      const contactType = 'person';

      const stream = yield* PurgeService.purgeContacts(FAKE_DB.name, contactType);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([]);
      expect(pouchGet.calledOnceWithExactly(FAKE_DB.name)).to.be.true;
      expect(streamQueryPages.calledOnceWithExactly(
        viewName,
        { limit: 100, skip: 0, key: [contactType] }
      )).to.be.true;
      expect(streamQueryPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(dbAllDocs.notCalled).to.be.true;
      expect(purgeFrom.notCalled).to.be.true;
      expect(purgeFromInner.notCalled).to.be.true;
    }));

    it('does not purge anything if none of the queried docs exist', run(function* () {
      const streamQueryResponses = [
        { rows: [{ id: '1' }, { id: '3' }] },
        { rows: [{ id: '2' }] },
        { rows: [{ id: '4' }] },
      ];
      streamQueryPagesInner.returns(Stream.make(...streamQueryResponses));
      dbAllDocs.onFirstCall().resolves({ rows: [{ error: 'not_found' }, { error: 'not_found' }] });
      dbAllDocs.onSecondCall().resolves({ rows: [{ error: 'not_found' }] });
      dbAllDocs.onThirdCall().resolves({ rows: [] });
      const contactType = 'person';

      const stream = yield* PurgeService.purgeContacts(FAKE_DB.name, contactType);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal(streamQueryResponses);
      expect(pouchGet.args).to.deep.equal(Array.replicate([FAKE_DB.name], 4));
      expect(streamQueryPages.calledOnceWithExactly(
        viewName,
        { limit: 100, skip: 0, key: [contactType] }
      )).to.be.true;
      expect(streamQueryPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(dbAllDocs.args).to.deep.equal([
        [{ keys: ['1', '3'] }],
        [{ keys: ['2'] }],
        [{ keys: ['4'] }],
      ]);
      expect(purgeFrom.args).to.deep.equal(Array.replicate([FAKE_DB.name], 3));
      expect(purgeFromInner.notCalled).to.be.true;
    }));
  });
});
