import { afterEach, describe, it } from 'mocha';
import { Array, Effect, Either, Layer, Option, pipe, Redacted, Schedule } from 'effect';
import sinon, { type SinonStub } from 'sinon';
import { expect } from 'chai';
import { genWithLayer, sandbox } from '../utils/base.ts';
import * as LocalInstanceSvc from '../../src/services/local-instance.ts';
import { type SSLType } from '../../src/services/local-instance.ts';
import { NodeContext } from '@effect/platform-node';
import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import esmock from 'esmock';

const INSTANCE_NAME = 'myinstance';
const HTTP_CLIENT_REQUEST = { hello: 'world' } as unknown as HttpClientRequest.HttpClientRequest;
const PORT = '1234';
const CONTAINER_STATUSES_RUNNING = ['running'];
const CONTAINER_STATUSES_STOPPED = ['exited', 'created', 'paused', 'restarting', 'removing', 'dead'];

const CHT_UPGRADE_SERVICE_COMPOSE_URL = 'https://raw.githubusercontent.com/medic/cht-upgrade-service/main/docker-compose.yml';
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
  createDir: sandbox.stub(),
  createTmpDir: sandbox.stub(),
  isDirectoryEmpty: sandbox.stub(),
  writeFile: sandbox.stub(),
  writeEnvFile: sandbox.stub(),
  getRemoteFile: sandbox.stub(),
};
const mockHttpClient = { filterStatusOk: sandbox.stub() };
const mockHttpRequest = { get: sandbox.stub() };
const mockFileSystem = {
  readFileString: sandbox.stub(),
};
const getFreePorts = sandbox.stub();
const mockSchedule = { spaced: sandbox.stub() };
const httpClientExecute = sandbox.stub();

const { LocalInstanceService } = await esmock<typeof LocalInstanceSvc>('../../src/services/local-instance.ts', {
  '../../src/libs/docker.ts': mockDockerLib,
  '../../src/libs/file.ts': mockFileLib,
  '@effect/platform/HttpClient': mockHttpClient,
  '@effect/platform': { HttpClientRequest: mockHttpRequest },
  '../../src/libs/local-network.ts': { freePortsEffect: Effect.suspend(getFreePorts) },
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
  let rmComposeContainerInner: SinonStub;

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
    rmComposeContainerInner = sinon
      .stub()
      .returns(Effect.void);
    mockDockerLib.rmComposeContainer.returns(rmComposeContainerInner);
  });

  describe('create', () => {
    const version = '3.7.0';
    let pullComposeImagesInner: SinonStub;

    beforeEach(() => {
      mockFileLib.createDir.returns(Effect.void);
      mockFileLib.writeEnvFile.returns(Effect.void);
      pullComposeImagesInner = sinon
        .stub()
        .returns(Effect.void);
      mockDockerLib.pullComposeImages.returns(pullComposeImagesInner);
    });

    describe('successfully creates a new instance', () => {
      const httpsPort = 1234;
      const httpPort = 5678;
      const dataDir = '/data/directory';
      const coreComposeName = 'cht-core.yml';
      const couchComposeName = 'cht-couchdb.yml';
      const coreComposeURL = chtComposeUrl(version, coreComposeName);
      const couchComposeURL = chtComposeUrl(version, couchComposeName);

      beforeEach(() => {
        mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(false));
        getFreePorts.returns(Effect.succeed([httpsPort, httpPort]));
        mockFileLib.isDirectoryEmpty.returns(Effect.succeed(true));
        mockFileLib.getRemoteFile.withArgs(coreComposeURL).returns(Effect.succeed('core-compose-file'));
        mockFileLib.getRemoteFile.withArgs(couchComposeURL).returns(Effect.succeed('couch-compose-file'));
        mockFileLib.getRemoteFile
          .withArgs(CHT_UPGRADE_SERVICE_COMPOSE_URL)
          .returns(Effect.succeed('upgrade-service-compose-file'));
      });

      afterEach(() => {
        expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`))
          .to.be.true;
        expect(getFreePorts.calledOnceWithExactly()).to.be.true;
        expect(mockFileLib.getRemoteFile.args).to.deep.equal([
          [CHT_UPGRADE_SERVICE_COMPOSE_URL],
          [coreComposeURL],
          [couchComposeURL],
        ]);
        const expectedDataDirs = pipe(
          Array.make('credentials', 'couchdb', 'couchdb/nouveau', 'compose', 'ssl', 'upgrade-service'),
          Array.map(dir => `${dataDir}/${dir}`),
        );
        expect(mockFileLib.isDirectoryEmpty.calledOnceWithExactly(dataDir)).to.be.true;
        expect(mockFileLib.createDir.args).to.deep.equal(Array.map(expectedDataDirs, Array.make));
        expect(mockFileLib.writeFile.args).to.deep.equal([
          [`${dataDir}/upgrade-service/docker-compose.yml`],
          [`${dataDir}/upgrade-service/compose.override.yml`],
          [`${dataDir}/compose/chtx-override.yml`],
          [`${dataDir}/compose/${coreComposeName}`],
          [`${dataDir}/compose/${couchComposeName}`],
          [`${dataDir}/compose/Dockerfile.nouveau.empty`],
        ]);
        expect(writeFileInner.callCount).to.equal(6);
        expect(writeFileInner.firstCall.args[0]).to.include('Override for upgrade service compose config');
        expect(writeFileInner.secondCall.args[0]).to.include('Override for CHT compose config');
        expect(writeFileInner.thirdCall.args[0]).to.include(
          'Placeholder image for nouveau container when running pre-5.0 CHT'
        );
        expect(writeFileInner.getCall(3).args).to.deep.equal(['core-compose-file']);
        expect(writeFileInner.getCall(4).args).to.deep.equal(['couch-compose-file']);
        expect(writeFileInner.getCall(5).args).to.deep.equal(['upgrade-service-compose-file']);
        const expectedEnv = {
          CHT_COMPOSE_PATH: 'chtx-compose-files',
          CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
          CHT_NETWORK: INSTANCE_NAME,
          COMPOSE_PROJECT_NAME: `${INSTANCE_NAME}-up`,
          // COUCHDB_DATA: '',
          COUCHDB_PASSWORD: 'password',
          COUCHDB_USER: 'medic',
          DOCKER_CONFIG_PATH: 'chtx-compose-files',
          NGINX_HTTP_PORT: httpPort,
          NGINX_HTTPS_PORT: httpsPort,
        };
        expect(mockFileLib.writeEnvFile.calledOnce).to.be.true;
        expect(mockFileLib.writeEnvFile).to.have.been.calledWith(`${dataDir}/upgrade-service/.env`);
        const actualEnv = mockFileLib.writeEnvFile.firstCall.args[1] as Record<string, string>;
        expect(actualEnv).to.deep.include(expectedEnv);
        expect(actualEnv).to.have.property('COUCHDB_SECRET').that.is.a('string').that.has.length(32);
        expect(actualEnv).to.have.property('COUCHDB_UUID').that.is.a('string').that.is.not.empty;
        expect(mockDockerLib.pullComposeImages.calledOnceWithExactly('tmp', actualEnv)).to.be.true;
        expect(pullComposeImagesInner.calledOnceWithExactly([
          `${dataDir}/compose/${coreComposeName}`,
          `${dataDir}/compose/${couchComposeName}`,
          `${dataDir}/compose/chtx-override.yml`,
          `${dataDir}/upgrade-service/docker-compose.yml`,
          `${dataDir}/upgrade-service/compose.override.yml`,
        ])).to.be.true;
        expect(mockDockerLib.createComposeContainers.calledOnceWithExactly(
          {},
          `${dataDir}/upgrade-service/docker-compose.yml`,
          `${dataDir}/upgrade-service/compose.override.yml`,
        )).to.be.true;
        expect(createComposeContainersInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      });

      it('with all the data stored in named docker volumes', run(function* () {
        mockFileLib.createTmpDir.returns(Effect.succeed(dataDir));

        yield* LocalInstanceService.create(INSTANCE_NAME, version, Option.none());

        expect(mockFileLib.createTmpDir.calledOnceWithExactly()).to.be.true;
        expect(writeFileInner.secondCall.args[0]).to.not.include('device:');
        expect(mockFileLib.writeEnvFile.firstCall.args[1])
          .to.have.property('COUCHDB_DATA')
          .that.equals('');
        expect(mockDockerLib.copyFileToComposeContainer.calledOnceWithExactly(
          `${INSTANCE_NAME}-up`, 'cht-upgrade-service'
        )).to.be.true;
        expect(copyFileToComposeContainerInner.callCount).to.equal(4);
        expect(copyFileToComposeContainerInner.firstCall.args[0]).to.deep.equal(
          [`${dataDir}/compose/${coreComposeName}`, `/docker-compose/${coreComposeName}`]
        );
        expect(copyFileToComposeContainerInner.secondCall.args[0]).to.deep.equal(
          [`${dataDir}/compose/${couchComposeName}`, `/docker-compose/${couchComposeName}`]
        );
        expect(copyFileToComposeContainerInner.thirdCall.args[0]).to.deep.equal(
          [`${dataDir}/compose/chtx-override.yml`, `/docker-compose/chtx-override.yml`]
        );
        expect(copyFileToComposeContainerInner.lastCall.args[0]).to.deep.equal(
          [`${dataDir}/upgrade-service/.env`, `/docker-compose/.env`]
        );
        expect(mockDockerLib.rmComposeContainer.calledOnceWithExactly('cht-upgrade-service')).to.be.true;
        expect(rmComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      }));

      it('with the data mapped to the given local directory', run(function* () {
        yield* LocalInstanceService.create(INSTANCE_NAME, version, Option.some(dataDir));

        expect(mockFileLib.createTmpDir).to.not.have.been.called;
        pipe(
          [`${dataDir}/credentials`, `${dataDir}/ssl`, '${COUCHDB_DATA}', '${COUCHDB_DATA}/nouveau'],
          Array.forEach(dir => expect(writeFileInner.secondCall.args[0]).to.include(`device: ${dir}`))
        );
        expect(mockFileLib.writeEnvFile.firstCall.args[1])
          .to.have.property('COUCHDB_DATA')
          .that.equals(`${dataDir}/couchdb`);
        expect(mockDockerLib.copyFileToComposeContainer).to.not.be.called;
        expect(copyFileToComposeContainerInner).to.not.be.called;
        expect(mockDockerLib.rmComposeContainer).to.not.be.called;
        expect(rmComposeContainerInner).to.not.be.called;
      }));
    });

    it('returns error if given local directory is not empty', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(false));
      const httpsPort = 1234;
      const httpPort = 5678;
      getFreePorts.returns(Effect.succeed([httpsPort, httpPort]));
      mockFileLib.isDirectoryEmpty.returns(Effect.succeed(false));
      const dataDir = '/data/directory';

      const either = yield* LocalInstanceService
        .create(INSTANCE_NAME, version, Option.some(dataDir))
        .pipe(Effect.either);
      if (Either.isRight(either)) {
        expect.fail('Expected error');
      }

      expect(either.left).to.deep.include(new Error(`Local directory ${dataDir} is not empty.`));
      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(getFreePorts.calledOnceWithExactly()).to.be.true;
      expect(mockFileLib.createTmpDir).to.not.be.called;
      expect(mockFileLib.isDirectoryEmpty.calledOnceWithExactly(dataDir)).to.be.true;
      expect(mockFileLib.createDir.notCalled).to.be.true;
      expect(mockFileLib.writeFile.notCalled).to.be.true;
      expect(mockFileLib.writeEnvFile.notCalled).to.be.true;
      expect(mockDockerLib.pullComposeImages.notCalled).to.be.true;
      expect(mockDockerLib.createComposeContainers.notCalled).to.be.true;
      expect(mockDockerLib.copyFileToComposeContainer.notCalled).to.be.true;
      expect(mockFileSystem.readFileString.notCalled).to.be.true;
    }));

    it('returns error if chtx volume already exists with the same name', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));
      getFreePorts.returns(Effect.succeed([1234, 5678]));
      mockFileLib.createTmpDir.returns(Effect.succeed('/tmp/asdfasdfas'));

      const either = yield* LocalInstanceService
        .create(INSTANCE_NAME, version, Option.none())
        .pipe(Effect.either);

      if (Either.isRight(either)) {
        expect.fail('Expected error to be returned');
      }

      expect(either.left).to.deep.include(new Error(`Instance ${INSTANCE_NAME} already exists`));
      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(
        `chtx.instance=${INSTANCE_NAME}`
      )).to.be.true;
      expect(getFreePorts.notCalled).to.be.true;
      expect(mockFileLib.createTmpDir.calledOnceWithExactly()).to.be.true;
      expect(mockFileLib.getRemoteFile.notCalled).to.be.true;
      expect(mockFileLib.writeFile.notCalled).to.be.true;
      expect(writeFileInner.notCalled).to.be.true;
      expect(mockDockerLib.pullComposeImages.notCalled).to.be.true;
      expect(pullComposeImagesInner.notCalled).to.be.true;
      expect(mockDockerLib.createComposeContainers.notCalled).to.be.true;
      expect(createComposeContainersInner.notCalled).to.be.true;
      expect(copyFileToComposeContainerInner.notCalled).to.be.true;
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
      mockFileLib.isDirectoryEmpty.returns(Effect.succeed(true));
      mockFileLib.createDir.returns(Effect.void);
      mockFileLib.getRemoteFile
        .withArgs(CHT_UPGRADE_SERVICE_COMPOSE_URL)
        .returns(Effect.succeed('upgrade-service-compose-file'));
      mockFileLib.writeEnvFile.returns(Effect.void);
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
      expect(mockFileLib.writeFile.args).to.deep.equal([
        [`${tmpDir}/upgrade-service/docker-compose.yml`],
        [`${tmpDir}/upgrade-service/compose.override.yml`],
      ]);
      expect(writeFileInner).to.have.been.calledTwice;
      expect(writeFileInner.firstCall.args[0]).to.include('Override for upgrade service compose config');
      expect(writeFileInner.secondCall.args).to.deep.equal(['upgrade-service-compose-file']);
      expect(mockDockerLib.createComposeContainers.args).to.deep.equal([
        [{}, `${tmpDir}/upgrade-service/docker-compose.yml`, `${tmpDir}/upgrade-service/compose.override.yml`,],
        [{}, `${tmpDir}/upgrade-service/docker-compose.yml`, `${tmpDir}/upgrade-service/compose.override.yml`,],
      ]);
      expect(createComposeContainersInner.args).to.deep.equal([[`${INSTANCE_NAME}-up`], [`${INSTANCE_NAME}-up`]]);
      expect(mockDockerLib.copyFileFromComposeContainer.calledOnceWithExactly(
        'cht-upgrade-service', '/docker-compose/.env', `${tmpDir}/upgrade-service/.env`
      )).to.be.true;
      expect(copyFileFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockDockerLib.rmComposeContainer.calledOnceWithExactly('cht-upgrade-service')).to.be.true;
      expect(rmComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockDockerLib.restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockHttpClient.filterStatusOk.calledOnce).to.be.true;
      expect(mockHttpRequest.get.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
      expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
      const expectedDataDirs = pipe(
        Array.make('credentials', 'couchdb', 'couchdb/nouveau', 'compose', 'ssl', 'upgrade-service'),
        Array.map(dir => `${tmpDir}/${dir}`),
      );
      expect(mockFileLib.isDirectoryEmpty.calledOnceWithExactly(tmpDir)).to.be.true;
      expect(mockFileLib.createDir.args).to.deep.equal(Array.map(expectedDataDirs, Array.make));
      expect(mockFileLib.getRemoteFile).to.have.been.calledOnceWithExactly(CHT_UPGRADE_SERVICE_COMPOSE_URL);
      const env = {
        CHT_COMPOSE_PATH: 'chtx-compose-files',
        CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
        DOCKER_CONFIG_PATH: 'chtx-compose-files',
      };
      expect(mockFileLib.writeEnvFile).to.have.been.calledOnceWithExactly(`${tmpDir}/upgrade-service/.env`, env);
    }));

    it('returns error when no volume exists for project name', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(false));

      const either = yield* LocalInstanceService
        .start(INSTANCE_NAME, Option.none())
        .pipe(Effect.either);

      if (Either.isRight(either)) {
        expect.fail('Expected error');
      }

      expect(either.left).to.deep.include(new Error(`Instance ${INSTANCE_NAME} does not exist`));
      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(
        `chtx.instance=${INSTANCE_NAME}`
      )).to.be.true;
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
    }));

    it('handles problems removing the temp upgrade service container', run(function* () {
      mockFileLib.isDirectoryEmpty.returns(Effect.succeed(true));
      mockFileLib.createDir.returns(Effect.void);
      mockFileLib.getRemoteFile
        .withArgs(CHT_UPGRADE_SERVICE_COMPOSE_URL)
        .returns(Effect.succeed('upgrade-service-compose-file'));
      mockFileLib.writeEnvFile.returns(Effect.void);
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));
      mockDockerLib.getContainersForComposeProject
        .withArgs(`${INSTANCE_NAME}-up`)
        .returns(Effect.succeed([]));
      const tmpDir = '/tmp/asdfasdfas';
      mockFileLib.createTmpDir.returns(Effect.succeed(tmpDir));
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
      expect(mockFileLib.writeFile.args).to.deep.equal([
        [`${tmpDir}/upgrade-service/docker-compose.yml`],
        [`${tmpDir}/upgrade-service/compose.override.yml`],
      ]);
      expect(writeFileInner).to.have.been.calledTwice;
      expect(writeFileInner.firstCall.args[0]).to.include('Override for upgrade service compose config');
      expect(writeFileInner.secondCall.args).to.deep.equal(['upgrade-service-compose-file']);
      expect(mockDockerLib.createComposeContainers.args).to.deep.equal([
        [{}, `${tmpDir}/upgrade-service/docker-compose.yml`, `${tmpDir}/upgrade-service/compose.override.yml`,],
        [{}, `${tmpDir}/upgrade-service/docker-compose.yml`, `${tmpDir}/upgrade-service/compose.override.yml`,],
      ]);
      expect(createComposeContainersInner.args).to.deep.equal([[`${INSTANCE_NAME}-up`], [`${INSTANCE_NAME}-up`]]);
      expect(mockDockerLib.copyFileFromComposeContainer.calledOnceWithExactly(
        'cht-upgrade-service', '/docker-compose/.env', `${tmpDir}/upgrade-service/.env`
      )).to.be.true;
      expect(copyFileFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockDockerLib.rmComposeContainer.calledOnceWithExactly('cht-upgrade-service')).to.be.true;
      expect(rmComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockDockerLib.restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockHttpClient.filterStatusOk.calledOnce).to.be.true;
      expect(mockHttpRequest.get.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
      expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
      const expectedDataDirs = pipe(
        Array.make('credentials', 'couchdb', 'couchdb/nouveau', 'compose', 'ssl', 'upgrade-service'),
        Array.map(dir => `${tmpDir}/${dir}`),
      );
      expect(mockFileLib.isDirectoryEmpty.calledOnceWithExactly(tmpDir)).to.be.true;
      expect(mockFileLib.createDir.args).to.deep.equal(Array.map(expectedDataDirs, Array.make));
      expect(mockFileLib.getRemoteFile).to.have.been.calledOnceWithExactly(CHT_UPGRADE_SERVICE_COMPOSE_URL);
      const env = {
        CHT_COMPOSE_PATH: 'chtx-compose-files',
        CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
        DOCKER_CONFIG_PATH: 'chtx-compose-files',
      };
      expect(mockFileLib.writeEnvFile).to.have.been.calledOnceWithExactly(`${tmpDir}/upgrade-service/.env`, env);
    }));

    it('creates and starts CHT instance from local directory', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(false));
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
      expect(mockDockerLib.createComposeContainers).to.have.been.calledOnceWithExactly(
        {},
        `${dirPath}/upgrade-service/docker-compose.yml`,
        `${dirPath}/upgrade-service/compose.override.yml`,
      );
      expect(createComposeContainersInner).to.have.been.calledOnceWithExactly(`${INSTANCE_NAME}-up`);
      expect(mockDockerLib.copyFileFromComposeContainer.notCalled).to.be.true;
      expect(mockDockerLib.rmComposeContainer.notCalled).to.be.true;
      expect(mockDockerLib.restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(mockHttpClient.filterStatusOk.calledOnce).to.be.true;
      expect(mockHttpRequest.get.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
      expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
    }));

    it('returns error when starting CHT instance from local directory when docker volume exists', run(function* () {
      mockDockerLib.doesVolumeExistWithLabel.returns(Effect.succeed(true));
      httpClientExecute.returns(Effect.void);
      const dirPath = '/data/directory';

      const either = yield* LocalInstanceService
        .start(INSTANCE_NAME, Option.some(dirPath))
        .pipe(Effect.either);

      if (Either.isRight(either)) {
        expect.fail('Expected error');
      }

      expect(either.left).to.deep.include(new Error(`Instance ${INSTANCE_NAME} already exists`));
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

      if (Either.isRight(either)) {
        expect.fail('Expected error');
      }

      expect(either.left).to.deep.include(new Error(`Instance ${INSTANCE_NAME} does not exist`));
      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(
        `chtx.instance=${INSTANCE_NAME}`
      )).to.be.true;
      expect(mockDockerLib.stopCompose.args).to.deep.equal([[INSTANCE_NAME], [`${INSTANCE_NAME}-up`]]);
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

    ([
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
    ] as const).forEach(([sslType, chainURL, keyURL]) => {
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

        expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(
          `chtx.instance=${INSTANCE_NAME}`
        )).to.be.true;
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
        expect(copyFileToComposeContainerInner).to.have.been.calledTwice;
        expect(copyFileToComposeContainerInner.firstCall.args[0]).to.deep.equal(
          [`${tmpDir}/cert.pem`, '/etc/nginx/private/cert.pem']
        );
        expect(copyFileToComposeContainerInner.secondCall.args[0]).to.deep.equal(
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

      if (Either.isRight(either)) {
        expect.fail('Expected error');
      }
      expect(either.left).to.deep.include(new Error(`Could not get port for instance ${INSTANCE_NAME}`));
      expect(mockDockerLib.doesVolumeExistWithLabel.calledOnceWithExactly(
        `chtx.instance=${INSTANCE_NAME}`
      )).to.be.true;
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
      mockDockerLib.getContainersForComposeProject.returns(Effect.succeed([]));

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
