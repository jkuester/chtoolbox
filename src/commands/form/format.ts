import { FileSystem } from '@effect/platform';
import { Args, Command, Options } from '@effect/cli';
import { Array, Effect, pipe } from 'effect';
import { FormService } from '../../services/form.ts';

const formatFile = (filePath: string) => FormService.formatFile(filePath);

const getDirectoryFiles = (directory: string) => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.readDirectory(directory)),
  Effect.map(Array.filter(fileName => fileName.endsWith('.xlsx'))),
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
    Effect.flatMap(Effect.all),
    Effect.asVoid,
  )))
  .pipe(Command.withDescription('Apply conditional formatting to .xlsx form file(s).'));
