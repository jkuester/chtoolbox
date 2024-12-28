import { describe, it } from 'mocha';
import { Chunk, Effect, Stream, TestContext } from 'effect';
import { expect } from 'chai';
import { mergeArrayStreams, pouchDB, promisedGetPort, untilEmptyCount } from '../../src/libs/core';
import PouchDB from 'pouchdb-core';
import PouchDBAdapterHttp from 'pouchdb-adapter-http';

describe('Core libs', () => {
  const run = (test:  Effect.Effect<void, Error>) => async () => {
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

  it('promisedGetPort', async () => {
    const getPortLib = await promisedGetPort();
    expect(getPortLib.default).to.be.an.instanceOf(Function);
  });

  it('mergeArrayStreams', run(Effect.gen(function* () {
    const mergedStream = mergeArrayStreams([
      Stream.make([1, 2, 3], [4, 5, 6], [7, 8, 9]),
      Stream.make([1], [2], [3]),
      Stream.make([1]),
      Stream.empty,
    ]);

    const data = Chunk.toReadonlyArray(yield* Stream.runCollect(mergedStream));

    expect(data).to.deep.equal([
      [1, 2, 3, 1, 1],
      [4, 5, 6, 2],
      [7, 8, 9, 3],
    ]);
  })));
});
