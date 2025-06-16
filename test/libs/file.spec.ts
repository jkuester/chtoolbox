import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import sinon from 'sinon';
import { genWithLayer, sandbox } from '../utils/base.js';
import * as FileLibs from '../../src/libs/file.js';
import esmock from 'esmock';

const mockHttpClient = { filterStatusOk: sandbox.stub() };
const mockHttpRequest = { get: sandbox.stub() };
const httpClientExecute = sandbox.stub();
const fsExists = sandbox.stub();
const fsMakeDirectory = sandbox.stub();
const fsMakeTempDirectoryScoped = sandbox.stub();
const fsWriteFileString = sandbox.stub();
const fsReadDirectory = sandbox.stub();
const fsReadFileString = sandbox.stub();

const run = Layer
  .succeed(HttpClient.HttpClient, {
    execute: httpClientExecute,
  } as unknown as HttpClient.HttpClient)
  .pipe(
    Layer.merge(Layer.succeed(FileSystem.FileSystem, {
      exists: fsExists,
      makeDirectory: fsMakeDirectory,
      makeTempDirectoryScoped: fsMakeTempDirectoryScoped,
      writeFileString: fsWriteFileString,
      readDirectory: fsReadDirectory,
      readFileString: fsReadFileString,
    } as unknown as FileSystem.FileSystem)),
    genWithLayer
  );
const {
  createDir,
  createTmpDir,
  getRemoteFile,
  isDirectoryEmpty,
  readJsonFile,
  writeFile,
  writeJsonFile,
  writeEnvFile
} = await esmock<typeof FileLibs>('../../src/libs/file.js', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest },
  '@effect/platform/HttpClient': mockHttpClient
});

describe('file libs', () => {
  it('createDir', run(function* () {
    const dir = 'myDir';
    fsMakeDirectory.returns(Effect.void);

    yield* createDir(dir);

    expect(fsMakeDirectory.calledOnceWithExactly(dir, { recursive: true })).to.be.true;
    expect(fsMakeTempDirectoryScoped.notCalled).to.be.true;
    expect(fsWriteFileString.notCalled).to.be.true;
    expect(fsReadFileString.notCalled).to.be.true;
    expect(httpClientExecute.notCalled).to.be.true;
  }));

  it('createTmpDir', run(function* () {
    const tempDir = 'tmpDir';
    fsMakeTempDirectoryScoped.returns(Effect.succeed(tempDir));

    const result = yield* createTmpDir();

    expect(result).to.deep.equal(tempDir);
    expect(fsMakeDirectory.notCalled).to.be.true;
    expect(fsMakeTempDirectoryScoped.calledOnceWithExactly()).to.be.true;
    expect(fsWriteFileString.notCalled).to.be.true;
    expect(fsReadFileString.notCalled).to.be.true;
    expect(httpClientExecute.notCalled).to.be.true;
  }));

  it('getRemoteFile', run(function* () {
    mockHttpClient.filterStatusOk.returnsArg(0);
    const url = 'myURL';
    const expectedRequest = { url };
    mockHttpRequest.get.returns(expectedRequest as HttpClientRequest.HttpClientRequest);
    const remoteFileText = 'myText';
    httpClientExecute.returns(Effect.succeed({ text: Effect.succeed(remoteFileText) }));

    const result = yield* getRemoteFile(url);

    expect(result).to.deep.equal(remoteFileText);
    expect(mockHttpClient.filterStatusOk.calledOnce).to.be.true;
    expect(mockHttpRequest.get.calledOnceWithExactly(url)).to.be.true;
    expect(fsMakeDirectory.notCalled).to.be.true;
    expect(fsMakeTempDirectoryScoped.notCalled).to.be.true;
    expect(fsWriteFileString.notCalled).to.be.true;
    expect(fsReadFileString.notCalled).to.be.true;
    expect(httpClientExecute.calledOnceWithExactly(expectedRequest)).to.be.true;
  }));

  it('writeFile', run(function* () {
    const path = 'filepath';
    const content = 'myContent';
    fsWriteFileString.returns(Effect.void);

    yield* writeFile(path)(content);

    expect(fsMakeDirectory.notCalled).to.be.true;
    expect(fsMakeTempDirectoryScoped.notCalled).to.be.true;
    expect(fsWriteFileString.calledOnceWithExactly(path, content)).to.be.true;
    expect(fsReadFileString.notCalled).to.be.true;
    expect(httpClientExecute.notCalled).to.be.true;
  }));

  it('writeJsonFile', run(function* () {
    const path = 'filepath';
    const content = { hello: 'world' };
    const jsonContent = '{ "hello": "world" }';
    const jsonStringify = sinon
      .stub(JSON, 'stringify')
      .returns(jsonContent);
    fsWriteFileString.returns(Effect.void);

    yield* writeJsonFile(path, content);

    expect(jsonStringify.calledOnceWithExactly(content, null, 2)).to.be.true;
    expect(fsMakeDirectory.notCalled).to.be.true;
    expect(fsMakeTempDirectoryScoped.notCalled).to.be.true;
    expect(fsWriteFileString.calledOnceWithExactly(path, jsonContent)).to.be.true;
    expect(fsReadFileString.notCalled).to.be.true;
    expect(httpClientExecute.notCalled).to.be.true;
  }));

  it('readJsonFile', run(function* () {
    const path = 'filepath';
    const fileName = 'filename.json';
    const content = { hello: 'world' };
    const jsonContent = '{ "hello": "world" }';
    const jsonParse = sinon
      .stub(JSON, 'parse')
      .returns(content);
    fsReadFileString.returns(Effect.succeed(jsonContent));

    yield* readJsonFile(fileName, path);

    expect(jsonParse.calledOnceWithExactly(jsonContent)).to.be.true;
    expect(fsMakeDirectory.notCalled).to.be.true;
    expect(fsMakeTempDirectoryScoped.notCalled).to.be.true;
    expect(fsWriteFileString.notCalled).to.be.true;
    expect(fsReadFileString.calledOnceWithExactly(`${path}/${fileName}`)).to.be.true;
    expect(httpClientExecute.notCalled).to.be.true;
  }));

  it('writeEnvFile', run(function* () {
    const path = 'filepath';
    const content = { hello: 'world', foo: 'bar' };
    const envContent = 'hello=world\nfoo=bar';
    fsWriteFileString.returns(Effect.void);

    yield* writeEnvFile(path, content);

    expect(fsMakeDirectory.notCalled).to.be.true;
    expect(fsMakeTempDirectoryScoped.notCalled).to.be.true;
    expect(fsWriteFileString.calledOnceWithExactly(path, envContent)).to.be.true;
    expect(fsReadFileString.notCalled).to.be.true;
    expect(httpClientExecute.notCalled).to.be.true;
  }));

  describe('isDirectoryEmpty', () => {
    afterEach(() => {
      expect(fsMakeDirectory.notCalled).to.be.true;
      expect(fsMakeTempDirectoryScoped.notCalled).to.be.true;
      expect(fsWriteFileString.notCalled).to.be.true;
      expect(fsReadFileString.notCalled).to.be.true;
      expect(httpClientExecute.notCalled).to.be.true;
    });

    it('returns true when directory is empty', run(function* () {
      const path = 'filepath';
      fsExists.returns(Effect.succeed(true));
      fsReadDirectory.returns(Effect.succeed([]));

      const result = yield* isDirectoryEmpty(path);

      expect(result).to.be.true;
      expect(fsExists.calledOnceWithExactly(path)).to.be.true;
      expect(fsReadDirectory.calledOnceWithExactly(path)).to.be.true;
    }));

    it('returns false when directory has contents', run(function* () {
      const path = 'filepath';
      fsExists.returns(Effect.succeed(true));
      fsReadDirectory.returns(Effect.succeed(['hello']));

      const result = yield* isDirectoryEmpty(path);

      expect(result).to.be.false;
      expect(fsExists.calledOnceWithExactly(path)).to.be.true;
      expect(fsReadDirectory.calledOnceWithExactly(path)).to.be.true;
    }));

    it('returns true when directory does not exist', run(function* () {
      const path = 'filepath';
      fsExists.returns(Effect.succeed(false));

      const result = yield* isDirectoryEmpty(path);

      expect(result).to.be.true;
      expect(fsExists.calledOnceWithExactly(path)).to.be.true;
      expect(fsReadDirectory.notCalled).to.be.true;
    }));
  });
});
