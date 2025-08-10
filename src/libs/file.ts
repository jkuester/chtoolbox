import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import { filterStatusOk } from '@effect/platform/HttpClient';
import { Array, Boolean, Effect, pipe, Record } from 'effect';
import { PlatformError } from '@effect/platform/Error';

export const createDir = Effect.fn((
  dirPath: string
) => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.makeDirectory(dirPath, { recursive: true }))
));

export const createTmpDir = Effect.fn(() => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.makeTempDirectoryScoped()),
));

export const getRemoteFile = Effect.fn((url: string) => HttpClient.HttpClient.pipe(
  Effect.map(filterStatusOk),
  Effect.flatMap(client => client.execute(HttpClientRequest.get(url))),
  Effect.flatMap(({ text }) => text),
  Effect.scoped,
));

export const writeFile = (
  path: string
): (p: string) => Effect.Effect<void, PlatformError, FileSystem.FileSystem> => Effect.fn((
  content
) => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.writeFileString(path, content)),
));

export const writeJsonFile = Effect.fn((
  path: string,
  data: object
) => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.writeFileString(path, JSON.stringify(data, null, 2))),
));

export const readJsonFile = Effect.fn((
  fileName: string,
  directory: string
) => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.readFileString(`${directory}/${fileName}`)),
  Effect.map(JSON.parse),
));

export const writeEnvFile = Effect.fn((
  path: string,
  data: Record<string, string>
) => pipe(
  data,
  Record.toEntries,
  Array.map(([key, value]) => `${key}=${value}`),
  Array.join('\n'),
  envData => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.writeFileString(path, envData)))
));

export const isDirectoryEmpty = Effect.fn((
  dirPath: string
) => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs
    .exists(dirPath)
    .pipe(
      Effect.map(Boolean.not),
      Effect.filterOrElse(
        dirNotExists => dirNotExists,
        () => fs
          .readDirectory(dirPath)
          .pipe(Effect.map(entries => entries.length === 0))
      )
    ))
));
