import { Command, Options } from '@effect/cli';
import { Console, Effect, pipe } from 'effect';
import { ReviewService } from '../services/review.ts';
import { parsePrTarget } from '../libs/review.ts';

const pr = Options
  .text('pr')
  .pipe(
    Options.repeated,
    Options.withDescription(
      'A GitHub PR to review, given as "org/repo#number" (e.g. medic/cht-core#11050) or a PR URL. Repeat the option '
      + 'to queue multiple PRs, which are reviewed in sequence.'
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

export const review = Command
  .make('review', { pr, concurrency, timeout, outputDir }, Effect.fn(({ pr, concurrency, timeout, outputDir }) => pipe(
    Effect.forEach(pr, parsePrTarget),
    Effect.filterOrFail(
      targets => targets.length > 0,
      () => new Error('At least one --pr must be provided.'),
    ),
    Effect.flatMap(targets => Effect.forEach(
      targets,
      target => ReviewService.review(target, { concurrency, timeout, outputDir }),
      { concurrency: 1 },
    )),
    Effect.tap(paths => Console.log(`\nWrote ${paths.length.toString()} report(s):\n${paths.join('\n')}`)),
  )))
  .pipe(Command.withDescription(
    'Review one or more GitHub PRs with open-code-review (`ocr`). For each PR, checks out the PR branch range into a '
    + 'temp directory, runs `ocr` against it, and writes a markdown report. Requires GITHUB_TOKEN and the `ocr` binary '
    + 'on the PATH (with its own LLM configuration).'
  ));
