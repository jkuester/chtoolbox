import { FileSystem, Terminal } from '@effect/platform';
import { Args, Command, Options } from '@effect/cli';
import { Array, Effect, pipe } from 'effect';
import { FormService } from '../../services/form.ts';

const formatFile = (filePath: string) => Terminal.Terminal.pipe(
  Effect.tap(terminal => terminal.display(`Formatting ${filePath}... `)),
  Effect.flatMap(terminal => FormService.formatFile(filePath).pipe(
    Effect.tap(() => terminal.display('done\n')),
    Effect.tapError(error => terminal.display(`failed: ${error.message}${
      error.cause instanceof Error ? ` (${error.cause.message})` : ''
    }\n`)),
  )),
);

const getDirectoryFiles = (directory: string) => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.readDirectory(directory)),
  // Excel leaves a `~$<name>.xlsx` lock file next to each open workbook.
  Effect.map(Array.filter(fileName => fileName.endsWith('.xlsx') && !fileName.startsWith('~$'))),
  Effect.map(Array.map(fileName => `${directory}/${fileName}`)),
);

const getFilesToFormat = (files: string[], directories: string[]) => pipe(
  directories,
  Array.map(getDirectoryFiles),
  Effect.all,
  Effect.map(Array.flatten),
  Effect.map(Array.appendAll(files)),
);

const assertArgs = (files: string[], directories: string[]) => pipe(
  Effect.fail(new Error('Must provide either `file` args or the --directory option.')),
  Effect.when(() => Array.isEmptyArray(files) && Array.isEmptyArray(directories)),
);

const files = Args
  .file({
    name: 'file',
    exists: 'yes'
  })
  .pipe(
    Args.withDescription('Path to .xlsx file(s) to format'),
    Args.repeated,
  );

const directories = Options
  .directory('directory', { exists: 'yes' })
  .pipe(
    Options.withAlias('d'),
    Options.withDescription(
      'A local directory containing the forms to format. The directory should directly contain the .xlsx '
      + 'files. May be repeated to format multiple directories, and may be combined with `file` args.'
    ),
    Options.repeated,
  );

export const format = Command
  .make('format', { files, directories }, Effect.fn(({ files, directories }) => pipe(
    assertArgs(files, directories),
    Effect.andThen(getFilesToFormat(files, directories)),
    Effect.map(Array.map(formatFile)),
    Effect.flatMap(effects => Effect.all(effects, { mode: 'validate' }).pipe(
      Effect.mapError(() => new Error('Some files could not be formatted.')),
    )),
    Effect.asVoid,
  )))
  .pipe(Command.withDescription('Apply conditional formatting to .xlsx form file(s).'));
