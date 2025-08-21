import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import { filterStatusOk } from '@effect/platform/HttpClient';
import { Array, Boolean, Effect, pipe, Record } from 'effect';
import { PlatformError } from '@effect/platform/Error';
export const createDir = Effect.fn((dirPath) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.makeDirectory(dirPath, { recursive: true }))));
export const createTmpDir = Effect.fn(() => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.makeTempDirectoryScoped())));
export const getRemoteFile = Effect.fn((url) => HttpClient.HttpClient.pipe(Effect.map(filterStatusOk), Effect.flatMap(client => client.execute(HttpClientRequest.get(url))), Effect.flatMap(({ text }) => text), Effect.scoped));
export const writeFile = (path) => Effect.fn((content) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.writeFileString(path, content))));
export const writeJsonFile = Effect.fn((path, data) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.writeFileString(path, JSON.stringify(data, null, 2)))));
export const readJsonFile = Effect.fn((fileName, directory) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.readFileString(`${directory}/${fileName}`)), Effect.map(JSON.parse)));
export const writeEnvFile = Effect.fn((path, data) => pipe(data, Record.toEntries, Array.map(([key, value]) => `${key}=${value}`), Array.join('\n'), writeFile(path)));
export const isDirectoryEmpty = Effect.fn((dirPath) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => pipe(fs.exists(dirPath), Effect.map(Boolean.not), Effect.filterOrElse(dirNotExists => dirNotExists, () => fs
    .readDirectory(dirPath)
    .pipe(Effect.map(entries => entries.length === 0)))))));
