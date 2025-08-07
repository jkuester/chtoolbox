import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import * as LocalDiskUsageSvc from '../../src/services/local-disk-usage.ts';
import { NodeContext } from '@effect/platform-node';
import { genWithLayer, sandbox } from '../utils/base.ts';
import esmock from 'esmock';

const FAKE_COMMAND = Effect.succeed({ hello: 'world' });
const mockCommand = {
  make: sandbox.stub(),
  string: sandbox.stub(),
}

const { LocalDiskUsageService } = await esmock<typeof LocalDiskUsageSvc>('../../src/services/local-disk-usage.ts', {
  '@effect/platform': { Command: mockCommand }
});
const run = LocalDiskUsageService.Default.pipe(
  Layer.provide(NodeContext.layer),
  genWithLayer,
);

describe('Local Disk Usage Service', () => {
  it('loads url from COUCH_URL envar', run(function* () {
    const directory = '/home';
    const size = 12345;
    mockCommand.make.returns(FAKE_COMMAND);
    mockCommand.string.returns(Effect.succeed(`${size.toString()}  ${directory}`));

    const actualSize = yield* LocalDiskUsageService.getSize(directory);

    expect(actualSize).to.equal(size);
    expect(mockCommand.make.calledOnceWithExactly('du', '-s', directory)).to.be.true;
    expect(mockCommand.string.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
  }));
});
