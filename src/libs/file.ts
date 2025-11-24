import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import { filterStatusOk } from '@effect/platform/HttpClient';
import { Array, Boolean, Effect, Option, pipe, Record } from 'effect';
import { PlatformError } from '@effect/platform/Error';

export const createDir = Effect.fn((dirPath: string) => FileSystem.FileSystem.pipe(
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

const exists = Effect.fn((path: string) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.exists(path))));

const readJsonFileOrFail = Effect.fn((
  fileName: string,
  directory: string
) => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.readFileString(`${directory}/${fileName}`)),
  Effect.map(JSON.parse),
));

export const readJsonFile = Effect.fn((
  fileName: string,
  directory: string,
  defaultValue?: Record<string, unknown>
): Effect.Effect<unknown, PlatformError, FileSystem.FileSystem> => pipe(
  readJsonFileOrFail(fileName, directory),
  Effect.whenEffect(exists(`${directory}/${fileName}`)),
  Effect.map(Option.getOrElse(() => pipe(
    Option.fromNullable(defaultValue),
    Option.getOrThrowWith(() => `Could not read file: ${directory}/${fileName}`)
  ))),
));

export const writeEnvFile = Effect.fn((
  path: string,
  data: Record<string, string>
) => pipe(
  data,
  Record.toEntries,
  Array.map(([key, value]) => `${key}=${value}`),
  Array.join('\n'),
  writeFile(path),
));

const readDirectory = Effect.fn((dirPath: string) => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.readDirectory(dirPath))
));

export const isDirectoryEmpty = Effect.fn((dirPath: string) => pipe(
  exists(dirPath),
  Effect.map(Boolean.not),
  Effect.filterOrElse(
    dirNotExists => dirNotExists,
    () => pipe(
      readDirectory(dirPath),
      Effect.map(Array.isEmptyArray)
    )
  )
));
