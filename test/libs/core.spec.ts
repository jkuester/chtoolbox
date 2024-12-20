import { describe, it } from 'mocha';
import { Chunk, Console, Effect, Stream, TestContext } from 'effect';
import { expect } from 'chai';
import { clearThen, logJson, mergeArrayStreams, pouchDB, untilEmptyCount } from '../../src/libs/core';
import PouchDB from 'pouchdb-core';
import PouchDBAdapterHttp from 'pouchdb-adapter-http';
import sinon from 'sinon';

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

  it('clearThen', run(Effect.gen(function* () {
    const log = sinon.stub().returns(Effect.void);
    const fakeConsole = { clear: Effect.void, log, } as unknown as Console.Console;

    yield* clearThen(Console.log('Hello', 'World')).pipe(
      Console.withConsole(fakeConsole),
    );

    expect(log.calledOnceWithExactly('Hello', 'World')).to.be.true;
    // Need to find a clean way to stub effects like Console.clear.
  })));

  it('logJson', run(Effect.gen(function* () {
    const expectedDict = { Hello: 'World' };
    const expectedJson = '{"Hello": "World"}';
    const stringify = sinon.stub(JSON, 'stringify').returns(expectedJson);
    const log = sinon.stub().returns(Effect.void);
    const fakeConsole = { log, } as unknown as Console.Console;

    yield* logJson(expectedDict).pipe(
      Console.withConsole(fakeConsole),
    );

    expect(stringify.calledOnceWithExactly(expectedDict, null, 2)).to.be.true;
    expect(log.calledOnceWithExactly(expectedJson)).to.be.true;
  })));
});
