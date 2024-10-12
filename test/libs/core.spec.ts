import { describe, it } from 'mocha';
import { Effect, TestContext } from 'effect';
import { expect } from 'chai';
import { pouchDB, untilEmptyCount } from '../../src/libs/core';
import PouchDB from 'pouchdb-core';
import PouchDBAdapterHttp from 'pouchdb-adapter-http';

describe('Core libs', () => {
  const run = (test:  Effect.Effect<void>) => async () => {
    await Effect.runPromise(test.pipe(Effect.provide(TestContext.TestContext)));
  };

  it('untilEmptyCount', run(Effect.gen(function* () {
    const isArrayEmpty = untilEmptyCount(3);

    expect(yield* isArrayEmpty([1])).to.be.false;
    expect(yield* isArrayEmpty([])).to.be.false;
    expect(yield* isArrayEmpty([])).to.be.false;
    expect(yield* isArrayEmpty([1])).to.be.false;
    expect(yield* isArrayEmpty([])).to.be.false;
    expect(yield* isArrayEmpty([])).to.be.false;
    expect(yield* isArrayEmpty([])).to.be.true;
  })));

  it('pouchDB', () => {
    PouchDB.plugin(PouchDBAdapterHttp);
    const db = pouchDB('http://test.db');

    expect(db).to.be.an.instanceOf(PouchDB);
  });
});
