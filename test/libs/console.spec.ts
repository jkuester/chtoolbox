import { describe, it } from 'mocha';
import { Console, Effect, TestContext } from 'effect';
import { expect } from 'chai';
import sinon from 'sinon';
import { clearThen, logJson } from '../../src/libs/console.js';

describe('Console libs', () => {
  const run = (test:  Effect.Effect<void, Error>) => async () => {
    await Effect.runPromise(test.pipe(Effect.provide(TestContext.TestContext)));
  };

  // [
  //   ['red', '\x1b[31m'],
  //   ['green', '\x1b[32m'],
  //   ['blue', '\x1b[34m']
  // ].forEach(([ansiColor, expectedCode]) => {
  //   it(`color(${ansiColor})`, () => {
  //     expect(color(ansiColor as 'red' | 'green' | 'blue')('hello')).to.equal(`${expectedCode}hello\x1b[0m`);
  //   });
  // });

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
