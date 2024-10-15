import { afterEach, describe, it } from 'mocha';
import { Effect, TestContext } from 'effect';
import { expect } from 'chai';
import { LocalDiskUsageService } from '../../src/services/local-disk-usage';
import { NodeContext } from '@effect/platform-node';
import sinon from 'sinon';
import { Command } from '@effect/platform';

const FAKE_COMMAND = Effect.succeed({ hello: 'world' });

describe('Local Disk Usage Service', () => {
  let commandMake: sinon.SinonStub;
  let commandString: sinon.SinonStub;

  beforeEach(() => {
    commandMake = sinon.stub(Command, 'make');
    commandString = sinon.stub(Command, 'string');
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, LocalDiskUsageService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(LocalDiskUsageService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(NodeContext.layer)
    ));
  };

  it('loads url from COUCH_URL envar', run(Effect.gen(function* () {
    const directory = '/home';
    const size = 12345;
    commandMake.returns(FAKE_COMMAND);
    commandString.returns(Effect.succeed(`${size.toString()}  ${directory}`));

    const service = yield* LocalDiskUsageService;
    const actualSize = yield* service.getSize(directory);

    expect(actualSize).to.equal(size);
    expect(commandMake.calledOnceWithExactly('du', '-s', directory)).to.be.true;
    expect(commandString.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
  })));
});
