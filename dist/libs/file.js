"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readJsonFile = exports.writeJsonFile = exports.writeFile = exports.getRemoteFile = exports.createTmpDir = void 0;
const platform_1 = require("@effect/platform");
const effect_1 = require("effect");
const createTmpDir = () => platform_1.FileSystem.FileSystem.pipe(effect_1.Effect.flatMap(fs => fs.makeTempDirectoryScoped()));
exports.createTmpDir = createTmpDir;
const getRemoteFile = (url) => platform_1.HttpClient.HttpClient.pipe(effect_1.Effect.map(platform_1.HttpClient.filterStatusOk), effect_1.Effect.flatMap(client => client.execute(platform_1.HttpClientRequest.get(url))), effect_1.Effect.flatMap(({ text }) => text), effect_1.Effect.scoped);
exports.getRemoteFile = getRemoteFile;
const writeFile = (path) => (content) => platform_1.FileSystem.FileSystem.pipe(effect_1.Effect.flatMap(fs => fs.writeFileString(path, content)));
exports.writeFile = writeFile;
const writeJsonFile = (path, data) => platform_1.FileSystem.FileSystem.pipe(effect_1.Effect.flatMap(fs => fs.writeFileString(path, JSON.stringify(data, null, 2))));
exports.writeJsonFile = writeJsonFile;
const readJsonFile = (fileName, directory) => platform_1.FileSystem.FileSystem.pipe(effect_1.Effect.flatMap(fs => fs.readFileString(`${directory}/${fileName}`)), effect_1.Effect.map(JSON.parse));
exports.readJsonFile = readJsonFile;
//# sourceMappingURL=file.js.map