import { describe, it } from 'mocha';
import { Array, Chunk, Effect, Either, Layer, Option, Redacted, Stream } from 'effect';
import sinon, { SinonStub } from 'sinon';
import PouchDB from 'pouchdb-core';
import * as PouchDbSvc from '../../src/services/pouchdb.js';
import { EnvironmentService } from '../../src/services/environment.js';
import { expect } from 'chai';
import { genWithLayer, sandbox } from '../utils/base.js';
import esmock from 'esmock';

const FAKE_POUCHDB = { hello: 'world' } as const;

const mockCore = { pouchDB: sandbox.stub() };
const mockStream = { async: sandbox.stub() };
const environmentGet = sandbox.stub();

const {
  getDoc,
  saveDoc,
  PouchDBService,
  streamAllDocPages,
  streamChanges,
  streamQueryPages
} = await esmock<typeof PouchDbSvc>('../../src/services/pouchdb.js', {
  '../../src/libs/core.js': mockCore,
  'effect': { Stream: { ...Stream, ...mockStream } },
});
const run = PouchDBService.Default.pipe(
  Layer.provide(Layer.succeed(EnvironmentService, { get: environmentGet } as unknown as EnvironmentService)),
  genWithLayer,
);

describe('PouchDB Service', () => {
  describe('streamChanges', () => {
    const url = 'https://localhost:5984/';
    const dbName = 'medic';
    class FakeChangeEmitter {
      public on = sinon.stub().returns(this);
      public cancel = sinon.stub();
    }
    const fakeDdb = { changes: () => null } as unknown as PouchDB.Database;

    let dbChanges: SinonStub;
    let fakeChangeEmitter: FakeChangeEmitter;

    beforeEach(() => {
      fakeChangeEmitter = new FakeChangeEmitter();
      dbChanges = sinon
        .stub(fakeDdb, 'changes')
        .returns(fakeChangeEmitter as unknown as PouchDB.Core.Changes<object>);
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      mockCore.pouchDB.returns(fakeDdb);
    });

    afterEach(() => {
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(mockCore.pouchDB.calledOnce).to.be.true;
      expect(mockCore.pouchDB.args[0][0]).to.equal(`${url}${dbName}`);
    });

    it('builds stream from changes feed event emitter', run(function* () {
      yield* streamChanges(dbName)();

      expect(mockStream.async.calledOnce).to.be.true;
      const emit = sinon.stub();
      expect(mockStream.async.calledOnce).to.be.true;
      const buildStreamFn = mockStream.async.args[0][0] as (emit: unknown) => Effect.Effect<void>;
      const cancelStreamEffect = buildStreamFn(emit);

      expect(emit.notCalled).to.be.true;
      expect(dbChanges.calledOnceWithExactly({ since: 0, live: true })).to.be.true;
      expect(fakeChangeEmitter.on.calledThrice).to.be.true;
      const [errorArgs, completeArgs, changeArgs] = fakeChangeEmitter.on.args;

      expect(errorArgs[0]).to.equal('error');
      const expectedError = new Error('Error streaming changes feed');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      errorArgs[1](expectedError);
      expect(emit.calledOnceWithExactly(Effect.fail(Option.some(expectedError)))).to.be.true;
      emit.reset();

      expect(completeArgs[0]).to.equal('complete');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      completeArgs[1]();
      expect(emit.calledOnceWithExactly(Effect.fail(Option.none()))).to.be.true;
      emit.reset();

      expect(changeArgs[0]).to.equal('change');
      const expectedChange = { hello: 'world' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      changeArgs[1](expectedChange);
      expect(emit.calledOnce).to.be.true;
      expect(emit.args[0][0]).to.deep.equal(Effect.succeed(Chunk.of(expectedChange)));

      yield* cancelStreamEffect;
      expect(fakeChangeEmitter.cancel.calledOnceWithExactly()).to.be.true;
    }));

    it('caches the changes since index and reuses it if the stream is retried', run(function* () {
      yield* streamChanges(dbName)({ since: 100 });

      const emit = sinon.stub();
      expect(mockStream.async.calledOnce).to.be.true;
      const buildStreamFn = mockStream.async.args[0][0] as (emit: unknown) => Effect.Effect<void>;
      buildStreamFn(emit);

      // First call to changes has since value from options
      expect(dbChanges.calledOnceWithExactly({ since: 100, live: true })).to.be.true;
      dbChanges.resetHistory();
      expect(fakeChangeEmitter.on.calledThrice).to.be.true;
      const [,, changeArgs] = fakeChangeEmitter.on.args;

      // Change event returns new since value
      expect(changeArgs[0]).to.equal('change');
      const expectedChange = { seq: 101 };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      changeArgs[1](expectedChange);
      expect(emit.calledOnce).to.be.true;
      expect(emit.args[0][0]).to.deep.equal(Effect.succeed(Chunk.of(expectedChange)));

      // Subsequent call to changes uses the new since value
      buildStreamFn(emit);
      expect(dbChanges.calledOnceWithExactly({ since: 101, live: true })).to.be.true;
    }));
  });

  describe('get', () => {
    it('prepends the url to the request', run(function* () {
      const dbName = 'test-db';
      const url = 'https://localhost:5984/';
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      mockCore.pouchDB.returns(FAKE_POUCHDB);
      const fakeRequest = { fake: 'request' };
      const pouchFetch = sinon.stub(PouchDB, 'fetch').returns(fakeRequest as unknown as Promise<Response>);

      const testDb = yield* PouchDBService.get(dbName);

      expect(testDb).to.equal(FAKE_POUCHDB);
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(mockCore.pouchDB.calledOnce).to.be.true;
      expect(mockCore.pouchDB.args[0][0]).to.equal(`${url}${dbName}`);
      expect(mockCore.pouchDB.args[0][1]).to.haveOwnProperty('fetch');

      // Verify the fetch is overridden with the agent option
      const fetch = (mockCore.pouchDB.args[0][1] as { fetch: (url: string, opts: unknown) => unknown }).fetch;
      const fakeOptions = { hello: 'world' };
      const req = fetch(url, fakeOptions);
      expect(req).to.equal(fakeRequest);
      expect(pouchFetch.calledOnce).to.be.true;
      expect(pouchFetch.args[0][0]).to.equal(url);
      expect(pouchFetch.args[0][1]).to.deep.include(fakeOptions);
      expect(pouchFetch.args[0][1]).to.haveOwnProperty('agent').that.is.not.undefined;
    }));

    it('does not include agent for http url', run(function* () {
      const dbName = 'test-db';
      const url = 'http://localhost:5984/';
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      mockCore.pouchDB.returns(FAKE_POUCHDB);
      const fakeRequest = { fake: 'request' };
      const pouchFetch = sinon.stub(PouchDB, 'fetch').returns(fakeRequest as unknown as Promise<Response>);

      const testDb = yield* PouchDBService.get(dbName);

      expect(testDb).to.equal(FAKE_POUCHDB);
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(mockCore.pouchDB.calledOnce).to.be.true;
      expect(mockCore.pouchDB.args[0][0]).to.equal(`${url}${dbName}`);
      expect(mockCore.pouchDB.args[0][1]).to.haveOwnProperty('fetch');

      // Verify the fetch is overridden with the agent option
      const fetch = (mockCore.pouchDB.args[0][1] as { fetch: (url: string, opts: unknown) => unknown }).fetch;
      const fakeOptions = { hello: 'world' };
      const req = fetch(url, fakeOptions);
      expect(req).to.equal(fakeRequest);
      expect(pouchFetch.calledOnce).to.be.true;
      expect(pouchFetch.args[0][0]).to.equal(url);
      expect(pouchFetch.args[0][1]).to.deep.include(fakeOptions);
      expect(pouchFetch.args[0][1]).to.haveOwnProperty('agent').that.is.undefined;
    }));

    it('returns different PouchDB instances for each database name', run(function* () {
      const url = 'http://localhost:5984/';
      const testDbName = 'test-db';
      const medicDbName = 'medic';
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      mockCore.pouchDB.onFirstCall().returns(FAKE_POUCHDB);
      const fakeMedicDb = { medic: 'db' };
      mockCore.pouchDB.onSecondCall().returns(fakeMedicDb);

      const testDb = yield* PouchDBService.get(testDbName);
      const medicDb = yield* PouchDBService.get(medicDbName);

      expect(testDb).to.equal(FAKE_POUCHDB);
      expect(medicDb).to.equal(fakeMedicDb);
      expect(environmentGet.calledTwice).to.be.true;

      expect(mockCore.pouchDB.calledTwice).to.be.true;
      expect(mockCore.pouchDB.args[0][0]).to.equal(`${url}${testDbName}`);
      expect(mockCore.pouchDB.args[0][1]).to.haveOwnProperty('fetch');
      expect(mockCore.pouchDB.args[1][0]).to.equal(`${url}${medicDbName}`);
      expect(mockCore.pouchDB.args[1][1]).to.haveOwnProperty('fetch');
    }));

    it('returns the same PouchDB instance when called multiple times with the same name', run(function* () {
      const url = 'http://localhost:5984/';
      const dbName = 'test-db';
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      mockCore.pouchDB.onFirstCall().returns(FAKE_POUCHDB);
      const fakeMedicDb = { medic: 'db' };
      mockCore.pouchDB.onSecondCall().returns(fakeMedicDb);

      const testDb = yield* PouchDBService.get(dbName);
      const testDb1 = yield* PouchDBService.get(dbName);

      expect(testDb).to.equal(FAKE_POUCHDB);
      expect(testDb1).to.equal(FAKE_POUCHDB);
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(mockCore.pouchDB.calledOnce).to.be.true;
      expect(mockCore.pouchDB.args[0][0]).to.equal(`${url}${dbName}`);
      expect(mockCore.pouchDB.args[0][1]).to.haveOwnProperty('fetch');
    }));
  });

  describe('streamAllDocPages', () => {
    const url = 'https://localhost:5984/';
    const dbName = 'medic';
    const fakeDdb = { allDocs: () => null } as unknown as PouchDB.Database;
    let allDocs: SinonStub;

    beforeEach(() => {
      allDocs = sinon.stub(fakeDdb, 'allDocs');
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      mockCore.pouchDB.returns(fakeDdb);
    });

    afterEach(() => {
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(mockCore.pouchDB.calledOnce).to.be.true;
      expect(mockCore.pouchDB.args[0][0]).to.equal(`${url}${dbName}`);
    });

    it('streams pages of docs with the default options', run(function* () {
      const firstResponse = { rows: Array.replicate({ id: '1', value: { rev: '1' } }, 1000) };
      const secondResponse = { rows: Array.replicate({ id: '3', value: { rev: '3' } }, 1000) };
      const thirdResponse = { rows: Array.replicate({ id: '2', value: { rev: '2' } }, 999) };
      allDocs.onFirstCall().resolves(firstResponse);
      allDocs.onSecondCall().resolves(secondResponse);
      allDocs.onThirdCall().resolves(thirdResponse);

      const stream = yield* streamAllDocPages(dbName)();
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse, secondResponse, thirdResponse]);
      expect(allDocs.args).to.deep.equal([
        [{ limit: 1000, skip: 0 }],
        [{ limit: 1000, skip: 1000 }],
        [{ limit: 1000, skip: 2000 }]
      ]);
    }));

    it('streams pages of docs with the provided skip and limit', run(function* () {
      const firstResponse = { rows: [{ id: '1', value: { rev: '1' } }, { id: '2', value: { rev: '2' } }] };
      const secondResponse = { rows: [{ id: '3', value: { rev: '3' } }] };
      allDocs.onFirstCall().resolves(firstResponse);
      allDocs.onSecondCall().resolves(secondResponse);

      const stream = yield* streamAllDocPages(dbName)({ limit: 2, skip: 0 });
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse, secondResponse]);
      expect(allDocs.args).to.deep.equal([[{ limit: 2, skip: 0 }], [{ limit: 2, skip: 0 }]]);
    }));

    it('streams an empty page when no docs are found', run(function* () {
      const firstResponse = { rows: [] };
      allDocs.onFirstCall().resolves(firstResponse);

      const stream = yield* streamAllDocPages(dbName)();
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse]);
      expect(allDocs.args).to.deep.equal([[{ limit: 1000, skip: 0 }]]);
    }));
  });

  // describe('getAllDocs', () => {
  //   const url = 'https://localhost:5984/';
  //   const dbName = 'medic';
  //   const fakeDdb = { allDocs: () => null } as unknown as PouchDB.Database;
  //   let allDocs: SinonStub;
  //
  //   beforeEach(() => {
  //     allDocs = sinon.stub(fakeDdb, 'allDocs');
  //     const env = Redacted.make(url).pipe(url => ({ url }));
  //     environmentGet.returns(Effect.succeed(env));
  //     mockCore.pouchDB.returns(fakeDdb);
  //   });
  //
  //   afterEach(() => {
  //     expect(environmentGet.calledOnceWithExactly()).to.be.true;
  //     expect(mockCore.pouchDB.calledOnce).to.be.true;
  //     expect(mockCore.pouchDB.args[0][0]).to.equal(`${url}${dbName}`);
  //   });
  //
  //   it('returns an array of docs with the null values filtered out', run(function* () {
  //     const expectedDocs = [
  //       { _id: '1', _rev: '1', hello: 'world' },
  //       { _id: '2', _rev: '2', hello: 'again' }
  //     ];
  //     const rows = pipe(
  //       [null, ...expectedDocs, null],
  //       Array.map(doc => ({ doc }))
  //     );
  //     allDocs.resolves({ rows });
  //     const options = { limit: 42 };
  //
  //     const docs = yield* getAllDocs(dbName)(options);
  //
  //     expect(docs).to.deep.equal(expectedDocs);
  //     expect(allDocs.args).to.deep.equal([[{ ...options, include_docs: true }]]);
  //   }));
  //
  //   it('returns an empty array when no docs are found', run(function* () {
  //     allDocs.resolves({ rows: [] });
  //
  //     const docs = yield* getAllDocs(dbName)();
  //
  //     expect(docs).to.have.length(0);
  //     expect(allDocs.args).to.deep.equal([[{ include_docs: true }]]);
  //   }));
  // });

  // describe('deleteDocs', () => {
  //   const url = 'https://localhost:5984/';
  //   const dbName = 'medic';
  //   const fakeDdb = { bulkDocs: () => null } as unknown as PouchDB.Database;
  //   const docs = [
  //     { _id: '1', _rev: '1', hello: 'world' },
  //     { _id: '2', _rev: '2', hello: 'again' }
  //   ] as unknown as NonEmptyArray<PouchDB.Core.AllDocsMeta & PouchDB.Core.IdMeta & PouchDB.Core.RevisionIdMeta>;
  //   let bulkDocs: SinonStub;
  //
  //   beforeEach(() => {
  //     bulkDocs = sinon.stub(fakeDdb, 'bulkDocs');
  //     const env = Redacted.make(url).pipe(url => ({ url }));
  //     environmentGet.returns(Effect.succeed(env));
  //     mockCore.pouchDB.returns(fakeDdb);
  //   });
  //
  //   afterEach(() => {
  //     expect(environmentGet.calledOnceWithExactly()).to.be.true;
  //     expect(mockCore.pouchDB.calledOnce).to.be.true;
  //     expect(mockCore.pouchDB.args[0][0]).to.equal(`${url}${dbName}`);
  //   });
  //
  //   it('deletes the given docs', run(function* () {
  //     const expectedResult = [{ ok: true }, { ok: true }];
  //     bulkDocs.resolves(expectedResult);
  //
  //     const result = yield* deleteDocs(dbName)(docs);
  //
  //     expect(result).to.deep.equal(expectedResult);
  //     const expectedDocs = pipe(
  //       docs,
  //       Array.map(doc => ({ ...doc, _deleted: true }))
  //     );
  //     expect(bulkDocs.calledOnceWithExactly(expectedDocs)).to.be.true;
  //   }));
  //
  //   it('fails if there is a problem deleting any of the docs', run(function* () {
  //     const expectedResult = [{ ok: true }, { ok: false }];
  //     bulkDocs.resolves(expectedResult);
  //
  //     const either = yield* deleteDocs(dbName)(docs).pipe(Effect.either);
  //
  //     if (Either.isRight(either)) {
  //       expect.fail('Expected a failure but got a success');
  //     }
  //
  //     expect(either.left).to.deep.equal(expectedResult[1]);
  //     const expectedDocs = pipe(
  //       docs,
  //       Array.map(doc => ({ ...doc, _deleted: true }))
  //     );
  //     expect(bulkDocs.calledOnceWithExactly(expectedDocs)).to.be.true;
  //   }));
  // });

  describe('saveDoc', () => {
    const url = 'https://localhost:5984/';
    const dbName = 'medic';
    const fakeDdb = { put: () => null } as unknown as PouchDB.Database;
    const doc = {
      _id: '1', _rev: '1', hello: 'world'
    };
    let put: SinonStub;

    beforeEach(() => {
      put = sinon.stub(fakeDdb, 'put');
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      mockCore.pouchDB.returns(fakeDdb);
    });

    afterEach(() => {
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(mockCore.pouchDB.calledOnce).to.be.true;
      expect(mockCore.pouchDB.args[0][0]).to.equal(`${url}${dbName}`);
    });

    it('saves the given doc', run(function* () {
      const expectedResult = { ok: true };
      put.resolves(expectedResult);

      const result = yield* saveDoc(dbName)(doc);

      expect(result).to.deep.equal(expectedResult);
      expect(put.calledOnceWithExactly(doc)).to.be.true;
    }));

    it('saves the given doc with a new _id if none is provided', run(function* () {
      const expectedResult = { ok: true };
      put.resolves(expectedResult);
      const doc = { hello: 'world' };

      const result = yield* saveDoc(dbName)(doc);

      expect(result).to.deep.equal(expectedResult);
      expect(put.calledOnce).to.be.true;
      expect(put.args[0][0]).excludingEvery('_id').to.deep.equal(doc);
      expect(put.args[0][0]).to.have.property('_id').that.is.a('string').and.not.empty;
    }));

    it('fails if there is a problem saving the doc', run(function* () {
      const expectedResult = { ok: false };
      put.resolves(expectedResult);

      const either = yield* saveDoc(dbName)(doc).pipe(Effect.either);

      if (Either.isRight(either)) {
        expect.fail('Expected a failure but got a success');
      }

      expect(either.left).to.deep.equal(expectedResult);
      expect(put.calledOnceWithExactly(doc)).to.be.true;
    }));
  });

  describe('getDoc', () => {
    const url = 'https://localhost:5984/';
    const dbName = 'medic';
    const fakeDdb = { get: () => null } as unknown as PouchDB.Database;
    const docId = '1';
    let get: SinonStub;

    beforeEach(() => {
      get = sinon.stub(fakeDdb, 'get');
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      mockCore.pouchDB.returns(fakeDdb);
    });

    afterEach(() => {
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(mockCore.pouchDB.calledOnce).to.be.true;
      expect(mockCore.pouchDB.args[0][0]).to.equal(`${url}${dbName}`);
    });

    it('retrieves the doc with the given id', run(function* () {
      const expectedDoc = { _id: docId, _rev: '1', hello: 'world' };
      get.resolves(expectedDoc);

      const doc = yield* getDoc(dbName)(docId);

      expect(doc).to.deep.equal(Option.some(expectedDoc));
      expect(get.calledOnceWithExactly(docId)).to.be.true;
    }));

    it('returns None if the doc does not exist', run(function* () {
      get.rejects({ status: 404 });

      const doc = yield* getDoc(dbName)(docId);

      expect(doc).to.deep.equal(Option.none());
      expect(get.calledOnceWithExactly(docId)).to.be.true;
    }));
  });

  describe('streamQueryPages', () => {
    const url = 'https://localhost:5984/';
    const dbName = 'medic';
    const indexName = 'test-index';
    const fakeDdb = { query: () => null } as unknown as PouchDB.Database;
    let query: SinonStub;

    beforeEach(() => {
      query = sinon.stub(fakeDdb, 'query');
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      mockCore.pouchDB.returns(fakeDdb);
    });

    afterEach(() => {
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(mockCore.pouchDB.calledOnce).to.be.true;
      expect(mockCore.pouchDB.args[0][0]).to.equal(`${url}${dbName}`);
    });

    it('streams pages of docs with the default options', run(function* () {
      const firstResponse = { rows: Array.replicate({ id: '1' }, 1000) };
      const secondResponse = { rows: Array.replicate({ id: '3' }, 1000) };
      const thirdResponse = { rows: Array.replicate({ id: '2' }, 999) };
      query.onFirstCall().resolves(firstResponse);
      query.onSecondCall().resolves(secondResponse);
      query.onThirdCall().resolves(thirdResponse);

      const stream = yield* streamQueryPages(dbName, indexName)();
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse, secondResponse, thirdResponse]);
      expect(query.args).to.deep.equal([
        [indexName, { limit: 1000, skip: 0 }],
        [indexName, { limit: 1000, skip: 1000 }],
        [indexName, { limit: 1000, skip: 2000 }]
      ]);
    }));

    it('streams pages of docs with the provided options', run(function* () {
      const firstResponse = { rows: [{ id: '1' }, { id: '2' }] };
      const secondResponse = { rows: [{ id: '3' }] };
      query.onFirstCall().resolves(firstResponse);
      query.onSecondCall().resolves(secondResponse);
      const key = 'hello';

      const stream = yield* streamQueryPages(dbName, indexName)({ limit: 2, skip: 0, key });
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse, secondResponse]);
      expect(query.args).to.deep.equal([
        [indexName, { limit: 2, skip: 0, key }],
        [indexName, { limit: 2, skip: 0, key }]
      ]);
    }));

    it('streams an empty page when no docs are found', run(function* () {
      const firstResponse = { rows: [] };
      query.onFirstCall().resolves(firstResponse);

      const stream = yield* streamQueryPages(dbName, indexName)();
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse]);
      expect(query.args).to.deep.equal([[indexName, { limit: 1000, skip: 0 }]]);
    }));
  });
});
