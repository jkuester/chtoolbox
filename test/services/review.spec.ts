import { describe, it } from 'mocha';
import { Effect, Either, Layer } from 'effect';
import sinon, { type SinonStub } from 'sinon';
import { expect } from 'chai';
import * as ReviewSvc from '../../src/services/review.ts';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { FileSystem } from '@effect/platform';
import { genWithConfig, sandbox } from '../utils/base.ts';
import esmock from 'esmock';

const GITHUB_TOKEN = 'ghp_test_token';
const OUTPUT_DIR = '/out';
const TMP_DIR = '/tmp/review-xyz';

const prData = {
  title: 'Fix the thing',
  html_url: 'https://github.com/medic/cht-core/pull/11050',
  base: { ref: 'master' },
  head: { ref: 'fix/the-thing' },
};

const mockCommand = {
  make: sandbox.stub(),
  workingDirectory: sandbox.stub(),
  exitCode: sandbox.stub(),
  stderr: sandbox.stub(),
  string: sandbox.stub(),
};
const getPullRequest = sandbox.stub();
const createTmpDir = sandbox.stub();
const createDir = sandbox.stub();
const writeFile = sandbox.stub();

const { ReviewService } = await esmock<typeof ReviewSvc>('../../src/services/review.ts', {
  '@effect/platform': { Command: mockCommand },
  '../../src/libs/github.ts': { getPullRequest },
  '../../src/libs/file.ts': { createTmpDir, createDir, writeFile },
});

const run = genWithConfig(ReviewService.Default.pipe(
  Layer.provide(Layer.succeed(CommandExecutor, {} as unknown as CommandExecutor)),
  Layer.provide(Layer.succeed(FileSystem.FileSystem, {} as unknown as FileSystem.FileSystem)),
))([['GITHUB_TOKEN', GITHUB_TOKEN]]);

const TARGET = { owner: 'medic', repo: 'cht-core', pullNumber: 11050 };
const OPTIONS = { concurrency: 1, timeout: 60, outputDir: OUTPUT_DIR };

describe('Review Service', () => {
  let getPr: SinonStub;
  let writeContent: SinonStub;

  beforeEach(() => {
    getPr = sinon.stub().returns(Effect.succeed(prData));
    getPullRequest.returns(getPr);
    createTmpDir.returns(Effect.succeed(TMP_DIR));
    createDir.returns(Effect.void);
    writeContent = sinon.stub().returns(Effect.void);
    writeFile.returns(writeContent);

    mockCommand.make.returns(Effect.void);
    mockCommand.workingDirectory.returns(sinon.stub().returns(Effect.void));
    mockCommand.stderr.returns(sinon.stub().returns(Effect.void));
    mockCommand.exitCode.returns(Effect.succeed(0));
    mockCommand.string.returns(Effect.succeed(JSON.stringify({ message: 'No comments generated.' })));
  });

  it('reviews a PR: checks out the branch, runs ocr, and writes a report', run(function* () {
    const path = yield* ReviewService.review(TARGET, OPTIONS);

    expect(path).to.equal('/out/medic-cht-core-pr11050.md');

    expect(getPullRequest).to.have.been.calledOnceWithExactly('medic', 'cht-core');
    expect(getPr).to.have.been.calledOnceWithExactly(11050);

    // git checkout: init, remote add (with tokenized URL), fetch base + PR head ref
    expect(mockCommand.make).to.have.been.calledWith('git', 'init', '-q');
    const remoteUrl = `https://x-access-token:${GITHUB_TOKEN}@github.com/medic/cht-core.git`;
    expect(mockCommand.make).to.have.been.calledWith('git', 'remote', 'add', 'origin', remoteUrl);
    expect(mockCommand.make)
      .to.have.been.calledWith('git', 'fetch', '--no-tags', 'origin', 'master:ocr-base', 'pull/11050/head:ocr-head');
    expect(mockCommand.workingDirectory).to.have.always.been.calledWith(TMP_DIR);

    // ocr run against the temp checkout
    const ocrArgs = [
      'ocr', 'review',
      '--repo', TMP_DIR,
      '--from', 'ocr-base',
      '--to', 'ocr-head',
      '--format', 'json',
      '--audience', 'agent',
      '--concurrency', '1',
      '--timeout', '60',
    ];
    expect(mockCommand.make).to.have.been.calledWith(...ocrArgs);

    // one report written, built from the real formatReport/decode pipeline
    expect(writeFile).to.have.been.calledOnceWithExactly('/out/medic-cht-core-pr11050.md');
    const [report] = writeContent.getCall(0).args as [string];
    expect(report).to.contain('# medic/cht-core#11050: Fix the thing');
    expect(report).to.contain('No comments generated.');
  }));

  it('derives the report path and fetch refspec from the given target', run(function* () {
    const target = { owner: 'medic', repo: 'cht-core', pullNumber: 11051 };

    const path = yield* ReviewService.review(target, OPTIONS);

    expect(path).to.equal('/out/medic-cht-core-pr11051.md');
    expect(getPr).to.have.been.calledOnceWithExactly(11051);
    expect(writeFile).to.have.been.calledOnceWithExactly('/out/medic-cht-core-pr11051.md');
    expect(mockCommand.make)
      .to.have.been.calledWith('git', 'fetch', '--no-tags', 'origin', 'master:ocr-base', 'pull/11051/head:ocr-head');
  }));

  it('fails when a git command fails', run(function* () {
    mockCommand.exitCode.returns(Effect.succeed(1));

    const either = yield* ReviewService.review(TARGET, OPTIONS).pipe(Effect.either);

    if (Either.isLeft(either)) {
      expect(either.left).to.be.instanceOf(Error);
      expect(either.left.message).to.contain('git init failed');
      expect(writeFile).to.not.have.been.called;
    } else {
      expect.fail('Expected an error to be returned');
    }
  }));

  it('propagates errors from the GitHub API', run(function* () {
    getPr.returns(Effect.fail(new Error('boom')));

    const either = yield* ReviewService.review(TARGET, OPTIONS).pipe(Effect.either);

    if (Either.isLeft(either)) {
      expect(either.left).to.be.instanceOf(Error);
      expect(either.left.message).to.equal('boom');
      expect(writeFile).to.not.have.been.called;
    } else {
      expect.fail('Expected an error to be returned');
    }
  }));
});
