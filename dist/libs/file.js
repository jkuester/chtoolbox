import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import { Effect } from 'effect';
export const createTmpDir = () => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.makeTempDirectoryScoped()));
export const getRemoteFile = (url) => HttpClient.HttpClient.pipe(Effect.map(HttpClient.filterStatusOk), Effect.flatMap(client => client.execute(HttpClientRequest.get(url))), Effect.flatMap(({ text }) => text), Effect.scoped);
export const writeFile = (path) => (content) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.writeFileString(path, content)));
export const writeJsonFile = (path, data) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.writeFileString(path, JSON.stringify(data, null, 2))));
export const readJsonFile = (fileName, directory) => FileSystem.FileSystem.pipe(Effect.flatMap(fs => fs.readFileString(`${directory}/${fileName}`)), Effect.map(JSON.parse));
//# sourceMappingURL=file.js.map