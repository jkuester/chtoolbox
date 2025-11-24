import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import { describe, it } from 'mocha';
import { Effect, Either, Layer, pipe } from 'effect';
import { expect } from 'chai';
import sinon, { type SinonStub } from 'sinon';
import { genWithLayer, sandbox } from '../utils/base.ts';
import * as FileLibs from '../../src/libs/file.ts';
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
  writeEnvFile
} = await esmock<typeof FileLibs>('../../src/libs/file.ts', {
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

  describe('readJsonFile', () => {
    const path = 'filepath';
    const fileName = 'filename.json';
    const content = { hello: 'world' };
    const defaultContent = { world: 'hello' };

    let jsonParse: SinonStub;

    beforeEach(() => {
      jsonParse = sinon.stub(JSON, 'parse');
    });

    afterEach(() => {
      expect(fsMakeDirectory.notCalled).to.be.true;
      expect(fsMakeTempDirectoryScoped.notCalled).to.be.true;
      expect(fsWriteFileString.notCalled).to.be.true;
      expect(httpClientExecute.notCalled).to.be.true;
    });

    it('returns the JSON data from a file at the given path', run(function* () {
      const jsonContent = '{ "hello": "world" }';
      fsExists.returns(Effect.succeed(true));
      jsonParse.returns(content);
      fsReadFileString.returns(Effect.succeed(jsonContent));

      const result = yield* readJsonFile(fileName, path);

      expect(result).to.deep.equal(content);
      expect(jsonParse).to.have.been.calledOnceWithExactly(jsonContent);
      expect(fsReadFileString).to.have.been.calledOnceWithExactly(`${path}/${fileName}`);
      expect(fsExists).to.have.been.calledOnceWithExactly(`${path}/${fileName}`);
    }));

    it('returns the JSON data from a file instead of the provided default data', run(function* () {
      const jsonContent = '{ "hello": "world" }';
      fsExists.returns(Effect.succeed(true));
      jsonParse.returns(content);
      fsReadFileString.returns(Effect.succeed(jsonContent));

      yield* readJsonFile(fileName, path, defaultContent);

      expect(jsonParse).to.have.been.calledOnceWithExactly(jsonContent);
      expect(fsReadFileString).to.have.been.calledOnceWithExactly(`${path}/${fileName}`);
      expect(fsExists).to.have.been.calledOnceWithExactly(`${path}/${fileName}`);
    }));

    it('returns the default data when the JSON file does not exist', run(function* () {
      fsExists.returns(Effect.succeed(false));

      yield* readJsonFile(fileName, path, defaultContent);

      expect(jsonParse).to.not.have.called;
      expect(fsReadFileString).to.not.have.called;
      expect(fsExists).to.have.been.calledOnceWithExactly(`${path}/${fileName}`);
    }));

    it('fails when the JSON file does not exist and no default is given', run(function* () {
      fsExists.returns(Effect.succeed(false));

      const either = yield* pipe(
        readJsonFile(fileName, path),
        Effect.catchAllDefect(Effect.fail),
        Effect.either
      );

      if (Either.isRight(either)) {
        expect.fail('Expected error');
      }

      expect(either.left).to.deep.equal(`Could not read file: ${path}/${fileName}`);
      expect(jsonParse).to.not.have.called;
      expect(fsReadFileString).to.not.have.called;
      expect(fsExists).to.have.been.calledOnceWithExactly(`${path}/${fileName}`);
    }));
  });

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
