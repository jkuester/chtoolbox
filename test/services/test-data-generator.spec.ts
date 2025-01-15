import { describe, it } from 'mocha';
import { Effect, Either, Layer, Redacted } from 'effect';
import sinon, { SinonStub } from 'sinon';
import { expect } from 'chai';
import { TestDataGeneratorService } from '../../src/services/test-data-generator.js';
import { EnvironmentService } from '../../src/services/environment.js';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { Command } from '@effect/platform';
import { genWithLayer, sandbox } from '../utils/base.js';

const DESIGN_PATH = '/my/design/path';
const COUCH_URL = 'http://localhost:5984';
const ENV = Redacted.make(COUCH_URL).pipe(url => ({ url }));
const TDG_PATH = import.meta.resolve('test-data-generator');

const envGet = sandbox.stub();

const run = TestDataGeneratorService.Default.pipe(
  Layer.provide(Layer.succeed(EnvironmentService, {
    get: envGet,
  } as unknown as EnvironmentService),),
  Layer.provide(Layer.succeed(CommandExecutor, {} as unknown as CommandExecutor)),
  genWithLayer,
);

describe('Test Data Generator Service', () => {
  let commandMake: SinonStub;
  let commandEnv: SinonStub;
  let commandStdout: SinonStub;
  let commandStderr: SinonStub;
  let commandExitCode: SinonStub;

  beforeEach(() => {
    envGet.returns(Effect.succeed(ENV));
    commandMake = sinon.stub(Command, 'make').returns(Effect.void as unknown as Command.Command);
    commandEnv = sinon
      .stub(Command, 'env')
      .returns(sinon.stub().returns(Effect.void) as unknown as Command.Command);
    commandStdout = sinon
      .stub(Command, 'stdout')
      .returns(sinon.stub().returns(Effect.void) as unknown as Command.Command);
    commandStderr = sinon
      .stub(Command, 'stderr')
      .returns(sinon.stub().returns(Effect.void) as unknown as Command.Command);
    commandExitCode = sinon.stub(Command, 'exitCode');
  });

  it('executes the test-data-generator command', run(function* () {
    commandExitCode.returns(Effect.succeed(0));

    const exitCode = yield* TestDataGeneratorService.generate(DESIGN_PATH);

    expect(exitCode).to.equal(0);
    expect(envGet.calledOnceWithExactly()).to.be.true;
    expect(commandMake.calledOnceWithExactly('node', TDG_PATH, DESIGN_PATH)).to.be.true;
    expect(commandEnv.calledOnceWithExactly({ COUCH_URL })).to.be.true;
    expect(commandStdout.calledOnceWithExactly('inherit')).to.be.true;
    expect(commandStderr.calledOnceWithExactly('inherit')).to.be.true;
    expect(commandExitCode.calledOnce).to.be.true;
  }));

  it('returns an error when test-data-generator command fails', run(function* () {
    commandExitCode.returns(Effect.fail(1));

    const either = yield* TestDataGeneratorService
      .generate(DESIGN_PATH)
      .pipe(Effect.either);

    if (Either.isLeft(either)) {
      expect(either.left).to.equal(1);
      expect(envGet.calledOnceWithExactly()).to.be.true;
      expect(commandMake.calledOnceWithExactly('node', TDG_PATH, DESIGN_PATH)).to.be.true;
      expect(commandEnv.calledOnceWithExactly({ COUCH_URL })).to.be.true;
      expect(commandStdout.calledOnceWithExactly('inherit')).to.be.true;
      expect(commandStderr.calledOnceWithExactly('inherit')).to.be.true;
      expect(commandExitCode.calledOnce).to.be.true;
    } else {
      expect.fail('Expected error to be returned');
    }
  }));

  it('throws an error when test-data-generator command completes with an error code', run(function* () {
    commandExitCode.returns(Effect.succeed(1));

    const either = yield* TestDataGeneratorService
      .generate(DESIGN_PATH)
      .pipe(
        Effect.catchAllDefect(Effect.fail),
        Effect.either
      );

    if (Either.isLeft(either)) {
      expect(either.left).to.be.instanceOf(Error);
      expect(envGet.calledOnceWithExactly()).to.be.true;
      expect(commandMake.calledOnceWithExactly('node', TDG_PATH, DESIGN_PATH)).to.be.true;
      expect(commandEnv.calledOnceWithExactly({ COUCH_URL })).to.be.true;
      expect(commandStdout.calledOnceWithExactly('inherit')).to.be.true;
      expect(commandStderr.calledOnceWithExactly('inherit')).to.be.true;
      expect(commandExitCode.calledOnce).to.be.true;
    } else {
      expect.fail('Expected error to be thrown');
    }
  }));
});
