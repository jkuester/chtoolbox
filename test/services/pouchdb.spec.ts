import { describe, it } from 'mocha';
import { Effect, Either, Layer, Redacted, TestContext } from 'effect';
import sinon, { SinonStub } from 'sinon';
import * as core from '../../src/libs/core';
import { assertPouchResponse, PouchDBService } from '../../src/services/pouchdb';
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
});
