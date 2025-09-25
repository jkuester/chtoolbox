import { describe, it } from 'mocha';
import { ConfigProvider, Effect, Either, Layer, Redacted } from 'effect';
import { expect } from 'chai';
import { GITHUB_TOKEN } from '../../src/libs/config.ts';
import { genWithLayer } from '../utils/base.ts';

const run = (config: [string, string][]) => genWithLayer(
  Layer.setConfigProvider(ConfigProvider.fromMap(new Map(config)))
);

describe('Config libs', () => {
  it('returns redacted github token when provided', run(
    [['GITHUB_TOKEN', 'ghp_example_token']]
  )(function* () {
    const token = yield* GITHUB_TOKEN;
    expect(Redacted.value(token)).to.equal('ghp_example_token');
  }));

  it('fails when github token is missing', run([])(function* () {
    const result = yield* Effect.either(GITHUB_TOKEN);
    expect(Either.isLeft(result)).to.be.true;
  }));
});
