import { Args, Command } from '@effect/cli';
import { Array, Effect, pipe, Match, Console } from 'effect';
import { FormService } from '../../services/form.ts';

const printWarnings = (filePath: string ) => (warns: string[]) => pipe(
  Match.value(warns),
  Match.when(Array.isEmptyArray, () => Effect.void),
  Match.orElse(warns => Console.log(`Warnings for file ${filePath}:\n    - ${warns.join('\n    - ')}`)),
);

const formatFile = (filePath: string) => pipe(
  FormService.formatFile(filePath),
  Effect.flatMap(printWarnings(filePath))
);

const files = Args
  .text({ name: 'file' })
  .pipe(
    Args.withDescription('Path to .xlsx file(s) to format'),
    Args.atLeast(1),
  );

export const format = Command
  .make('format', { files }, Effect.fn(({ files }) => pipe(
    files,
    Array.map(formatFile),
    Effect.all,
    Effect.asVoid,
  )))
  .pipe(Command.withDescription('Apply conditional formatting to .xlsx form file(s).'));
