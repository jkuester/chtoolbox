import { describe, it } from 'mocha';
import { Array, Chunk, Effect, Either, Layer, Option, Redacted, Stream, TestContext } from 'effect';
import sinon, { SinonStub } from 'sinon';
import * as core from '../../src/libs/core';
import {
  assertPouchResponse,
  PouchDBService,
  streamAllDocPages,
  streamChanges,
  streamQueryPages
} from '../../src/services/pouchdb';
import { EnvironmentService } from '../../src/services/environment';
import { expect } from 'chai';

const FAKE_POUCHDB = { hello: 'world' } as const;

describe('PouchDB Service', () => {
  let environmentGet: SinonStub;
  let pouchDB: SinonStub;

  beforeEach(() => {
    environmentGet = sinon.stub();
    pouchDB = sinon.stub(core, 'pouchDB');
  });

  afterEach(() => sinon.restore());

  const run = (test: Effect.Effect<unknown, unknown, PouchDBService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(PouchDBService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(EnvironmentService, {
        get: environmentGet,
      } as unknown as EnvironmentService)),
    ));
  };

  describe('streamChanges', () => {
    class FakeChangeEmitter {
      public on = sinon.stub().returns(this);
      public cancel = sinon.stub();
    }
    const fakeDdb = { changes: () => null } as unknown as PouchDB.Database;

    let streamAsync: SinonStub;
    let dbChanges: SinonStub;
    let fakeChangeEmitter: FakeChangeEmitter;

    beforeEach(() => {
      fakeChangeEmitter = new FakeChangeEmitter();
      streamAsync = sinon.stub(Stream, 'async');
      dbChanges = sinon
        .stub(fakeDdb, 'changes')
        .returns(fakeChangeEmitter as unknown as PouchDB.Core.Changes<object>);
    });

    it('builds stream from changes feed event emitter', run(Effect.gen(function* () {
      streamChanges()(fakeDdb);

      expect(streamAsync.calledOnce).to.be.true;
      const emit = sinon.stub();
      expect(streamAsync.calledOnce).to.be.true;
      const buildStreamFn = streamAsync.args[0][0] as (emit: unknown) => Effect.Effect<void>;
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
    })));

    it('caches the changes since index and reuses it if the stream is retried', () => {
      streamChanges({ since: 100 })(fakeDdb);

      const emit = sinon.stub();
      expect(streamAsync.calledOnce).to.be.true;
      const buildStreamFn = streamAsync.args[0][0] as (emit: unknown) => Effect.Effect<void>;
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
    });
  });

  describe('get', () => {
    it('prepends the url to the request', run(Effect.gen(function* () {
      const dbName = 'test-db';
      const url = 'http://localhost:5984/';
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      pouchDB.returns(FAKE_POUCHDB);

      const testDb = yield* PouchDBService.get(dbName);

      expect(testDb).to.equal(FAKE_POUCHDB);
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(pouchDB.calledOnceWithExactly(`${url}${dbName}`)).to.be.true;
    })));

    it('returns different PouchDB instances for each database name', run(Effect.gen(function* () {
      const url = 'http://localhost:5984/';
      const testDbName = 'test-db';
      const medicDbName = 'medic';
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      pouchDB.onFirstCall().returns(FAKE_POUCHDB);
      const fakeMedicDb = { medic: 'db' };
      pouchDB.onSecondCall().returns(fakeMedicDb);

      const testDb = yield* PouchDBService.get(testDbName);
      const medicDb = yield* PouchDBService.get(medicDbName);

      expect(testDb).to.equal(FAKE_POUCHDB);
      expect(medicDb).to.equal(fakeMedicDb);
      expect(environmentGet.calledTwice).to.be.true;
      expect(pouchDB.args).to.deep.equal([
        [`${url}${testDbName}`],
        [`${url}${medicDbName}`],
      ]);
    })));

    it('returns the same PouchDB instance when called multiple times with the same name', run(Effect.gen(function* () {
      const url = 'http://localhost:5984/';
      const dbName = 'test-db';
      const env = Redacted.make(url).pipe(url => ({ url }));
      environmentGet.returns(Effect.succeed(env));
      pouchDB.onFirstCall().returns(FAKE_POUCHDB);
      const fakeMedicDb = { medic: 'db' };
      pouchDB.onSecondCall().returns(fakeMedicDb);

      const testDb = yield* PouchDBService.get(dbName);
      const testDb1 = yield* PouchDBService.get(dbName);

      expect(testDb).to.equal(FAKE_POUCHDB);
      expect(testDb1).to.equal(FAKE_POUCHDB);
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(pouchDB.calledOnceWithExactly(`${url}${dbName}`)).to.be.true;
    })));
  });

  describe('assertPouchResponse', () => {
    [
      new Error('Response Error'),
      { hello: 'world' } as unknown as Error,
      { ok: false } as unknown as Error,
    ].forEach(expectedError => {
      it('throws an error if the response is not ok', () => {
        const respEither = Either.try(() => assertPouchResponse(expectedError));

        if (Either.isLeft(respEither)) {
          expect(respEither.left).to.equal(expectedError);
        } else {
          expect.fail('Expected an error');
        }
      });
    });

    it('succeeds with a value Pouch response', () => {
      const expectedResponse = { ok: true } as unknown as PouchDB.Core.Response;

      const response = assertPouchResponse(expectedResponse);

      expect(response).to.equal(expectedResponse);
    });
  });

  describe('streamAllDocPages', () => {
    const fakeDdb = { allDocs: () => null } as unknown as PouchDB.Database;
    let allDocs: SinonStub;

    beforeEach(() => {
      allDocs = sinon.stub(fakeDdb, 'allDocs');
    });

    it('streams pages of docs with the default options', run(Effect.gen(function* () {
      const firstResponse = { rows: Array.replicate({ id: '1', value: { rev: '1' } }, 1000) };
      const secondResponse = { rows: Array.replicate({ id: '3', value: { rev: '3' } }, 1000) };
      const thirdResponse = { rows: Array.replicate({ id: '2', value: { rev: '2' } }, 999) };
      allDocs.onFirstCall().resolves(firstResponse);
      allDocs.onSecondCall().resolves(secondResponse);
      allDocs.onThirdCall().resolves(thirdResponse);

      const stream = streamAllDocPages()(fakeDdb);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse, secondResponse, thirdResponse]);
      expect(allDocs.args).to.deep.equal([
        [{ limit: 1000, skip: 0 }],
        [{ limit: 1000, skip: 1000 }],
        [{ limit: 1000, skip: 2000 }]
      ]);
    })));

    it('streams pages of docs with the provided skip and limit', run(Effect.gen(function* () {
      const firstResponse = { rows: [{ id: '1', value: { rev: '1' } }, { id: '2', value: { rev: '2' } }] };
      const secondResponse = { rows: [{ id: '3', value: { rev: '3' } }] };
      allDocs.onFirstCall().resolves(firstResponse);
      allDocs.onSecondCall().resolves(secondResponse);

      const stream = streamAllDocPages({ limit: 2, skip: 0 })(fakeDdb);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse, secondResponse]);
      expect(allDocs.args).to.deep.equal([[{ limit: 2, skip: 0 }], [{ limit: 2, skip: 0 }]]);
    })));

    it('streams an empty page when no docs are found', run(Effect.gen(function* () {
      const firstResponse = { rows: [] };
      allDocs.onFirstCall().resolves(firstResponse);

      const stream = streamAllDocPages()(fakeDdb);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse]);
      expect(allDocs.args).to.deep.equal([[{ limit: 1000, skip: 0 }]]);
    })));
  });

  describe('streamQueryPages', () => {
    const indexName = 'test-index';
    const fakeDdb = { query: () => null } as unknown as PouchDB.Database;
    let query: SinonStub;

    beforeEach(() => {
      query = sinon.stub(fakeDdb, 'query');
    });

    it('streams pages of docs with the default options', run(Effect.gen(function* () {
      const firstResponse = { rows: Array.replicate({ id: '1' }, 1000) };
      const secondResponse = { rows: Array.replicate({ id: '3' }, 1000) };
      const thirdResponse = { rows: Array.replicate({ id: '2' }, 999) };
      query.onFirstCall().resolves(firstResponse);
      query.onSecondCall().resolves(secondResponse);
      query.onThirdCall().resolves(thirdResponse);

      const stream = streamQueryPages(indexName)(fakeDdb);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse, secondResponse, thirdResponse]);
      expect(query.args).to.deep.equal([
        [indexName, { limit: 1000, skip: 0 }],
        [indexName, { limit: 1000, skip: 1000 }],
        [indexName, { limit: 1000, skip: 2000 }]
      ]);
    })));

    it('streams pages of docs with the provided options', run(Effect.gen(function* () {
      const firstResponse = { rows: [{ id: '1' }, { id: '2' }] };
      const secondResponse = { rows: [{ id: '3' }] };
      query.onFirstCall().resolves(firstResponse);
      query.onSecondCall().resolves(secondResponse);
      const key = 'hello';

      const stream = streamQueryPages(indexName, { limit: 2, skip: 0, key })(fakeDdb);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse, secondResponse]);
      expect(query.args).to.deep.equal([
        [indexName, { limit: 2, skip: 0, key }],
        [indexName, { limit: 2, skip: 0, key }]
      ]);
    })));

    it('streams an empty page when no docs are found', run(Effect.gen(function* () {
      const firstResponse = { rows: [] };
      query.onFirstCall().resolves(firstResponse);

      const stream = streamQueryPages(indexName)(fakeDdb);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([firstResponse]);
      expect(query.args).to.deep.equal([[indexName, { limit: 1000, skip: 0 }]]);
    })));
  });
});
