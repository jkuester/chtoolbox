import { describe, it } from 'mocha';
import { Effect, Either, Layer, Redacted } from 'effect';
import sinon from 'sinon';
import { expect } from 'chai';
import * as TestDataGeneratorSvc from '../../src/services/test-data-generator.ts';
import { EnvironmentService } from '../../src/services/environment.ts';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { Command } from '@effect/platform';
import { genWithLayer, sandbox } from '../utils/base.ts';
import esmock from 'esmock';
import { fileURLToPath } from 'node:url';

const DESIGN_PATH = '/my/design/path';
const COUCH_URL = 'http://localhost:5984';
const ENV = Redacted.make(COUCH_URL).pipe(url => ({ url }));
const TDG_PATH = fileURLToPath(import.meta.resolve('test-data-generator'));

const mockCommand = {
  make: sandbox.stub(),
  env: sandbox.stub(),
  stdout: sandbox.stub(),
  stderr: sandbox.stub(),
  exitCode: sandbox.stub(),
}
const envGet = sandbox.stub();

const { TestDataGeneratorService } = await esmock<typeof TestDataGeneratorSvc>('../../src/services/test-data-generator.ts', {
  '@effect/platform': { Command: mockCommand }
});
const run = TestDataGeneratorService.Default.pipe(
  Layer.provide(Layer.succeed(EnvironmentService, {
    get: envGet,
  } as unknown as EnvironmentService),),
  Layer.provide(Layer.succeed(CommandExecutor, {} as unknown as CommandExecutor)),
  genWithLayer,
);

describe('Test Data Generator Service', () => {
  beforeEach(() => {
    envGet.returns(Effect.succeed(ENV));
    mockCommand.make.returns(Effect.void as unknown as Command.Command);
    mockCommand.env.returns(sinon.stub().returns(Effect.void) as unknown as Command.Command);
    mockCommand.stdout.returns(sinon.stub().returns(Effect.void) as unknown as Command.Command);
    mockCommand.stderr.returns(sinon.stub().returns(Effect.void) as unknown as Command.Command);
  });

  it('executes the test-data-generator command', run(function* () {
    mockCommand.exitCode.returns(Effect.succeed(0));

    const exitCode = yield* TestDataGeneratorService.generate(DESIGN_PATH);

    expect(exitCode).to.equal(0);
    expect(envGet.calledOnceWithExactly()).to.be.true;
    expect(mockCommand.make.calledOnceWithExactly('node', TDG_PATH, DESIGN_PATH)).to.be.true;
    expect(mockCommand.env.calledOnceWithExactly({ COUCH_URL })).to.be.true;
    expect(mockCommand.stdout.calledOnceWithExactly('inherit')).to.be.true;
    expect(mockCommand.stderr.calledOnceWithExactly('inherit')).to.be.true;
    expect(mockCommand.exitCode.calledOnce).to.be.true;
  }));

  it('returns an error when test-data-generator command fails', run(function* () {
    mockCommand.exitCode.returns(Effect.fail(1));

    const either = yield* TestDataGeneratorService
      .generate(DESIGN_PATH)
      .pipe(Effect.either);

    if (Either.isLeft(either)) {
      expect(either.left).to.equal(1);
      expect(envGet.calledOnceWithExactly()).to.be.true;
      expect(mockCommand.make.calledOnceWithExactly('node', TDG_PATH, DESIGN_PATH)).to.be.true;
      expect(mockCommand.env.calledOnceWithExactly({ COUCH_URL })).to.be.true;
      expect(mockCommand.stdout.calledOnceWithExactly('inherit')).to.be.true;
      expect(mockCommand.stderr.calledOnceWithExactly('inherit')).to.be.true;
      expect(mockCommand.exitCode.calledOnce).to.be.true;
    } else {
      expect.fail('Expected error to be returned');
    }
  }));

  it('throws an error when test-data-generator command completes with an error code', run(function* () {
    mockCommand.exitCode.returns(Effect.succeed(1));

    const either = yield* TestDataGeneratorService
      .generate(DESIGN_PATH)
      .pipe(
        Effect.catchAllDefect(Effect.fail),
        Effect.either
      );

    if (Either.isLeft(either)) {
      expect(either.left).to.be.instanceOf(Error);
      expect(envGet.calledOnceWithExactly()).to.be.true;
      expect(mockCommand.make.calledOnceWithExactly('node', TDG_PATH, DESIGN_PATH)).to.be.true;
      expect(mockCommand.env.calledOnceWithExactly({ COUCH_URL })).to.be.true;
      expect(mockCommand.stdout.calledOnceWithExactly('inherit')).to.be.true;
      expect(mockCommand.stderr.calledOnceWithExactly('inherit')).to.be.true;
      expect(mockCommand.exitCode.calledOnce).to.be.true;
    } else {
      expect.fail('Expected error to be thrown');
    }
  }));
});
