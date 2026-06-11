import { Command, Options } from '@effect/cli';
import { Console, Effect, pipe, Array } from 'effect';
import { type ReviewOptions, ReviewService } from '../services/review.ts';
import { type CommitTarget, parseCommitTarget, parsePrTarget, type PrTarget } from '../libs/review.ts';

const pr = Options
  .text('pr')
  .pipe(
    Options.repeated,
    Options.withDescription(
      'A GitHub PR to review, given as "org/repo#number" (e.g. medic/cht-core#11050) or a PR URL. Repeat the option '
      + 'to queue multiple PRs, which are reviewed in sequence.'
    ),
  );

const commit = Options
  .text('commit')
  .pipe(
    Options.repeated,
    Options.withDescription(
      'A GitHub commit to review against its parent, given as "org/repo#sha" (e.g. medic/cht-core#abc1234) or a '
      + 'commit URL. Repeat the option to queue multiple commits, which are reviewed in sequence.'
    ),
  );

const concurrency = Options
  .integer('concurrency')
  .pipe(
    Options.withDescription('Max concurrent file reviews passed through to `ocr`. Default is 1.'),
    Options.withDefault(1),
  );

const timeout = Options
  .integer('timeout')
  .pipe(
    Options.withDescription('Per-task timeout in minutes passed through to `ocr`. Default is 60.'),
    Options.withDefault(60),
  );

const outputDir = Options
  .directory('output-dir', { exists: 'either' })
  .pipe(
    Options.withAlias('o'),
    Options.withDescription('Directory to write the markdown review reports into. Defaults to the current directory.'),
    Options.withDefault('.'),
  );

const reviewPr = (opts: ReviewOptions) => (target: PrTarget) => ReviewService.reviewPr(target, opts);
const reviewCommit =  (opts: ReviewOptions) => (target: CommitTarget) => ReviewService.reviewCommit(target, opts);

export const review = Command
  .make(
    'review',
    { pr, commit, concurrency, timeout, outputDir },
    Effect.fn(({ pr, commit, concurrency, timeout, outputDir }) => pipe(
      Effect.all({
        prTargets: Effect.forEach(pr, parsePrTarget),
        commitTargets: Effect.forEach(commit, parseCommitTarget),
      }),
      Effect.filterOrFail(
        ({ prTargets, commitTargets }) => prTargets.length > 0 || commitTargets.length > 0,
        () => new Error('At least one --pr or --commit must be provided.'),
      ),
      Effect.flatMap(({ prTargets, commitTargets }) => pipe(
        [
          ...Array.map(prTargets, reviewPr({ concurrency, timeout, outputDir })),
          ...Array.map(commitTargets, reviewCommit({ concurrency, timeout, outputDir }))
        ],
        Effect.all,
      )),
      Effect.tap(paths => Console.log(`\nWrote ${paths.length.toString()} report(s):\n${paths.join('\n')}`)),
    ))
  )
  .pipe(Command.withDescription(
    'Review GitHub PRs and/or commits with open-code-review (`ocr`), writing one markdown report each. requires '
    + 'GITHUB_TOKEN and the `ocr` binary on the PATH (with its own LLM configuration.  See '
    + 'https://alibaba.github.io/open-code-review/ for more details on setting up ocr.'
  ));
