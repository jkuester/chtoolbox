import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon, { type SinonStub } from 'sinon';
import { ConfigProvider, Layer, pipe, Array } from 'effect';
import { genWithLayer, sandbox } from '../utils/base.ts';
import * as GitHubLibs from '../../src/libs/github.ts';
import esmock from 'esmock';

const GITHUB_TOKEN = 'ghp_test_token';
const owner = 'owner';
const repo = 'repo';
const base = 'base';
const head = 'head';

const octokit = sandbox.stub();
const { compareRefs } = await esmock<typeof GitHubLibs>('../../src/libs/github.ts', {
  '../../src/libs/shim.ts': { octokit },
});

const run = pipe(
  new Map([['GITHUB_TOKEN', GITHUB_TOKEN]]),
  ConfigProvider.fromMap,
  Layer.setConfigProvider,
  genWithLayer
);

describe('GitHub libs', () => {
  let paginate: SinonStub;
  let compareCommitsWithBasehead: SinonStub;

  beforeEach(() => {
    paginate = sinon.stub();
    compareCommitsWithBasehead = sinon.stub();
    octokit.returns({
      paginate,
      rest: { repos: { compareCommitsWithBasehead } }
    });
  });

  it('returns empty comparison data when there are no changes', run(function* () {
    paginate.resolves([{ commits: [] }]);

    const result = yield* compareRefs(owner, repo)(base, head);

    expect(result).to.deep.equal({ commits: [], files: [] });
    expect(octokit).calledOnceWithExactly({ auth: GITHUB_TOKEN });
    expect(paginate).calledOnceWith(compareCommitsWithBasehead, {
      owner,
      repo,
      basehead: `${base}...${head}`,
      per_page: 100,
    });
  }));

  it('returns single page of comparison data', run(function* () {
    const compareData = {
      commits: [{ sha: '1' }, { sha: '2' }, { sha: '3' }],
      files: [{ filename: 'a' }, { filename: 'b' }, { filename: 'c' }]
    };
    paginate.resolves([compareData]);

    const result = yield* compareRefs(owner, repo)(base, head);

    expect(result).to.deep.equal(compareData);
    expect(octokit).calledOnceWithExactly({ auth: GITHUB_TOKEN });
    expect(paginate).calledOnceWith(compareCommitsWithBasehead, {
      owner,
      repo,
      basehead: `${base}...${head}`,
      per_page: 100,
    });
  }));

  it('returns multiple pages of comparison data aggregated together', run(function* () {
    const compareData0 = {
      commits: [{ sha: '1' }, { sha: '2' }, { sha: '3' }],
      files: Array.makeBy(200, i => ({ filename: `a${i.toString()}` }))
    };
    const compareData1 = {
      commits: [{ sha: '3' }, { sha: '4' }, { sha: '5' }],
      files: Array.makeBy(99, i => ({ filename: `b${i.toString()}` }))
    };
    paginate.resolves([compareData0, compareData1]);

    const result = yield* compareRefs(owner, repo)(base, head);

    expect(result).to.deep.equal({
      commits: [...compareData0.commits, ...compareData1.commits.slice(1)],
      files: [...compareData0.files, ...compareData1.files]
    });
    expect(octokit).calledOnceWithExactly({ auth: GITHUB_TOKEN });
    expect(paginate).calledOnceWith(compareCommitsWithBasehead, {
      owner,
      repo,
      basehead: `${base}...${head}`,
      per_page: 100,
    });
  }));

  it('fetches comparison data in subsets when there are >= 300 files changed', run(function* () {
    const compareData0 = {
      commits: [{ sha: '1' }, { sha: '2' }, { sha: '3' }],
      files: Array.makeBy(300, i => ({ filename: `a${i.toString()}` }))
    };
    const compareData1 = {
      commits: [{ sha: '4' }, { sha: '5' }, { sha: '6' }],
      files: [{ filename: 'a' }, { filename: 'b' }, { filename: 'c' }]
    };
    paginate.onFirstCall().resolves([compareData0]);
    paginate.onSecondCall().resolves([{ commits: [] }]);
    paginate.onThirdCall().resolves([compareData1]);

    const result = yield* compareRefs(owner, repo)(base, head);

    expect(result).to.deep.equal({
      commits: [...compareData0.commits, ...compareData1.commits],
      files: [...compareData0.files, ...compareData1.files]
    });
    expect(octokit.args).to.deep.equal(Array.replicate([{ auth: GITHUB_TOKEN }], 3));
    expect(paginate).to.have.been.calledThrice;
    expect(paginate).to.have.been.calledWith(
      compareCommitsWithBasehead,
      { owner, repo, basehead: `${base}...${head}`, per_page: 100 }
    );
    expect(paginate).to.have.been.calledWith(
      compareCommitsWithBasehead,
      { owner, repo, basehead: `1...2`, per_page: 100 }
    );
    expect(paginate).to.have.been.calledWith(
      compareCommitsWithBasehead,
      { owner, repo, basehead: `3...3`, per_page: 100 }
    );
  }));
});
