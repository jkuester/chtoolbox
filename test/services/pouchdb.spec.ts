import { describe, it } from 'mocha';
import { Config, Effect, Layer, Redacted, Ref, TestContext } from 'effect';
import sinon, { SinonStub } from 'sinon';
import * as core from '../../src/libs/core';
import { PouchDBService, PouchDBServiceLive } from '../../src/services/pouchdb';
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
      Effect.provide(PouchDBServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(EnvironmentService, EnvironmentService.of({
        get: environmentGet,
      }))),
    ));
  };

  [
    'http://localhost:5984',
    'http://localhost:5984/',
  ].forEach(url => {
    it('prepends the url to the request', run(Effect.gen(function* () {
      const dbName = 'test-db';
      const env = yield* Redacted.make(url).pipe(
        Config.succeed,
        Ref.make,
        Effect.map(url => ({ url }))
      );
      environmentGet.returns(env);
      pouchDB.returns(FAKE_POUCHDB);

      const pouchSvc = yield* PouchDBService;
      const testDb = yield* pouchSvc.get(dbName);

      expect(testDb).to.equal(FAKE_POUCHDB);
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(pouchDB.calledOnceWithExactly(`http://localhost:5984/${dbName}`)).to.be.true;
    })));
  });

  it('returns different PouchDB instances for each database name', run(Effect.gen(function* () {
    const url = 'http://localhost:5984';
    const testDbName = 'test-db';
    const medicDbName = 'medic';
    const env = yield* Redacted.make(url).pipe(
      Config.succeed,
      Ref.make,
      Effect.map(url => ({ url }))
    );
    environmentGet.returns(env);
    pouchDB.onFirstCall().returns(FAKE_POUCHDB);
    const fakeMedicDb = { medic: 'db' };
    pouchDB.onSecondCall().returns(fakeMedicDb);

    const pouchSvc = yield* PouchDBService;
    const testDb = yield* pouchSvc.get(testDbName);
    const medicDb = yield* pouchSvc.get(medicDbName);

    expect(testDb).to.equal(FAKE_POUCHDB);
    expect(medicDb).to.equal(fakeMedicDb);
    expect(environmentGet.calledTwice).to.be.true;
    expect(pouchDB.args).to.deep.equal([
      [`${url}/${testDbName}`],
      [`${url}/${medicDbName}`],
    ]);
  })));

  it('returns the same PouchDB instance when called multiple times with the same name', run(Effect.gen(function* () {
    const url = 'http://localhost:5984';
    const dbName = 'test-db';
    const env = yield* Redacted.make(url).pipe(
      Config.succeed,
      Ref.make,
      Effect.map(url => ({ url }))
    );
    environmentGet.returns(env);
    pouchDB.onFirstCall().returns(FAKE_POUCHDB);
    const fakeMedicDb = { medic: 'db' };
    pouchDB.onSecondCall().returns(fakeMedicDb);

    const pouchSvc = yield* PouchDBService;
    const testDb = yield* pouchSvc.get(dbName);
    const testDb1 = yield* pouchSvc.get(dbName);

    expect(testDb).to.equal(FAKE_POUCHDB);
    expect(testDb1).to.equal(FAKE_POUCHDB);
    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(pouchDB.calledOnceWithExactly(`${url}/${dbName}`)).to.be.true;
  })));
});
