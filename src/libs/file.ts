import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import { filterStatusOk } from '@effect/platform/HttpClient';
import { Array, Boolean, Effect, pipe, Record } from 'effect';
import { Scope } from 'effect/Scope';
import { PlatformError } from '@effect/platform/Error';

export const createDir = (
  dirPath: string
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.makeDirectory(dirPath, { recursive: true }))
);

export const createTmpDir = (): Effect.Effect<
  string, PlatformError, Scope | FileSystem.FileSystem
> => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.makeTempDirectoryScoped()),
);

export const getRemoteFile = (
  url: string
): Effect.Effect<string, Error, HttpClient.HttpClient> => HttpClient.HttpClient.pipe(
  Effect.map(filterStatusOk),
  Effect.flatMap(client => client.execute(HttpClientRequest.get(url))),
  Effect.flatMap(({ text }) => text),
  Effect.scoped,
);

export const writeFile = (path: string) => (
  content: string
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.writeFileString(path, content)),
);

export const writeJsonFile = (
  path: string,
  data: object
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.writeFileString(path, JSON.stringify(data, null, 2))),
);

export const readJsonFile = (
  fileName: string,
  directory: string
): Effect.Effect<unknown, PlatformError, FileSystem.FileSystem> => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.readFileString(`${directory}/${fileName}`)),
  Effect.map(JSON.parse),
);

export const writeEnvFile = (
  path: string,
  data: Record<string, string>
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> => pipe(
  data,
  Record.toEntries,
  Array.map(([key, value]) => `${key}=${value}`),
  Array.join('\n'),
  envData =>  FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.writeFileString(path, envData)))
);

export const isDirectoryEmpty = (
  dirPath: string
): Effect.Effect<boolean, PlatformError, FileSystem.FileSystem> => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.exists(dirPath).pipe(
    Effect.map(Boolean.not),
    Effect.filterOrElse(
      dirNotExists => dirNotExists,
      () => fs.readDirectory(dirPath).pipe(Effect.map(entries => entries.length === 0))
    )
  ))
);
