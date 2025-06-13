import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import { filterStatusOk } from '@effect/platform/HttpClient';
import { Array, Effect, pipe, Record } from 'effect';
export const createTmpDir = () => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.makeTempDirectoryScoped()));
export const getRemoteFile = (url) => HttpClient.HttpClient.pipe(Effect.map(filterStatusOk), Effect.flatMap(client => client.execute(HttpClientRequest.get(url))), Effect.flatMap(({ text }) => text), Effect.scoped);
export const writeFile = (path) => (content) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.writeFileString(path, content)));
export const writeJsonFile = (path, data) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.writeFileString(path, JSON.stringify(data, null, 2))));
export const readJsonFile = (fileName, directory) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.readFileString(`${directory}/${fileName}`)), Effect.map(JSON.parse));
export const writeEnvFile = (path, data) => pipe(data, Record.toEntries, Array.map(([key, value]) => `${key}=${value}`), Array.join('\n'), envData => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.writeFileString(path, envData))));
//# sourceMappingURL=file.js.map