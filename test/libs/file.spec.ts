import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import sinon from 'sinon';
import { genWithLayer, sandbox } from '../utils/base';
import { createTmpDir, getRemoteFile, readJsonFile, writeFile, writeJsonFile } from '../../src/libs/file';

const httpClientExecute = sandbox.stub();
const fsMakeTempDirectoryScoped = sandbox.stub();
const fsWriteFileString = sandbox.stub();
const fsReadFileString = sandbox.stub();

const run = Layer
  .succeed(HttpClient.HttpClient, {
    execute: httpClientExecute,
  } as unknown as HttpClient.HttpClient)
  .pipe(
    Layer.merge(Layer.succeed(FileSystem.FileSystem, {
      makeTempDirectoryScoped: fsMakeTempDirectoryScoped,
      writeFileString: fsWriteFileString,
      readFileString: fsReadFileString,
    } as unknown as FileSystem.FileSystem)),
    genWithLayer
  );

describe('file libs', () => {
  it('createTmpDir', run(function* () {
    const tempDir = 'tmpDir';
    fsMakeTempDirectoryScoped.returns(Effect.succeed(tempDir));

    const result = yield* createTmpDir();

    expect(result).to.deep.equal(tempDir);
    expect(fsMakeTempDirectoryScoped.calledOnceWithExactly()).to.be.true;
    expect(fsWriteFileString.notCalled).to.be.true;
    expect(fsReadFileString.notCalled).to.be.true;
    expect(httpClientExecute.notCalled).to.be.true;
  }));

  it('getRemoteFile', run(function* () {
    const filterStatusOk = sinon
      .stub(HttpClient, 'filterStatusOk')
      .returnsArg(0);
    const url = 'myURL';
    const expectedRequest = { url };
    const httpClientRequestGet = sinon
      .stub(HttpClientRequest, 'get')
      .returns(expectedRequest as HttpClientRequest.HttpClientRequest);
    const remoteFileText = 'myText';
    httpClientExecute.returns(Effect.succeed({ text: Effect.succeed(remoteFileText) }));

    const result = yield* getRemoteFile(url);

    expect(result).to.deep.equal(remoteFileText);
    expect(filterStatusOk.calledOnce).to.be.true;
    expect(httpClientRequestGet.calledOnceWithExactly(url)).to.be.true;
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
    expect(fsMakeTempDirectoryScoped.notCalled).to.be.true;
    expect(fsWriteFileString.notCalled).to.be.true;
    expect(fsReadFileString.calledOnceWithExactly(`${path}/${fileName}`)).to.be.true;
    expect(httpClientExecute.notCalled).to.be.true;
  }));
});
