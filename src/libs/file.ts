import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import { Effect } from 'effect';
import { Scope } from 'effect/Scope';
import { PlatformError } from '@effect/platform/Error';

export const createTmpDir = (): Effect.Effect<
  string, PlatformError, Scope | FileSystem.FileSystem
> => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.makeTempDirectoryScoped()),
);

export const getRemoteFile = (
  url: string
): Effect.Effect<string, Error, HttpClient.HttpClient> => HttpClient.HttpClient.pipe(
  Effect.map(HttpClient.filterStatusOk),
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
