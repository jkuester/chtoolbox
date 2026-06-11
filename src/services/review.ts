import { Console, Effect, pipe, Redacted } from 'effect';
import * as Context from 'effect/Context';
import { Command, FileSystem } from '@effect/platform';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { join } from 'node:path';
import { getPullRequest } from '../libs/github.js';
import { GITHUB_TOKEN } from '../libs/config.js';
import { createDir, createTmpDir, writeFile } from '../libs/file.js';
import { decodeOcrResult, formatReport, type PrTarget, reportFileName } from '../libs/review.js';
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

// Initialize a throwaway repo in `tmpDir` and fetch both the PR base branch (as `ocr-base`) and the PR head (as
// `ocr-head`). The base repo's `pull/<n>/head` ref resolves fork PRs too, so a single remote is enough.
const checkoutPr = (target: PrTarget, baseRef: string, tmpDir: string) => pipe(
  GITHUB_TOKEN,
  Effect.map(Redacted.value),
  Effect.flatMap(token => pipe(
    runGit(tmpDir, 'init', ['init', '-q']),
    Effect.andThen(runGit(
      tmpDir,
      'remote add',
      ['remote', 'add', 'origin', remoteUrl(token, target.owner, target.repo)]
    )),
    Effect.andThen(runGit(
      tmpDir,
      'fetch',
      ['fetch', '--no-tags', 'origin', `${baseRef}:ocr-base`, `pull/${target.pullNumber.toString()}/head:ocr-head`]
    )),
  )),
);

const runOcr = (tmpDir: string, { concurrency, timeout }: ReviewOptions) => Command
  .make(
    'ocr',
    'review',
    '--repo',
    tmpDir,
    '--from',
    'ocr-base',
    '--to',
    'ocr-head',
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

const writeReport = (outputDir: string, target: PrTarget, report: string) => pipe(
  createDir(outputDir),
  Effect.andThen(join(outputDir, reportFileName(target))),
  Effect.tap(path => writeFile(path)(report)),
);

const reviewPr = (target: PrTarget, options: ReviewOptions) => pipe(
  Console.log(`Reviewing ${target.owner}/${target.repo}#${target.pullNumber.toString()}...`),
  Effect.andThen(getPullRequest(target.owner, target.repo)(target.pullNumber)),
  Effect.flatMap(prData => pipe(
    createTmpDir(),
    Effect.tap(tmpDir => checkoutPr(target, prData.base.ref, tmpDir)),
    Effect.flatMap(tmpDir => runOcr(tmpDir, options)),
    Effect.flatMap(decodeOcrResult),
    Effect.map(result => formatReport(target, prData, result)),
    Effect.flatMap(report => writeReport(options.outputDir, target, report)),
  )),
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
    // Reviews each PR in sequence, writing one markdown report per PR. Returns the written file paths.
    review: Effect.fn((
      targets: PrTarget[],
      options: ReviewOptions
    ): Effect.Effect<string[], Error> => pipe(
      Effect.forEach(targets, target => reviewPr(target, options), { concurrency: 1 }),
      Effect.provide(context),
      mapErrorToGeneric,
    )),
  }))),
  accessors: true,
}) {
}
