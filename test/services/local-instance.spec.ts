import { describe, it } from 'mocha';
import { Array, Effect, Either, Layer, Option, pipe, Redacted, Schedule } from 'effect';
import sinon, { SinonStub } from 'sinon';
import { expect } from 'chai';
import { genWithLayer, sandbox } from '../utils/base.js';
import * as LocalInstanceSvc from '../../src/services/local-instance.js';
import { SSLType } from '../../src/services/local-instance.js';
import { NodeContext } from '@effect/platform-node';
import { HttpClient, HttpClientRequest, FileSystem } from '@effect/platform';
import esmock from 'esmock';

const INSTANCE_NAME = 'myinstance';
const HTTP_CLIENT_REQUEST = { hello: 'world' } as unknown as HttpClientRequest.HttpClientRequest;
const PORT = '1234';
const CONTAINER_STATUSES_RUNNING = ['running'];
const CONTAINER_STATUSES_STOPPED = ['exited', 'created', 'paused', 'restarting', 'removing', 'dead'];

const chtComposeUrl = (
  version: string,
  fileName: string
) => `https://staging.dev.medicmobile.org/_couch/builds_4/medic%3Amedic%3A${version}/docker-compose/${fileName}`;
const mockDockerLib = {
  doesVolumeExistWithLabel: sandbox.stub(),
  createComposeContainers: sandbox.stub(),
  getContainersForComposeProject: sandbox.stub(),
  getEnvarFromComposeContainer: sandbox.stub(),
  copyFileToComposeContainer: sandbox.stub(),
  pullComposeImages: sandbox.stub(),
  copyFileFromComposeContainer: sandbox.stub(),
  restartCompose: sandbox.stub(),
  rmComposeContainer: sandbox.stub(),
  stopCompose: sandbox.stub(),
  destroyCompose: sandbox.stub(),
  startCompose: sandbox.stub(),
  restartComposeService: sandbox.stub(),
  getVolumeNamesWithLabel: sandbox.stub(),
  getVolumeLabelValue: sandbox.stub(),
};
const mockFileLib = {
  createTmpDir: sandbox.stub(),
  writeFile: sandbox.stub(),
  writeEnvFile: sandbox.stub(),
  writeJsonFile: sandbox.stub(),
  readJsonFile: sandbox.stub(),
  getRemoteFile: sandbox.stub(),
}
const mockHttpClient = { filterStatusOk: sandbox.stub() };
const mockHttpRequest = { get: sandbox.stub() };
const mockFileSystem = {
  makeDirectory: sandbox.stub(),
  readFileString: sandbox.stub(),
};
const mockNetworkLib = { getFreePorts: sandbox.stub() };
const mockSchedule = { spaced: sandbox.stub() };
const httpClientExecute = sandbox.stub();

const { LocalInstanceService } = await esmock<typeof LocalInstanceSvc>('../../src/services/local-instance.js', {
  '../../src/libs/docker.js': mockDockerLib,
  '../../src/libs/file.js': mockFileLib,
  '@effect/platform/HttpClient': mockHttpClient,
  '@effect/platform': { HttpClientRequest: mockHttpRequest },
  '../../src/libs/local-network.js': mockNetworkLib,
  'effect': { Schedule: mockSchedule },
});
const run = LocalInstanceService.Default.pipe(
  Layer.provide(Layer.succeed(FileSystem.FileSystem, mockFileSystem as unknown as FileSystem.FileSystem)),
  Layer.provide(NodeContext.layer),
  Layer.provide(Layer.succeed(HttpClient.HttpClient, {
    execute: httpClientExecute,
  } as unknown as HttpClient.HttpClient)),
  genWithLayer,
);

const getEnvarFromComposeArgs = (envar: string) => (
  projectName: string
) => ['cht-upgrade-service', envar, `${projectName}-up`];

describe('Local Instance Service', () => {
  let writeFileInner: SinonStub;
  let createComposeContainersInner: SinonStub;
  let copyFileToComposeContainerInner: SinonStub;

  beforeEach(() => {
    writeFileInner = sinon
      .stub()
      .returns(Effect.void);
    mockFileLib.writeFile.returns(writeFileInner);
    createComposeContainersInner = sinon
      .stub()
      .returns(Effect.void);
    mockDockerLib.createComposeContainers.returns(createComposeContainersInner);
    mockHttpClient.filterStatusOk.returnsArg(0);
    mockHttpRequest.get.returns(HTTP_CLIENT_REQUEST);
    copyFileToComposeContainerInner = sinon
      .stub()
      .returns(Effect.void);
    mockDockerLib.copyFileToComposeContainer.returns(copyFileToComposeContainerInner);
  });

  describe('create', () => {
    let pullComposeImagesInner: SinonStub;

    beforeEach(() => {
      mockFileLib.writeJsonFile.returns(Effect.void);
      mockFileLib.writeEnvFile.returns(Effect.void);
      pullComposeImagesInner = sinon
        .stub()
        .returns(Effect.void);
      mockDockerLib.pullComposeImages.returns(pullComposeImagesInner);
      mockFileSystem.makeDirectory.returns(Effect.void);
    });

    it('creates a new instance with the given name and version', run(function* () {
      const version = '3.7.0';
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(false));
      const httpsPort = 1234;
      const httpPort = 5678;
      mockNetworkLib.getFreePorts.returns(Effect.succeed([httpsPort, httpPort]));
      const tmpDir = '/tmp/asdfasdfas';
      mockFileLib.createTmpDir.returns(Effect.succeed(tmpDir));
      const coreComposeName = 'cht-core.yml';
      const couchComposeName = 'cht-couchdb.yml';
      const coreComposeURL = chtComposeUrl(version, coreComposeName);
      const couchComposeURL = chtComposeUrl(version, couchComposeName);
      mockFileLib.getRemoteFile.withArgs(coreComposeURL).returns(Effect.succeed('core-compose-file'));
      mockFileLib.getRemoteFile.withArgs(couchComposeURL).returns(Effect.succeed('couch-compose-file'));
      mockFileSystem.readFileString.returns(Effect.succeed('nouveau:'))

      yield* LocalInstanceService.create(INSTANCE_NAME, version, Option.none());

      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(mockNetworkLib.getFreePorts.calledOnceWithExactly()).to.be.true;
      expect(mockFileLib.createTmpDir.calledOnceWithExactly()).to.be.true;
      expect(mockFileLib.getRemoteFile.args).to.deep.equal([[coreComposeURL], [couchComposeURL]]);
      expect(mockFileSystem.makeDirectory.notCalled).to.be.true;
      expect(mockFileLib.writeFile.args).to.deep.equal([
        [`${tmpDir}/compose.yaml`],
        [`${tmpDir}/chtx-override.yaml`],
        [`${tmpDir}/${coreComposeName}`],
        [`${tmpDir}/${couchComposeName}`],
      ]);
      expect(writeFileInner.callCount).to.equal(4);
      expect(writeFileInner.args[0][0]).to.include('image: public.ecr.aws/s5s3h4s7/cht-upgrade-service:latest');
      expect(writeFileInner.args[1]).to.deep.equal(['core-compose-file']);
      expect(writeFileInner.args[2]).to.deep.equal(['couch-compose-file']);
      expect(writeFileInner.args[3][0]).to.include('cht-couchdb-data:/opt/couchdb/data');
      expect(writeFileInner.args[3][0]).to.include('cht-nouveau-data:/data/nouveau');
      expect(writeFileInner.args[3][0]).to.not.include(`device: /data/credentials`);
      const expectedEnv = {
        CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
        CHT_NETWORK: INSTANCE_NAME,
        COMPOSE_PROJECT_NAME: `${INSTANCE_NAME}-up`,
        COUCHDB_PASSWORD: 'password',
        COUCHDB_USER: 'medic',
        NGINX_HTTP_PORT: httpPort,
        NGINX_HTTPS_PORT: httpsPort,
      };
      expect(mockFileLib.writeEnvFile.notCalled).to.be.true;
      expect(mockFileLib.writeJsonFile.calledOnce).to.be.true;
      expect(mockFileLib.writeJsonFile.args[0][0]).to.equal(`${tmpDir}/env.json`);
      const actualEnv = mockFileLib.writeJsonFile.args[0][1] as Record<string, string>;
      expect(actualEnv).to.deep.include(expectedEnv);
      expect(actualEnv).to.have.property('COUCHDB_SECRET').that.is.a('string').that.has.length(32);
      expect(mockDockerLib.pullComposeImages.calledOnceWithExactly(INSTANCE_NAME, actualEnv)).to.be.true;
      expect(pullComposeImagesInner.calledOnceWithExactly([
        `${tmpDir}/${coreComposeName}`,
        `${tmpDir}/${couchComposeName}`,
        `${tmpDir}/chtx-override.yaml`,
        `${tmpDir}/compose.yaml`,
      ])).to.be.true;
      expect(mockDockerLib.createComposeContainers.calledOnceWithExactly(
        actualEnv, `${tmpDir}/compose.yaml`
      )).to.be.true;
      expect(createComposeContainersInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockDockerLib.copyFileToComposeContainer.calledOnceWithExactly(
        `${INSTANCE_NAME}-up`, 'cht-upgrade-service'
      )).to.be.true;
      expect(copyFileToComposeContainerInner.callCount).to.equal(4);
      expect(copyFileToComposeContainerInner.args[0][0]).to.deep.equal(
        [`${tmpDir}/${coreComposeName}`, `/docker-compose/${coreComposeName}`]
      );
      expect(copyFileToComposeContainerInner.args[1][0]).to.deep.equal(
        [`${tmpDir}/${couchComposeName}`, `/docker-compose/${couchComposeName}`]
      );
      expect(copyFileToComposeContainerInner.args[2][0]).to.deep.equal(
        [`${tmpDir}/chtx-override.yaml`, `/docker-compose/chtx-override.yaml`]
      );
      expect(copyFileToComposeContainerInner.args[3][0]).to.deep.equal(
        [`${tmpDir}/env.json`, `/docker-compose/env.json`]
      );
      expect(mockFileSystem.readFileString.calledOnceWithExactly(`${tmpDir}/${couchComposeName}`)).to.be.true;
    }));

    it('creates a new instance with the data mapped to the given local directory', run(function* () {
      const version = '3.7.0';
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(false));
      const httpsPort = 1234;
      const httpPort = 5678;
      mockNetworkLib.getFreePorts.returns(Effect.succeed([httpsPort, httpPort]));
      const tmpDir = '/tmp/asdfasdfas';
      mockFileLib.createTmpDir.returns(Effect.succeed(tmpDir));
      const coreComposeName = 'cht-core.yml';
      const couchComposeName = 'cht-couchdb.yml';
      const coreComposeURL = chtComposeUrl(version, coreComposeName);
      const couchComposeURL = chtComposeUrl(version, couchComposeName);
      mockFileLib.getRemoteFile.withArgs(coreComposeURL).returns(Effect.succeed('core-compose-file'));
      mockFileLib.getRemoteFile.withArgs(couchComposeURL).returns(Effect.succeed('couch-compose-file'));
      mockFileSystem.readFileString.returns(Effect.succeed('instance without nouveau'))
      const dataDir = '/data/directory';

      yield* LocalInstanceService.create(INSTANCE_NAME, version, Option.some(dataDir));

      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(mockNetworkLib.getFreePorts.calledOnceWithExactly()).to.be.true;
      expect(mockFileLib.createTmpDir.calledOnceWithExactly()).to.be.true;
      expect(mockFileLib.getRemoteFile.args).to.deep.equal([[coreComposeURL], [couchComposeURL]]);
      const expectedDataDirs = pipe(
        Array.make('credentials', 'couchdb', 'nouveau', 'docker-compose'),
        Array.map(dir => `${dataDir}/${dir}`),
      );
      expect(mockFileSystem.makeDirectory.args).to.deep.equal(pipe(
        expectedDataDirs,
        Array.map(dir => [dir, { recursive: true }]),
      ));
      expect(mockFileLib.writeFile.args).to.deep.equal([
        [`${dataDir}/compose.yaml`],
        [`${tmpDir}/chtx-override.yaml`],
        [`${tmpDir}/${coreComposeName}`],
        [`${tmpDir}/${couchComposeName}`],
      ]);
      expect(writeFileInner.callCount).to.equal(4);
      expect(writeFileInner.args[0][0]).to.include('image: public.ecr.aws/s5s3h4s7/cht-upgrade-service:latest');
      expect(writeFileInner.args[0][0]).to.include(`device: ${expectedDataDirs[3]}`);
      expect(writeFileInner.args[1]).to.deep.equal(['core-compose-file']);
      expect(writeFileInner.args[2]).to.deep.equal(['couch-compose-file']);
      expect(writeFileInner.args[3][0]).to.include('cht-couchdb-data:/opt/couchdb/data');
      expect(writeFileInner.args[3][0]).to.not.include('cht-nouveau-data:/data/nouveau');
      pipe(
        expectedDataDirs.slice(0, 3),
        Array.forEach(dir => expect(writeFileInner.args[3][0]).to.include(`device: ${dir}`))
      );
      const expectedEnv = {
        CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
        CHT_NETWORK: INSTANCE_NAME,
        COMPOSE_PROJECT_NAME: `${INSTANCE_NAME}-up`,
        COUCHDB_PASSWORD: 'password',
        COUCHDB_USER: 'medic',
        NGINX_HTTP_PORT: httpPort,
        NGINX_HTTPS_PORT: httpsPort,
      };
      expect(mockFileLib.writeEnvFile.calledOnce).to.be.true;
      expect(mockFileLib.writeEnvFile.args[0][0]).to.equal(`${dataDir}/.env`);
      expect(mockFileLib.writeEnvFile.args[0][1]).to.deep.include(expectedEnv);
      expect(mockFileLib.writeJsonFile.calledOnce).to.be.true;
      expect(mockFileLib.writeJsonFile.args[0][0]).to.equal(`${tmpDir}/env.json`);
      const actualEnv = mockFileLib.writeJsonFile.args[0][1] as Record<string, string>;
      expect(actualEnv).to.deep.include(expectedEnv);
      expect(actualEnv).to.have.property('COUCHDB_SECRET').that.is.a('string').that.has.length(32);
      expect(mockDockerLib.pullComposeImages.calledOnceWithExactly(INSTANCE_NAME, actualEnv)).to.be.true;
      expect(pullComposeImagesInner.calledOnceWithExactly([
        `${tmpDir}/${coreComposeName}`,
        `${tmpDir}/${couchComposeName}`,
        `${tmpDir}/chtx-override.yaml`,
        `${dataDir}/compose.yaml`,
      ])).to.be.true;
      expect(mockDockerLib.createComposeContainers.calledOnceWithExactly(
        actualEnv, `${dataDir}/compose.yaml`
      )).to.be.true;
      expect(createComposeContainersInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockDockerLib.copyFileToComposeContainer.calledOnceWithExactly(
        `${INSTANCE_NAME}-up`, 'cht-upgrade-service'
      )).to.be.true;
      expect(copyFileToComposeContainerInner.callCount).to.equal(4);
      expect(copyFileToComposeContainerInner.args[0][0]).to.deep.equal(
        [`${tmpDir}/${coreComposeName}`, `/docker-compose/${coreComposeName}`]
      );
      expect(copyFileToComposeContainerInner.args[1][0]).to.deep.equal(
        [`${tmpDir}/${couchComposeName}`, `/docker-compose/${couchComposeName}`]
      );
      expect(copyFileToComposeContainerInner.args[2][0]).to.deep.equal(
        [`${tmpDir}/chtx-override.yaml`, `/docker-compose/chtx-override.yaml`]
      );
      expect(copyFileToComposeContainerInner.args[3][0]).to.deep.equal(
        [`${tmpDir}/env.json`, `/docker-compose/env.json`]
      );
      expect(mockFileSystem.readFileString.calledOnceWithExactly(`${tmpDir}/${couchComposeName}`)).to.be.true;
    }));

    it('returns error if chtx volume already exists with the same name', run(function* () {
      const version = '3.7.0';
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));
      mockNetworkLib.getFreePorts.returns(Effect.succeed([1234, 5678]));
      mockFileLib.createTmpDir.returns(Effect.succeed('/tmp/asdfasdfas'));

      const either = yield* LocalInstanceService
        .create(INSTANCE_NAME, version, Option.none())
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal(new Error(`Instance ${INSTANCE_NAME} already exists`));
        expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
        expect(mockNetworkLib.getFreePorts.calledOnceWithExactly()).to.be.true;
        expect(mockFileLib.createTmpDir.calledOnceWithExactly()).to.be.true;
        expect(mockFileLib.getRemoteFile.notCalled).to.be.true;
        expect(mockFileLib.writeFile.notCalled).to.be.true;
        expect(writeFileInner.notCalled).to.be.true;
        expect(mockFileLib.writeJsonFile.notCalled).to.be.true;
        expect(mockDockerLib.pullComposeImages.notCalled).to.be.true;
        expect(pullComposeImagesInner.notCalled).to.be.true;
        expect(mockDockerLib.createComposeContainers.notCalled).to.be.true;
        expect(createComposeContainersInner.notCalled).to.be.true;
        expect(copyFileToComposeContainerInner.notCalled).to.be.true;
      } else {
        expect.fail('Expected error to be returned');
      }
    }));
  });

  describe('start', () => {
    const argsForGetEnvarForPorts = getEnvarFromComposeArgs('NGINX_HTTPS_PORT')(INSTANCE_NAME);
    const argsForGetEnvarForUsernames = getEnvarFromComposeArgs('COUCHDB_USER')(INSTANCE_NAME);
    const argsForGetEnvarForPasswords = getEnvarFromComposeArgs('COUCHDB_PASSWORD')(INSTANCE_NAME);
    const expectedLocalInstanceInfo = {
      name: INSTANCE_NAME,
      port: Option.some(PORT),
      username: 'medic',
      password: Redacted.make('password'),
      status: 'running'
    };

    let copyFileFromComposeContainerInner: SinonStub;
    let rmComposeContainerInner: SinonStub;

    beforeEach(() => {
      mockDockerLib
        .getEnvarFromComposeContainer
        .withArgs(...argsForGetEnvarForPorts)
        .returns(Effect.succeed(PORT));
      mockDockerLib
        .getEnvarFromComposeContainer
        .withArgs(...argsForGetEnvarForUsernames)
        .returns(Effect.succeed('medic'));
      mockDockerLib
        .getEnvarFromComposeContainer
        .withArgs(...argsForGetEnvarForPasswords)
        .returns(Effect.succeed('password'));
      mockDockerLib.restartCompose.returns(Effect.void);
      copyFileFromComposeContainerInner = sinon
        .stub()
        .returns(Effect.void);
      mockDockerLib.copyFileFromComposeContainer.returns(copyFileFromComposeContainerInner);
      rmComposeContainerInner = sinon
        .stub()
        .returns(Effect.void);
      mockDockerLib.rmComposeContainer.returns(rmComposeContainerInner);

      mockDockerLib.getContainersForComposeProject
        .withArgs(INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING)
        .returns(Effect.succeed(['container']))
        .withArgs(INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED)
        .returns(Effect.succeed([]));
    });

    afterEach(() => {
      expect(mockDockerLib.getEnvarFromComposeContainer.args).to.deep.equalInAnyOrder([
        argsForGetEnvarForPorts,
        argsForGetEnvarForUsernames,
        argsForGetEnvarForPasswords,
      ]);
    });

    it('starts existing CHT instance', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));
      mockDockerLib.getContainersForComposeProject
        .withArgs(`${INSTANCE_NAME}-up`)
        .returns(Effect.succeed(['container']));
      httpClientExecute.returns(Effect.void);

      const result = yield* LocalInstanceService.start(INSTANCE_NAME, Option.none());

      expect(result).to.deep.equal(expectedLocalInstanceInfo);
      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(mockDockerLib.getContainersForComposeProject.args).to.deep.equal([
        [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED],
        [`${INSTANCE_NAME}-up`],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED]
      ]);
      expect(mockFileLib.writeFile.notCalled).to.be.true;
      expect(writeFileInner.notCalled).to.be.true;
      expect(mockDockerLib.createComposeContainers.notCalled).to.be.true;
      expect(createComposeContainersInner.notCalled).to.be.true;
      expect(mockDockerLib.copyFileFromComposeContainer.notCalled).to.be.true;
      expect(copyFileFromComposeContainerInner.notCalled).to.be.true;
      expect(mockDockerLib.rmComposeContainer.notCalled).to.be.true;
      expect(rmComposeContainerInner.notCalled).to.be.true;
      expect(mockDockerLib.restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockHttpClient.filterStatusOk.calledOnce).to.be.true;
      expect(mockHttpRequest.get.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
      expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
    }));

    it('waits for instance to be up and responsive', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));
      mockDockerLib.getContainersForComposeProject
        .withArgs(`${INSTANCE_NAME}-up`)
        .returns(Effect.succeed(['container']));
      httpClientExecute.onFirstCall().returns(Effect.fail('Service not ready'));
      httpClientExecute.onSecondCall().returns(Effect.void);
      mockSchedule.spaced.returns(Schedule.forever); // Avoid waiting in tests

      const result = yield* LocalInstanceService.start(INSTANCE_NAME, Option.none());

      expect(result).to.deep.equal(expectedLocalInstanceInfo);
      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(mockDockerLib.getContainersForComposeProject.args).to.deep.equal([
        [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED],
        [`${INSTANCE_NAME}-up`],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED]
      ]);
      expect(mockFileLib.writeFile.notCalled).to.be.true;
      expect(writeFileInner.notCalled).to.be.true;
      expect(mockDockerLib.createComposeContainers.notCalled).to.be.true;
      expect(createComposeContainersInner.notCalled).to.be.true;
      expect(mockDockerLib.copyFileFromComposeContainer.notCalled).to.be.true;
      expect(copyFileFromComposeContainerInner.notCalled).to.be.true;
      expect(mockDockerLib.rmComposeContainer.notCalled).to.be.true;
      expect(rmComposeContainerInner.notCalled).to.be.true;
      expect(mockDockerLib.restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockHttpClient.filterStatusOk.calledTwice).to.be.true;
      expect(mockHttpRequest.get.args).to.deep.equal(
        [[`https://localhost:${PORT}/api/info`], [`https://localhost:${PORT}/api/info`]]
      );
      expect(httpClientExecute.args).to.deep.equal([[HTTP_CLIENT_REQUEST], [HTTP_CLIENT_REQUEST]]);
      expect(mockSchedule.spaced.calledOnceWithExactly(1000)).to.be.true;
    }));

    it('creates and starts CHT instance from existing volume', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));
      mockDockerLib.getContainersForComposeProject
        .withArgs(`${INSTANCE_NAME}-up`)
        .returns(Effect.succeed([]));
      const tmpDir = '/tmp/asdfasdfas';
      mockFileLib.createTmpDir.returns(Effect.succeed(tmpDir));
      const env = {
        CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
        CHT_NETWORK: INSTANCE_NAME,
        COMPOSE_PROJECT_NAME: `${INSTANCE_NAME}-up`,
        COUCHDB_PASSWORD: 'password',
        COUCHDB_SECRET: 'secret',
        COUCHDB_USER: 'medic',
        NGINX_HTTP_PORT: 1111,
        NGINX_HTTPS_PORT: Number(PORT),
      };
      mockFileLib.readJsonFile.returns(Effect.succeed(env));
      httpClientExecute.returns(Effect.void);

      const result = yield* LocalInstanceService.start(INSTANCE_NAME, Option.none());

      expect(result).to.deep.equal(expectedLocalInstanceInfo);
      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(mockDockerLib.getContainersForComposeProject.args).to.deep.equal([
        [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED],
        [`${INSTANCE_NAME}-up`],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED]
      ]);
      expect(mockFileLib.writeFile.calledOnceWithExactly(`${tmpDir}/compose.yaml`)).to.be.true;
      expect(writeFileInner.calledOnce).to.be.true;
      expect(writeFileInner.args[0][0]).to.include('image: public.ecr.aws/s5s3h4s7/cht-upgrade-service:latest');
      expect(mockDockerLib.createComposeContainers.args).to.deep.equal([
        [{}, `${tmpDir}/compose.yaml`],
        [env, `${tmpDir}/compose.yaml`]
      ]);
      expect(createComposeContainersInner.args).to.deep.equal([[`${INSTANCE_NAME}-up`], [`${INSTANCE_NAME}-up`]]);
      expect(mockDockerLib.copyFileFromComposeContainer.calledOnceWithExactly(
        'cht-upgrade-service', '/docker-compose/env.json', `${tmpDir}/env.json`
      )).to.be.true;
      expect(copyFileFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockDockerLib.rmComposeContainer.calledOnceWithExactly('cht-upgrade-service')).to.be.true;
      expect(rmComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockDockerLib.restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockHttpClient.filterStatusOk.calledOnce).to.be.true;
      expect(mockHttpRequest.get.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
      expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
    }));

    it('returns error when no volume exists for project name', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(false));

      const either = yield* LocalInstanceService
        .start(INSTANCE_NAME, Option.none())
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal(new Error(`Instance ${INSTANCE_NAME} does not exist`));
        expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
        expect(mockDockerLib.getContainersForComposeProject.args).to.deep.equal([
          [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
          [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED],
        ]);
        expect(mockFileLib.writeFile.notCalled).to.be.true;
        expect(writeFileInner.notCalled).to.be.true;
        expect(mockDockerLib.createComposeContainers.notCalled).to.be.true;
        expect(createComposeContainersInner.notCalled).to.be.true;
        expect(mockDockerLib.copyFileFromComposeContainer.notCalled).to.be.true;
        expect(copyFileFromComposeContainerInner.notCalled).to.be.true;
        expect(mockDockerLib.rmComposeContainer.notCalled).to.be.true;
        expect(rmComposeContainerInner.notCalled).to.be.true;
        expect(mockDockerLib.restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(mockHttpClient.filterStatusOk.notCalled).to.be.true;
        expect(mockHttpRequest.get.notCalled).to.be.true;
        expect(httpClientExecute.notCalled).to.be.true;
      } else {
        expect.fail('Expected error');
      }
    }));

    it('handles problems removing the temp upgrade service container', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));
      mockDockerLib.getContainersForComposeProject
        .withArgs(`${INSTANCE_NAME}-up`)
        .returns(Effect.succeed([]));
      const tmpDir = '/tmp/asdfasdfas';
      mockFileLib.createTmpDir.returns(Effect.succeed(tmpDir));
      const env = {
        CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
        CHT_NETWORK: INSTANCE_NAME,
        COMPOSE_PROJECT_NAME: `${INSTANCE_NAME}-up`,
        COUCHDB_PASSWORD: 'password',
        COUCHDB_SECRET: 'secret',
        COUCHDB_USER: 'medic',
        NGINX_HTTP_PORT: 1111,
        NGINX_HTTPS_PORT: Number(PORT),
      };
      mockFileLib.readJsonFile.returns(Effect.succeed(env));
      httpClientExecute.returns(Effect.void);
      rmComposeContainerInner.returns(Effect.fail('Failed to remove container'));

      const result = yield* LocalInstanceService.start(INSTANCE_NAME, Option.none());

      expect(result).to.deep.equal(expectedLocalInstanceInfo);
      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(mockDockerLib.getContainersForComposeProject.args).to.deep.equal([
        [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED],
        [`${INSTANCE_NAME}-up`],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED]
      ]);
      expect(mockFileLib.writeFile.calledOnceWithExactly(`${tmpDir}/compose.yaml`)).to.be.true;
      expect(writeFileInner.calledOnce).to.be.true;
      expect(writeFileInner.args[0][0]).to.include('image: public.ecr.aws/s5s3h4s7/cht-upgrade-service:latest');
      expect(mockDockerLib.createComposeContainers.args).to.deep.equal([
        [{}, `${tmpDir}/compose.yaml`],
        [env, `${tmpDir}/compose.yaml`]
      ]);
      expect(createComposeContainersInner.args).to.deep.equal([[`${INSTANCE_NAME}-up`], [`${INSTANCE_NAME}-up`]]);
      expect(mockDockerLib.copyFileFromComposeContainer.calledOnceWithExactly(
        'cht-upgrade-service', '/docker-compose/env.json', `${tmpDir}/env.json`
      )).to.be.true;
      expect(copyFileFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockDockerLib.rmComposeContainer.calledOnceWithExactly('cht-upgrade-service')).to.be.true;
      expect(rmComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockDockerLib.restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockHttpClient.filterStatusOk.calledOnce).to.be.true;
      expect(mockHttpRequest.get.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
      expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
    }));

    it('creates and starts CHT instance from local directory', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(false));
      const env = {
        CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
        CHT_NETWORK: INSTANCE_NAME,
        COMPOSE_PROJECT_NAME: `${INSTANCE_NAME}-up`,
        COUCHDB_PASSWORD: 'password',
        COUCHDB_SECRET: 'secret',
        COUCHDB_USER: 'medic',
        NGINX_HTTP_PORT: 1111,
        NGINX_HTTPS_PORT: Number(PORT),
      };
      mockFileLib.readJsonFile.returns(Effect.succeed(env));
      httpClientExecute.returns(Effect.void);
      const dirPath = '/data/directory';

      const result = yield* LocalInstanceService.start(INSTANCE_NAME, Option.some(dirPath));

      expect(result).to.deep.equal(expectedLocalInstanceInfo);
      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(mockDockerLib.getContainersForComposeProject.args).to.deep.equal([
        [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED]
      ]);
      expect(mockFileLib.writeFile.notCalled).to.be.true;
      expect(writeFileInner.notCalled).to.be.true;
      expect(mockDockerLib.createComposeContainers.args).to.deep.equal([[env, `${dirPath}/compose.yaml`]]);
      expect(createComposeContainersInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockDockerLib.copyFileFromComposeContainer.notCalled).to.be.true;
      expect(mockDockerLib.rmComposeContainer.notCalled).to.be.true;
      expect(mockDockerLib.restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockHttpClient.filterStatusOk.calledOnce).to.be.true;
      expect(mockHttpRequest.get.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
      expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
    }));

    it('returns error when starting CHT instance from local directory when docker volume exists', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));
      const env = {
        CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
        CHT_NETWORK: INSTANCE_NAME,
        COMPOSE_PROJECT_NAME: `${INSTANCE_NAME}-up`,
        COUCHDB_PASSWORD: 'password',
        COUCHDB_SECRET: 'secret',
        COUCHDB_USER: 'medic',
        NGINX_HTTP_PORT: 1111,
        NGINX_HTTPS_PORT: Number(PORT),
      };
      mockFileLib.readJsonFile.returns(Effect.succeed(env));
      httpClientExecute.returns(Effect.void);
      const dirPath = '/data/directory';

      const either = yield* LocalInstanceService
        .start(INSTANCE_NAME, Option.some(dirPath))
        .pipe(Effect.either);

      if (Either.isRight(either)) {
        expect.fail('Expected error');
      }

      expect(either.left).to.deep.equal(new Error(`Instance ${INSTANCE_NAME} already exists`));
      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(mockDockerLib.getContainersForComposeProject.args).to.deep.equal([
        [INSTANCE_NAME, ...CONTAINER_STATUSES_RUNNING],
        [INSTANCE_NAME, ...CONTAINER_STATUSES_STOPPED]
      ]);
      expect(mockFileLib.writeFile.notCalled).to.be.true;
      expect(writeFileInner.notCalled).to.be.true;
      expect(mockDockerLib.createComposeContainers.notCalled).to.be.true;
      expect(createComposeContainersInner.notCalled).to.be.true;
      expect(mockDockerLib.copyFileFromComposeContainer.notCalled).to.be.true;
      expect(mockDockerLib.rmComposeContainer.notCalled).to.be.true;
      expect(mockDockerLib.restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockHttpClient.filterStatusOk.notCalled).to.be.true;
      expect(mockHttpRequest.get.notCalled).to.be.true;
      expect(httpClientExecute.notCalled).to.be.true;
    }));
  });

  describe('stop', () => {
    beforeEach(() => mockDockerLib.stopCompose.returns(Effect.void));

    it('stops containers for project', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));

      yield* LocalInstanceService.stop(INSTANCE_NAME);

      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(mockDockerLib.stopCompose.args).to.deep.equal([[INSTANCE_NAME], [`${INSTANCE_NAME}-up`]]);
    }));

    it('returns error when volume does not exist for project', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(false));

      const either = yield* LocalInstanceService
        .stop(INSTANCE_NAME)
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal(new Error(`Instance ${INSTANCE_NAME} does not exist`));
        expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
        expect(mockDockerLib.stopCompose.args).to.deep.equal([[INSTANCE_NAME], [`${INSTANCE_NAME}-up`]]);
      } else {
        expect.fail('Expected error');
      }
    }));
  });

  describe('rm', () => {
    beforeEach(() => mockDockerLib.destroyCompose.returns(Effect.void));

    it('removes containers for project', run(function* () {
      yield* LocalInstanceService.rm(INSTANCE_NAME);
      expect(mockDockerLib.destroyCompose.args).to.deep.equal([[INSTANCE_NAME], [`${INSTANCE_NAME}-up`]]);
    }));

    it('returns error when failing to remove containers', run(function* () {
      mockDockerLib.destroyCompose.returns(Effect.fail('Failed to remove containers'));

      const either = yield* LocalInstanceService
        .rm(INSTANCE_NAME)
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal('Failed to remove containers');
        expect(mockDockerLib.destroyCompose.args).to.deep.equal([[INSTANCE_NAME], [`${INSTANCE_NAME}-up`]]);
      } else {
        expect.fail('Expected error');
      }
    }));
  });

  describe('setSSLCerts', () => {
    const sslType = 'local-ip';
    const expectedFullChain = 'fullchain';
    const expectedKey = 'key';

    beforeEach(() => {
      mockDockerLib.startCompose.returns(Effect.void);
      mockDockerLib.restartComposeService.returns(Effect.void);
    });

    [
      ['local-ip', 'https://local-ip.medicmobile.org/fullchain', 'https://local-ip.medicmobile.org/key'],
      [
        'expired',
        'https://raw.githubusercontent.com/medic/cht-core/refs/heads/master/scripts/tls_certificates/local-ip-expired.crt',
        'https://raw.githubusercontent.com/medic/cht-core/refs/heads/master/scripts/tls_certificates/local-ip-expired.key'
      ],
      [
        'self-signed',
        'https://raw.githubusercontent.com/medic/cht-core/refs/heads/master/scripts/tls_certificates/self-signed.crt',
        'https://raw.githubusercontent.com/medic/cht-core/refs/heads/master/scripts/tls_certificates/self-signed.key'
      ]
    ].forEach(([sslType, chainURL, keyURL]) => {
      it(`sets the ${sslType} SSL certs for the given project`, run(function* () {
        mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));
        mockDockerLib.getContainersForComposeProject.returns(Effect.succeed(['container']));
        mockDockerLib.getEnvarFromComposeContainer.returns(Effect.succeed(PORT));
        httpClientExecute.returns(Effect.void);
        const tmpDir = '/tmp/asdfasdfas';
        mockFileLib.createTmpDir.returns(Effect.succeed(tmpDir));
        mockFileLib.getRemoteFile.withArgs(chainURL).returns(Effect.succeed(expectedFullChain));
        mockFileLib.getRemoteFile.withArgs(keyURL).returns(Effect.succeed(expectedKey));

        yield* LocalInstanceService.setSSLCerts(INSTANCE_NAME, sslType as SSLType);

        expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
        expect(mockDockerLib.getContainersForComposeProject.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(mockDockerLib.startCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(mockDockerLib.getEnvarFromComposeContainer.calledOnceWithExactly(
          'cht-upgrade-service', 'NGINX_HTTPS_PORT', `${INSTANCE_NAME}-up`
        )).to.be.true;
        expect(mockHttpClient.filterStatusOk.calledOnce).to.be.true;
        expect(mockHttpRequest.get.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
        expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
        expect(mockFileLib.createTmpDir.calledOnceWithExactly()).to.be.true;
        expect(mockFileLib.getRemoteFile.args).to.deep.equal([[chainURL], [keyURL]]);
        expect(mockFileLib.writeFile.args).to.deep.equal([[`${tmpDir}/cert.pem`], [`${tmpDir}/key.pem`]]);
        expect(writeFileInner.args).to.deep.equal([[expectedFullChain], [expectedKey]]);
        expect(mockDockerLib.copyFileToComposeContainer.calledOnceWithExactly(INSTANCE_NAME, 'nginx')).to.be.true;
        expect(copyFileToComposeContainerInner.calledTwice).to.be.true;
        expect(copyFileToComposeContainerInner.args[0][0]).to.deep.equal(
          [`${tmpDir}/cert.pem`, '/etc/nginx/private/cert.pem']
        );
        expect(copyFileToComposeContainerInner.args[1][0]).to.deep.equal(
          [`${tmpDir}/key.pem`, '/etc/nginx/private/key.pem']
        );
        expect(mockDockerLib.restartComposeService.calledOnceWithExactly(INSTANCE_NAME, 'nginx')).to.be.true;
      }));
    });

    it('returns error if invalid port value found for project', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));
      mockDockerLib.getContainersForComposeProject.returns(Effect.succeed(['container']));
      mockDockerLib.getEnvarFromComposeContainer.returns(Effect.succeed('invalid_port'));
      const tmpDir = '/tmp/asdfasdfas';
      mockFileLib.createTmpDir.returns(Effect.succeed(tmpDir));

      const either = yield* LocalInstanceService
        .setSSLCerts(INSTANCE_NAME, sslType)
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal(new Error(`Could not get port for instance ${INSTANCE_NAME}`));
        expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
        expect(mockDockerLib.getContainersForComposeProject.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(mockDockerLib.startCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(mockDockerLib.getEnvarFromComposeContainer.calledOnceWithExactly(
          'cht-upgrade-service', 'NGINX_HTTPS_PORT', `${INSTANCE_NAME}-up`
        )).to.be.true;
        expect(mockHttpClient.filterStatusOk.notCalled).to.be.true;
        expect(mockHttpRequest.get.notCalled).to.be.true;
        expect(httpClientExecute.notCalled).to.be.true;
        expect(mockFileLib.createTmpDir.calledOnceWithExactly()).to.be.true;
        expect(mockFileLib.getRemoteFile.notCalled).to.be.true;
        expect(mockFileLib.writeFile.notCalled).to.be.true;
        expect(writeFileInner.notCalled).to.be.true;
        expect(mockDockerLib.copyFileToComposeContainer.notCalled).to.be.true;
        expect(copyFileToComposeContainerInner.notCalled).to.be.true;
        expect(mockDockerLib.restartComposeService.calledOnceWithExactly(INSTANCE_NAME, 'nginx')).to.be.true;
      } else {
        expect.fail('Expected error');
      }
    }));
  });

  describe('ls', () => {
    let getVolumeLabelValueInner: SinonStub;

    beforeEach(() => {
      getVolumeLabelValueInner = sinon.stub();
      mockDockerLib.getVolumeLabelValue.returns(getVolumeLabelValueInner);
    });

    it('returns the project info for the current local instances', run(function* () {
      const volumeNames = ['chtx-instance-1', 'chtx-instance-2', 'chtx-instance-3'];
      const projectNames = ['myfirstinstance', 'mysecondinstance', 'mythirdinstance'];
      const ports = ['1111', '2222', '3333'];
      const usernames = ['medic1', 'medic2', 'medic3'];
      const passwords = ['password1', 'password2', 'password3'];
      mockDockerLib.getVolumeNamesWithLabel.returns(Effect.succeed(volumeNames));
      projectNames.forEach((name, i) => getVolumeLabelValueInner.onCall(i).returns(Effect.succeed(name)));
      const argsForGetEnvarForPorts = Array.map(projectNames, getEnvarFromComposeArgs('NGINX_HTTPS_PORT'));
      const argsForGetEnvarForUsernames = Array.map(projectNames, getEnvarFromComposeArgs('COUCHDB_USER'));
      const argsForGetEnvarForPasswords = Array.map(projectNames, getEnvarFromComposeArgs('COUCHDB_PASSWORD'));
      argsForGetEnvarForPorts.forEach((args, i) => mockDockerLib
        .getEnvarFromComposeContainer
        .withArgs(...args)
        .returns(Effect.succeed(ports[i])));
      argsForGetEnvarForUsernames.forEach((args, i) => mockDockerLib
        .getEnvarFromComposeContainer
        .withArgs(...args)
        .returns(Effect.succeed(usernames[i])));
      argsForGetEnvarForPasswords.forEach((args, i) => mockDockerLib
        .getEnvarFromComposeContainer
        .withArgs(...args)
        .returns(Effect.succeed(passwords[i])));
      projectNames.forEach(name => mockDockerLib.getContainersForComposeProject
        .withArgs(name, ...CONTAINER_STATUSES_RUNNING)
        .returns(Effect.succeed(['container']))
        .withArgs(name, ...CONTAINER_STATUSES_STOPPED)
        .returns(Effect.succeed([])));

      const results = yield* LocalInstanceService.ls();

      const expectedResults = pipe(
        Array.map(ports, Option.some),
        Array.zipWith(projectNames, (port, name) => ({ name, port })),
        Array.zipWith(usernames, (info, username) => ({ ...info, username })),
        Array.zipWith(passwords, (info, password) => ({
          ...info,
          password: Redacted.make(password),
          status: 'running'
        })),
      );
      expect(results).to.deep.equal(expectedResults);
      expect(mockDockerLib.getVolumeNamesWithLabel.calledOnceWithExactly('chtx.instance')).to.be.true;
      expect(mockDockerLib.getVolumeLabelValue.calledOnceWithExactly('chtx.instance')).to.be.true;
      expect(getVolumeLabelValueInner.args).to.deep.equal(Array.map(volumeNames, Array.make));
      expect(mockDockerLib.getEnvarFromComposeContainer.args).to.deep.equalInAnyOrder([
        ...argsForGetEnvarForUsernames,
        ...argsForGetEnvarForPasswords,
        ...argsForGetEnvarForPorts,
      ]);
      expect(mockDockerLib.getContainersForComposeProject.args).to.deep.equal(projectNames.flatMap(projectName => [
        [projectName, ...CONTAINER_STATUSES_RUNNING],
        [projectName, ...CONTAINER_STATUSES_STOPPED],
      ]));
    }));

    it('does not include port when it cannot be found', run(function* () {
      const volumeName = 'chtx-instance-1';
      const projectName = 'myfirstinstance';
      mockDockerLib.getVolumeNamesWithLabel.returns(Effect.succeed([volumeName]));
      getVolumeLabelValueInner.returns(Effect.succeed(projectName));
      const argsForGetEnvarForPorts = getEnvarFromComposeArgs('NGINX_HTTPS_PORT')(projectName);
      const argsForGetEnvarForUsernames = getEnvarFromComposeArgs('COUCHDB_USER')(projectName);
      const argsForGetEnvarForPasswords = getEnvarFromComposeArgs('COUCHDB_PASSWORD')(projectName);
      mockDockerLib.getEnvarFromComposeContainer
        .withArgs(...argsForGetEnvarForPorts)
        .returns(Effect.succeed('invalid port'));
      mockDockerLib.getEnvarFromComposeContainer
        .withArgs(...argsForGetEnvarForUsernames)
        .returns(Effect.succeed('medic'));
      mockDockerLib.getEnvarFromComposeContainer
        .withArgs(...argsForGetEnvarForPasswords)
        .returns(Effect.succeed('password'));
      mockDockerLib.getContainersForComposeProject.returns(Effect.succeed([]))

      const results = yield* LocalInstanceService.ls();

      const expectedResults = [{
        name: projectName,
        port: Option.none(),
        username: 'medic',
        password: Redacted.make('password'),
        status: 'stopped'
      }];
      expect(results).to.deep.equal(expectedResults);
      expect(mockDockerLib.getVolumeNamesWithLabel.calledOnceWithExactly('chtx.instance')).to.be.true;
      expect(mockDockerLib.getVolumeLabelValue.calledOnceWithExactly('chtx.instance')).to.be.true;
      expect(getVolumeLabelValueInner.args).to.deep.equal(Array.map([volumeName], Array.make));
      expect(mockDockerLib.getEnvarFromComposeContainer.args).to.deep.equalInAnyOrder([
        argsForGetEnvarForUsernames,
        argsForGetEnvarForPasswords,
        argsForGetEnvarForPorts,
      ]);
      expect(mockDockerLib.getContainersForComposeProject.args).to.deep.equal([
        [projectName, ...CONTAINER_STATUSES_RUNNING],
        [projectName, ...CONTAINER_STATUSES_STOPPED],
      ]);
    }));

    it('returns error when there is a problem getting volume names', run(function* () {
      const message = 'Docker not installed';
      mockDockerLib.getVolumeNamesWithLabel.returns(Effect.fail(message));

      const either = yield* LocalInstanceService
        .ls()
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal(message);
        expect(mockDockerLib.getVolumeNamesWithLabel.calledOnceWithExactly('chtx.instance')).to.be.true;
        expect(mockDockerLib.getVolumeLabelValue.calledOnceWithExactly('chtx.instance')).to.be.true;
        expect(getVolumeLabelValueInner.notCalled).to.be.true;
      } else {
        expect.fail('Expected error to be returned');
      }
    }));

    it('returns stopped status when some containers are running and some are not', run(function* () {
      const volumeName = 'chtx-instance-1';
      const projectName = 'myfirstinstance';
      mockDockerLib.getVolumeNamesWithLabel.returns(Effect.succeed([volumeName]));
      getVolumeLabelValueInner.returns(Effect.succeed(projectName));
      const argsForGetEnvarForPorts = getEnvarFromComposeArgs('NGINX_HTTPS_PORT')(projectName);
      const argsForGetEnvarForUsernames = getEnvarFromComposeArgs('COUCHDB_USER')(projectName);
      const argsForGetEnvarForPasswords = getEnvarFromComposeArgs('COUCHDB_PASSWORD')(projectName);
      mockDockerLib.getEnvarFromComposeContainer
        .withArgs(...argsForGetEnvarForPorts)
        .returns(Effect.succeed('1111'));
      mockDockerLib.getEnvarFromComposeContainer
        .withArgs(...argsForGetEnvarForUsernames)
        .returns(Effect.succeed('medic'));
      mockDockerLib.getEnvarFromComposeContainer
        .withArgs(...argsForGetEnvarForPasswords)
        .returns(Effect.succeed('password'));
      mockDockerLib.getContainersForComposeProject
        .withArgs(projectName, ...CONTAINER_STATUSES_RUNNING)
        .returns(Effect.succeed(['container']))
        .withArgs(projectName, ...CONTAINER_STATUSES_STOPPED)
        .returns(Effect.succeed(['otherContainer']));

      const results = yield* LocalInstanceService.ls();

      const expectedResults = [{
        name: projectName,
        port: Option.some('1111'),
        username: 'medic',
        password: Redacted.make('password'),
        status: 'stopped'
      }];
      expect(results).to.deep.equal(expectedResults);
      expect(mockDockerLib.getVolumeNamesWithLabel.calledOnceWithExactly('chtx.instance')).to.be.true;
      expect(mockDockerLib.getVolumeLabelValue.calledOnceWithExactly('chtx.instance')).to.be.true;
      expect(getVolumeLabelValueInner.args).to.deep.equal(Array.map([volumeName], Array.make));
      expect(mockDockerLib.getEnvarFromComposeContainer.args).to.deep.equalInAnyOrder([
        argsForGetEnvarForUsernames,
        argsForGetEnvarForPasswords,
        argsForGetEnvarForPorts,
      ]);
      expect(mockDockerLib.getContainersForComposeProject.args).to.deep.equal([
        [projectName, ...CONTAINER_STATUSES_RUNNING],
        [projectName, ...CONTAINER_STATUSES_STOPPED],
      ]);
    }));
  });
});
