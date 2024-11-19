import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import { LocalDiskUsageService } from '../../src/services/local-disk-usage';
import { NodeContext } from '@effect/platform-node';
import sinon from 'sinon';
import { Command } from '@effect/platform';
import { genWithLayer } from '../utils/base';

const FAKE_COMMAND = Effect.succeed({ hello: 'world' });

const run = LocalDiskUsageService.Default.pipe(
  Layer.provide(NodeContext.layer),
  genWithLayer,
);

describe('Local Disk Usage Service', () => {
  let commandMake: sinon.SinonStub;
  let commandString: sinon.SinonStub;

  beforeEach(() => {
    commandMake = sinon.stub(Command, 'make');
    commandString = sinon.stub(Command, 'string');
  });

  it('loads url from COUCH_URL envar', run(function* () {
    const directory = '/home';
    const size = 12345;
    commandMake.returns(FAKE_COMMAND);
    commandString.returns(Effect.succeed(`${size.toString()}  ${directory}`));

    const actualSize = yield* LocalDiskUsageService.getSize(directory);

    expect(actualSize).to.equal(size);
    expect(commandMake.calledOnceWithExactly('du', '-s', directory)).to.be.true;
    expect(commandString.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
  }));
});
