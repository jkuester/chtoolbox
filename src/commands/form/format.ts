import { Args, Command } from '@effect/cli';
import { Array, Effect, pipe } from 'effect';
import { FormService } from '../../services/form.ts';

const formatFile = (filePath: string) => pipe(
  FormService.formatFile(filePath)
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
