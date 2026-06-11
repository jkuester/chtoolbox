import { Effect, pipe, Redacted } from 'effect';
import * as Context from 'effect/Context';
import { Command, FileSystem } from '@effect/platform';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { join } from 'node:path';
import { getPullRequest } from '../libs/github.js';
import { GITHUB_TOKEN } from '../libs/config.js';
import { createDir, createTmpDir, writeFile } from '../libs/file.js';
import {
  type CommitTarget,
  commitReportFileName,
  decodeOcrResult,
  formatCommitReport,
  formatReport,
  type PrTarget,
  reportFileName,
} from '../libs/review.js';
import { mapErrorToGeneric } from '../libs/core.js';

export interface ReviewOptions {
  readonly concurrency: number;
  readonly timeout: number;
  readonly outputDir: string;
}

const remoteUrl = (token: string, owner: string, repo: string): string =>
  `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;

const runGit = (tmpDir: string, label: string, args: string[]) => Command
  .make('git', ...args)
  .pipe(
    Command.workingDirectory(tmpDir),
    Command.exitCode,
    Effect.filterOrFail(
      exitCode => exitCode === 0,
      exitCode => new Error(`git ${label} failed (exit code ${exitCode.toString()})`)
    ),
  );

// Initialize a throwaway repo in `tmpDir`, point it at the given GitHub repo, and fetch the requested refspecs.
const initAndFetch = (owner: string, repo: string, tmpDir: string, fetchArgs: string[]) => pipe(
  GITHUB_TOKEN,
  Effect.map(Redacted.value),
  Effect.flatMap(token => pipe(
    runGit(tmpDir, 'init', ['init', '-q']),
    Effect.andThen(runGit(tmpDir, 'remote add', ['remote', 'add', 'origin', remoteUrl(token, owner, repo)])),
    Effect.andThen(runGit(tmpDir, 'fetch', ['fetch', '--no-tags', 'origin', ...fetchArgs])),
  )),
);

// Fetch the PR base branch (as `ocr-base`) and the PR head (as `ocr-head`). The base repo's `pull/<n>/head` ref
// resolves fork PRs too, so a single remote is enough.
const checkoutPr = (target: PrTarget, baseRef: string, tmpDir: string) => initAndFetch(
  target.owner,
  target.repo,
  tmpDir,
  [`${baseRef}:ocr-base`, `pull/${target.pullNumber.toString()}/head:ocr-head`],
);

// Fetch the commit (and its ancestry, so `ocr` can diff it against its parent) into the throwaway repo.
const checkoutCommit = (target: CommitTarget, tmpDir: string) => initAndFetch(
  target.owner,
  target.repo,
  tmpDir,
  [target.sha],
);

// Builds an `ocr review` command with the shared output flags. `rangeArgs` selects what to review (a from/to range
// against a temp checkout, or a single commit against the current repo).
const runOcr = (rangeArgs: string[], { concurrency, timeout }: ReviewOptions) => Command
  .make(
    'ocr',
    'review',
    ...rangeArgs,
    '--format',
    'json',
    '--audience',
    'agent',
    '--concurrency',
    concurrency.toString(),
    '--timeout',
    timeout.toString(),
  )
  .pipe(
    Command.stderr('inherit'),
    Command.string,
  );

const writeReport = (outputDir: string, fileName: string, report: string) => pipe(
  createDir(outputDir),
  Effect.andThen(join(outputDir, fileName)),
  Effect.tap(path => writeFile(path)(report)),
);

const runPrReview = (target: PrTarget, options: ReviewOptions) => pipe(
  getPullRequest(target.owner, target.repo)(target.pullNumber),
  Effect.flatMap(prData => pipe(
    createTmpDir(),
    Effect.tap(tmpDir => checkoutPr(target, prData.base.ref, tmpDir)),
    Effect.flatMap(tmpDir => runOcr(['--repo', tmpDir, '--from', 'ocr-base', '--to', 'ocr-head'], options)),
    Effect.flatMap(decodeOcrResult),
    Effect.map(result => formatReport(target, prData, result)),
    Effect.flatMap(report => writeReport(options.outputDir, reportFileName(target), report)),
  )),
  Effect.scoped,
);

// Reviews a single commit by cloning its repo into a temp dir and running ocr's `--commit` mode against it.
const runCommitReview = (target: CommitTarget, options: ReviewOptions) => pipe(
  createTmpDir(),
  Effect.tap(tmpDir => checkoutCommit(target, tmpDir)),
  Effect.flatMap(tmpDir => runOcr(['--repo', tmpDir, '--commit', target.sha], options)),
  Effect.flatMap(decodeOcrResult),
  Effect.map(result => formatCommitReport(target, result)),
  Effect.flatMap(report => writeReport(options.outputDir, commitReportFileName(target), report)),
  Effect.scoped,
);

const serviceContext = Effect
  .all([
    FileSystem.FileSystem,
    CommandExecutor,
  ])
  .pipe(Effect.map(([
    fileSystem,
    executor,
  ]) => Context
    .make(FileSystem.FileSystem, fileSystem)
    .pipe(Context.add(CommandExecutor, executor))));

export class ReviewService extends Effect.Service<ReviewService>()('chtoolbox/ReviewService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    // Reviews a single PR (checking out its branch range into a temp dir). Returns the written report path.
    reviewPr: Effect.fn((
      target: PrTarget,
      options: ReviewOptions
    ): Effect.Effect<string, Error> => pipe(
      runPrReview(target, options),
      Effect.provide(context),
      mapErrorToGeneric,
    )),
    // Reviews a single commit (cloning its repo into a temp dir). Returns the written report path.
    reviewCommit: Effect.fn((
      target: CommitTarget,
      options: ReviewOptions
    ): Effect.Effect<string, Error> => pipe(
      runCommitReview(target, options),
      Effect.provide(context),
      mapErrorToGeneric,
    )),
  }))),
  accessors: true,
}) {
}
