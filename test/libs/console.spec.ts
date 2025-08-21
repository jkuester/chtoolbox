import { describe, it } from 'mocha';
import { Console, Effect, Logger, LogLevel, TestContext } from 'effect';
import { expect } from 'chai';
import sinon from 'sinon';
import { clearConsoleEffect, clearThen, debugLoggingEnabled, logJson, color } from '../../src/libs/console.ts';

describe('Console libs', () => {
  const run = (test:  Effect.Effect<void, Error>) => async () => {
    await Effect.runPromise(test.pipe(Effect.provide(TestContext.TestContext)));
  };

  ([
    ['red', '\x1b[31m'],
    ['green', '\x1b[32m'],
    ['blue', '\x1b[34m']
  ] as [string, string][]).forEach(([ansiColor, expectedCode]) => {
    it(`color(${ansiColor})`, () => {
      expect(color(ansiColor as 'red' | 'green' | 'blue')('hello')).to.equal(`${expectedCode}hello\x1b[0m`);
    });
  });

  describe('debugLoggingEnabled', () => {
    it('returns true when DEBUG logging is enabled', run(Effect.gen(function* () {
      const result = yield* debugLoggingEnabled.pipe(Logger.withMinimumLogLevel(LogLevel.Debug));
      expect(result).to.be.true;
    })));

    it('returns false when DEBUG logging is not enabled', run(Effect.gen(function* () {
      const result = yield* debugLoggingEnabled.pipe(Logger.withMinimumLogLevel(LogLevel.Info));
      expect(result).to.be.false;
    })));
  });

  describe('clearConsoleEffect', () => {
    // Return string when clearing so we can detect it in tests.
    const fakeConsole = { clear: Effect.succeed('cleared') } as unknown as Console.Console;

    it('does nothing when DEBUG logging is enabled', run(Effect.gen(function* () {
      const result = yield* clearConsoleEffect.pipe(
        Console.withConsole(fakeConsole),
        Logger.withMinimumLogLevel(LogLevel.Debug)
      );
      expect(result).to.be.undefined;
    })));

    it('clears console when DEBUG logging is not enabled', run(Effect.gen(function* () {
      const result = yield* clearConsoleEffect.pipe(
        Console.withConsole(fakeConsole),
        Logger.withMinimumLogLevel(LogLevel.Info)
      );
      expect(result).to.equal('cleared');
    })));
  });

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
