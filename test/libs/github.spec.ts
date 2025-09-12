import { describe, it } from 'mocha';
import { Effect, Either, TestContext } from 'effect';
import { expect } from 'chai';
import esmock from 'esmock';
import type { CompareCommitsData } from '../../src/libs/github.ts';
import { sandbox } from '../utils/base.js';

const owner = 'medic';
const repo = 'cht-core';
const base = '1.0.0';
const head = '2.0.0';
const compareStub = sandbox.stub();

const { compareRefs } = await esmock<typeof import('../../src/libs/github.ts')>('../../src/libs/github.ts', {
  '@octokit/rest': {
    Octokit: class MockOctokit {
      public rest = { repos: { compareCommitsWithBasehead: compareStub } };
    }
  }
});

const run = (test:  Effect.Effect<void, Error>) => async () => {
  await Effect.runPromise(test.pipe(Effect.provide(TestContext.TestContext)));
};

describe('Github libs', () => {
  it('compareRefs success path returns data from response', run(Effect.gen(function* () {
    const expectedData = { sha: 'abc123', files: [], commits: [] } as unknown as CompareCommitsData;
    compareStub.resolves({ data: expectedData });

    const result = yield* compareRefs(owner, repo)(base, head);

    expect(result).to.equal(expectedData);
    expect(compareStub).to.have.been.calledOnceWithExactly({ owner, repo, basehead: `${base}...${head}` });
  })));

  it('compareRefs failure path maps thrown error to Error', run(Effect.gen(function* () {
    const expectedError = new Error('Boom');
    compareStub.rejects(expectedError);

    const either = yield* compareRefs(owner, repo)(base, head).pipe(Effect.either);

    if (Either.isRight(either)) {
      expect.fail('Expected failure');
    }

    expect(either.left).to.be.instanceOf(Error);
    expect(either.left.message).to.equal(expectedError.message);
    expect(compareStub).to.have.been.calledOnceWithExactly({ owner, repo, basehead: `${base}...${head}` });
  })));
});
