import { describe, it } from 'mocha';
import { Array, Effect, Either, Layer, Schedule, Option, pipe } from 'effect';
import sinon, { SinonStub } from 'sinon';
import { expect } from 'chai';
import * as Docker from '../../src/libs/docker.js';
import * as LocalNetwork from '../../src/libs/local-network.js';
import * as File from '../../src/libs/file.js';
import { genWithLayer, sandbox } from '../utils/base.js';
import { LocalInstanceService, SSLType } from '../../src/services/local-instance.js';
import { NodeContext } from '@effect/platform-node';
import { HttpClient, HttpClientRequest } from '@effect/platform';

const INSTANCE_NAME = 'myinstance';
const HTTP_CLIENT_REQUEST = { hello: 'world' } as unknown as HttpClientRequest.HttpClientRequest;
const PORT = '1234';

const chtComposeUrl = (
  version: string,
  fileName: string
) => `https://staging.dev.medicmobile.org/_couch/builds_4/medic%3Amedic%3A${version}/docker-compose/${fileName}`;

const httpClientExecute = sandbox.stub();

const run = LocalInstanceService.Default.pipe(
  Layer.provide(NodeContext.layer),
  Layer.provide(Layer.succeed(HttpClient.HttpClient, {
    execute: httpClientExecute,
  } as unknown as HttpClient.HttpClient)),
  genWithLayer,
);

describe('Local Instance Service', () => {
  let doesVolumeExistWithLabel: SinonStub;
  let createTmpDir: SinonStub;
  let writeFileInner: SinonStub;
  let writeFileOuter: SinonStub;
  let createComposeContainersInner: SinonStub;
  let createComposeContainersOuter: SinonStub;
  let doesComposeProjectHaveContainers: SinonStub;
  let getEnvarFromComposeContainerInner: SinonStub;
  let getEnvarFromComposeContainerOuter: SinonStub;
  let filterStatusOk: SinonStub;
  let httpClientRequestGet: SinonStub;
  let getRemoteFile: SinonStub;
  let copyFileToComposeContainerInner: SinonStub;
  let copyFileToComposeContainerOuter: SinonStub;

  beforeEach(() => {
    doesVolumeExistWithLabel = sinon.stub(Docker, 'doesVolumeExistWithLabel');
    createTmpDir = sinon.stub(File, 'createTmpDir');
    writeFileInner = sinon
      .stub()
      .returns(Effect.void);
    writeFileOuter = sinon
      .stub(File, 'writeFile')
      .returns(writeFileInner);
    createComposeContainersInner = sinon
      .stub()
      .returns(Effect.void);
    createComposeContainersOuter = sinon
      .stub(Docker, 'createComposeContainers')
      .returns(createComposeContainersInner);
    doesComposeProjectHaveContainers = sinon.stub(Docker, 'doesComposeProjectHaveContainers');
    getEnvarFromComposeContainerInner = sinon.stub();
    getEnvarFromComposeContainerOuter = sinon
      .stub(Docker, 'getEnvarFromComposeContainer')
      .returns(getEnvarFromComposeContainerInner);
    filterStatusOk = sinon
      .stub(HttpClient, 'filterStatusOk')
      .returnsArg(0);
    httpClientRequestGet = sinon
      .stub(HttpClientRequest, 'get')
      .returns(HTTP_CLIENT_REQUEST);
    getRemoteFile = sinon.stub(File, 'getRemoteFile');
    copyFileToComposeContainerInner = sinon
      .stub()
      .returns(Effect.void);
    copyFileToComposeContainerOuter = sinon
      .stub(Docker, 'copyFileToComposeContainer')
      .returns(copyFileToComposeContainerInner);
  });

  describe('create', () => {
    let getFreePorts: SinonStub;
    let writeJsonFile: SinonStub;
    let pullComposeImagesInner: SinonStub;
    let pullComposeImagesOuter: SinonStub;

    beforeEach(() => {
      getFreePorts = sinon.stub(LocalNetwork, 'getFreePorts');
      writeJsonFile = sinon
        .stub(File, 'writeJsonFile')
        .returns(Effect.void);
      pullComposeImagesInner = sinon
        .stub()
        .returns(Effect.void);
      pullComposeImagesOuter = sinon
        .stub(Docker, 'pullComposeImages')
        .returns(pullComposeImagesInner);
    });

    it('creates a new instance with the given name and version', run(function* () {
      const version = '3.7.0';
      doesVolumeExistWithLabel.returns(Effect.succeed(false));
      const httpsPort = 1234;
      const httpPort = 5678;
      getFreePorts.returns(Effect.succeed([httpsPort, httpPort]));
      const tmpDir = '/tmp/asdfasdfas';
      createTmpDir.returns(Effect.succeed(tmpDir));
      const coreComposeName = 'cht-core.yml';
      const couchComposeName = 'cht-couchdb.yml';
      const coreComposeURL = chtComposeUrl(version, coreComposeName);
      const couchComposeURL = chtComposeUrl(version, couchComposeName);
      getRemoteFile.withArgs(coreComposeURL).returns(Effect.succeed('core-compose-file'));
      getRemoteFile.withArgs(couchComposeURL).returns(Effect.succeed('couch-compose-file'));

      yield* LocalInstanceService.create(INSTANCE_NAME, version);

      expect(doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(getFreePorts.calledOnceWithExactly()).to.be.true;
      expect(createTmpDir.calledOnceWithExactly()).to.be.true;
      expect(getRemoteFile.args).to.deep.equal([[coreComposeURL], [couchComposeURL]]);
      expect(writeFileOuter.args).to.deep.equal([
        [`${tmpDir}/docker-compose.yml`],
        [`${tmpDir}/${coreComposeName}`],
        [`${tmpDir}/${couchComposeName}`],
      ]);
      expect(writeFileInner.calledThrice).to.be.true;
      expect(writeFileInner.args[0][0]).to.include('image: public.ecr.aws/s5s3h4s7/cht-upgrade-service:latest');
      expect(writeFileInner.args[1]).to.deep.equal(['core-compose-file']);
      expect(writeFileInner.args[2]).to.deep.equal(['couch-compose-file']);
      const expectedEnv = {
        CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
        CHT_NETWORK: INSTANCE_NAME,
        COUCHDB_DATA: 'cht-credentials',
        COUCHDB_PASSWORD: 'password',
        COUCHDB_USER: 'medic',
        NGINX_HTTP_PORT: httpPort,
        NGINX_HTTPS_PORT: httpsPort,
      };
      expect(writeJsonFile.calledOnce).to.be.true;
      expect(writeJsonFile.args[0][0]).to.equal(`${tmpDir}/env.json`);
      const actualEnv = writeJsonFile.args[0][1] as Record<string, string>;
      expect(actualEnv).to.deep.include(expectedEnv);
      expect(actualEnv).to.have.property('COUCHDB_SECRET').that.is.a('string').that.has.length(32);
      expect(pullComposeImagesOuter.calledOnceWithExactly(INSTANCE_NAME, actualEnv)).to.be.true;
      expect(pullComposeImagesInner.calledOnceWithExactly([
        `${tmpDir}/${coreComposeName}`,
        `${tmpDir}/${couchComposeName}`,
        `${tmpDir}/docker-compose.yml`,
      ])).to.be.true;
      expect(createComposeContainersOuter.calledOnceWithExactly(
        actualEnv, `${tmpDir}/docker-compose.yml`
      )).to.be.true;
      expect(createComposeContainersInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(copyFileToComposeContainerOuter.calledOnceWithExactly(
        `${INSTANCE_NAME}-up`, 'cht-upgrade-service'
      )).to.be.true;
      expect(copyFileToComposeContainerInner.calledThrice).to.be.true;
      expect(copyFileToComposeContainerInner.args[0][0]).to.deep.equal(
        [`${tmpDir}/${coreComposeName}`, `/docker-compose/${coreComposeName}`]
      );
      expect(copyFileToComposeContainerInner.args[1][0]).to.deep.equal(
        [`${tmpDir}/${couchComposeName}`, `/docker-compose/${couchComposeName}`]
      );
      expect(copyFileToComposeContainerInner.args[2][0]).to.deep.equal(
        [`${tmpDir}/env.json`, `/docker-compose/env.json`]
      );
    }));

    it('returns error if chtx volume already exists with the same name', run(function* () {
      const version = '3.7.0';
      doesVolumeExistWithLabel.returns(Effect.succeed(true));
      getFreePorts.returns(Effect.succeed([1234, 5678]));
      createTmpDir.returns(Effect.succeed('/tmp/asdfasdfas'));

      const either = yield* LocalInstanceService
        .create(INSTANCE_NAME, version)
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal(new Error(`Instance ${INSTANCE_NAME} already exists`));
        expect(doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
        expect(getFreePorts.calledOnceWithExactly()).to.be.true;
        expect(createTmpDir.calledOnceWithExactly()).to.be.true;
        expect(getRemoteFile.notCalled).to.be.true;
        expect(writeFileOuter.notCalled).to.be.true;
        expect(writeFileInner.notCalled).to.be.true;
        expect(writeJsonFile.notCalled).to.be.true;
        expect(pullComposeImagesOuter.notCalled).to.be.true;
        expect(pullComposeImagesInner.notCalled).to.be.true;
        expect(createComposeContainersOuter.notCalled).to.be.true;
        expect(createComposeContainersInner.notCalled).to.be.true;
        expect(copyFileToComposeContainerInner.notCalled).to.be.true;
      } else {
        expect.fail('Expected error to be returned');
      }
    }));
  });

  describe('start', () => {
    let restartCompose: SinonStub;
    let copyFileFromComposeContainerInner: SinonStub;
    let copyFileFromComposeContainerOuter: SinonStub;
    let rmComposeContainerInner: SinonStub;
    let rmComposeContainerOuter: SinonStub;
    let readJsonFile: SinonStub;

    beforeEach(() => {
      restartCompose = sinon
        .stub(Docker, 'restartCompose')
        .returns(Effect.void);
      copyFileFromComposeContainerInner = sinon
        .stub()
        .returns(Effect.void);
      copyFileFromComposeContainerOuter = sinon
        .stub(Docker, 'copyFileFromComposeContainer')
        .returns(copyFileFromComposeContainerInner);
      rmComposeContainerInner = sinon
        .stub()
        .returns(Effect.void);
      rmComposeContainerOuter = sinon
        .stub(Docker, 'rmComposeContainer')
        .returns(rmComposeContainerInner);
      readJsonFile = sinon.stub(File, 'readJsonFile');
    });

    it('starts existing CHT instance', run(function* () {
      doesVolumeExistWithLabel.returns(Effect.succeed(true));
      doesComposeProjectHaveContainers.returns(Effect.succeed(true));
      getEnvarFromComposeContainerInner.returns(Effect.succeed(PORT));
      httpClientExecute.returns(Effect.void);

      yield* LocalInstanceService.start(INSTANCE_NAME);

      expect(doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(doesComposeProjectHaveContainers.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(writeFileOuter.notCalled).to.be.true;
      expect(writeFileInner.notCalled).to.be.true;
      expect(createComposeContainersOuter.notCalled).to.be.true;
      expect(createComposeContainersInner.notCalled).to.be.true;
      expect(copyFileFromComposeContainerOuter.notCalled).to.be.true;
      expect(copyFileFromComposeContainerInner.notCalled).to.be.true;
      expect(rmComposeContainerOuter.notCalled).to.be.true;
      expect(rmComposeContainerInner.notCalled).to.be.true;
      expect(restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(getEnvarFromComposeContainerOuter.calledOnceWithExactly(
        'cht-upgrade-service', 'NGINX_HTTPS_PORT'
      )).to.be.true;
      expect(getEnvarFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(filterStatusOk.calledOnce).to.be.true;
      expect(httpClientRequestGet.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
      expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
    }));

    it('waits for instance to be up and responsive', run(function* () {
      doesVolumeExistWithLabel.returns(Effect.succeed(true));
      doesComposeProjectHaveContainers.returns(Effect.succeed(true));
      getEnvarFromComposeContainerInner.returns(Effect.succeed(PORT));
      httpClientExecute.onFirstCall().returns(Effect.fail('Service not ready'));
      httpClientExecute.onSecondCall().returns(Effect.void);
      const scheduleSpaced = sinon
        .stub(Schedule, 'spaced')
        .returns(Schedule.forever); // Avoid waiting in tests

      yield* LocalInstanceService.start(INSTANCE_NAME);

      expect(doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(doesComposeProjectHaveContainers.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(writeFileOuter.notCalled).to.be.true;
      expect(writeFileInner.notCalled).to.be.true;
      expect(createComposeContainersOuter.notCalled).to.be.true;
      expect(createComposeContainersInner.notCalled).to.be.true;
      expect(copyFileFromComposeContainerOuter.notCalled).to.be.true;
      expect(copyFileFromComposeContainerInner.notCalled).to.be.true;
      expect(rmComposeContainerOuter.notCalled).to.be.true;
      expect(rmComposeContainerInner.notCalled).to.be.true;
      expect(restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(getEnvarFromComposeContainerOuter.calledOnceWithExactly(
        'cht-upgrade-service', 'NGINX_HTTPS_PORT'
      )).to.be.true;
      expect(getEnvarFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(filterStatusOk.calledTwice).to.be.true;
      expect(httpClientRequestGet.args).to.deep.equal(
        [[`https://localhost:${PORT}/api/info`], [`https://localhost:${PORT}/api/info`]]
      );
      expect(httpClientExecute.args).to.deep.equal([[HTTP_CLIENT_REQUEST], [HTTP_CLIENT_REQUEST]]);
      expect(scheduleSpaced.calledOnceWithExactly(1000)).to.be.true;
    }));

    it('creates and starts CHT instance from existing volume', run(function* () {
      doesVolumeExistWithLabel.returns(Effect.succeed(true));
      doesComposeProjectHaveContainers.returns(Effect.succeed(false));
      const tmpDir = '/tmp/asdfasdfas';
      createTmpDir.returns(Effect.succeed(tmpDir));
      const env = {
        CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
        CHT_NETWORK: INSTANCE_NAME,
        COUCHDB_DATA: 'cht-credentials',
        COUCHDB_PASSWORD: 'password',
        COUCHDB_SECRET: 'secret',
        COUCHDB_USER: 'medic',
        NGINX_HTTP_PORT: 1111,
        NGINX_HTTPS_PORT: Number(PORT),
      };
      readJsonFile.returns(Effect.succeed(env));
      getEnvarFromComposeContainerInner.returns(Effect.succeed(PORT));
      httpClientExecute.returns(Effect.void);

      yield* LocalInstanceService.start(INSTANCE_NAME);

      expect(doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(doesComposeProjectHaveContainers.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(writeFileOuter.calledOnceWithExactly(`${tmpDir}/docker-compose.yml`)).to.be.true;
      expect(writeFileInner.calledOnce).to.be.true;
      expect(writeFileInner.args[0][0]).to.include('image: public.ecr.aws/s5s3h4s7/cht-upgrade-service:latest');
      expect(createComposeContainersOuter.args).to.deep.equal([
        [{}, `${tmpDir}/docker-compose.yml`],
        [env, `${tmpDir}/docker-compose.yml`]
      ]);
      expect(createComposeContainersInner.args).to.deep.equal([[`${INSTANCE_NAME}-up`], [`${INSTANCE_NAME}-up`]]);
      expect(copyFileFromComposeContainerOuter.calledOnceWithExactly(
        'cht-upgrade-service', '/docker-compose/env.json', `${tmpDir}/env.json`
      )).to.be.true;
      expect(copyFileFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(rmComposeContainerOuter.calledOnceWithExactly('cht-upgrade-service')).to.be.true;
      expect(rmComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(getEnvarFromComposeContainerOuter.calledOnceWithExactly(
        'cht-upgrade-service', 'NGINX_HTTPS_PORT'
      )).to.be.true;
      expect(getEnvarFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(filterStatusOk.calledOnce).to.be.true;
      expect(httpClientRequestGet.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
      expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
    }));

    it('returns error when no volume exists for project name', run(function* () {
      doesVolumeExistWithLabel.returns(Effect.succeed(false));
      doesComposeProjectHaveContainers.returns(Effect.succeed(true));
      getEnvarFromComposeContainerInner.returns(Effect.succeed(PORT));

      const either = yield* LocalInstanceService
        .start(INSTANCE_NAME)
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal(new Error(`Instance ${INSTANCE_NAME} does not exist`));
        expect(doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
        expect(doesComposeProjectHaveContainers.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(writeFileOuter.notCalled).to.be.true;
        expect(writeFileInner.notCalled).to.be.true;
        expect(createComposeContainersOuter.notCalled).to.be.true;
        expect(createComposeContainersInner.notCalled).to.be.true;
        expect(copyFileFromComposeContainerOuter.notCalled).to.be.true;
        expect(copyFileFromComposeContainerInner.notCalled).to.be.true;
        expect(rmComposeContainerOuter.notCalled).to.be.true;
        expect(rmComposeContainerInner.notCalled).to.be.true;
        expect(restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(getEnvarFromComposeContainerOuter.calledOnceWithExactly(
          'cht-upgrade-service', 'NGINX_HTTPS_PORT'
        )).to.be.true;
        expect(getEnvarFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(filterStatusOk.notCalled).to.be.true;
        expect(httpClientRequestGet.notCalled).to.be.true;
        expect(httpClientExecute.notCalled).to.be.true;
      } else {
        expect.fail('Expected error');
      }
    }));

    it('handles problems removing the temp upgrade service container', run(function* () {
      doesVolumeExistWithLabel.returns(Effect.succeed(true));
      doesComposeProjectHaveContainers.returns(Effect.succeed(false));
      const tmpDir = '/tmp/asdfasdfas';
      createTmpDir.returns(Effect.succeed(tmpDir));
      const env = {
        CHT_COMPOSE_PROJECT_NAME: INSTANCE_NAME,
        CHT_NETWORK: INSTANCE_NAME,
        COUCHDB_DATA: 'cht-credentials',
        COUCHDB_PASSWORD: 'password',
        COUCHDB_SECRET: 'secret',
        COUCHDB_USER: 'medic',
        NGINX_HTTP_PORT: 1111,
        NGINX_HTTPS_PORT: Number(PORT),
      };
      readJsonFile.returns(Effect.succeed(env));
      getEnvarFromComposeContainerInner.returns(Effect.succeed(PORT));
      httpClientExecute.returns(Effect.void);
      rmComposeContainerInner.returns(Effect.fail('Failed to remove container'));

      yield* LocalInstanceService.start(INSTANCE_NAME);

      expect(doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(doesComposeProjectHaveContainers.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(writeFileOuter.calledOnceWithExactly(`${tmpDir}/docker-compose.yml`)).to.be.true;
      expect(writeFileInner.calledOnce).to.be.true;
      expect(writeFileInner.args[0][0]).to.include('image: public.ecr.aws/s5s3h4s7/cht-upgrade-service:latest');
      expect(createComposeContainersOuter.args).to.deep.equal([
        [{}, `${tmpDir}/docker-compose.yml`],
        [env, `${tmpDir}/docker-compose.yml`]
      ]);
      expect(createComposeContainersInner.args).to.deep.equal([[`${INSTANCE_NAME}-up`], [`${INSTANCE_NAME}-up`]]);
      expect(copyFileFromComposeContainerOuter.calledOnceWithExactly(
        'cht-upgrade-service', '/docker-compose/env.json', `${tmpDir}/env.json`
      )).to.be.true;
      expect(copyFileFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(rmComposeContainerOuter.calledOnceWithExactly('cht-upgrade-service')).to.be.true;
      expect(rmComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(restartCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(getEnvarFromComposeContainerOuter.calledOnceWithExactly(
        'cht-upgrade-service', 'NGINX_HTTPS_PORT'
      )).to.be.true;
      expect(getEnvarFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
      expect(filterStatusOk.calledOnce).to.be.true;
      expect(httpClientRequestGet.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
      expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
    }));
  });

  describe('stop', () => {
    let stopCompose: SinonStub;

    beforeEach(() => {
      stopCompose = sinon
        .stub(Docker, 'stopCompose')
        .returns(Effect.void);
    });

    it('stops containers for project', run(function* () {
      doesVolumeExistWithLabel.returns(Effect.succeed(true));

      yield* LocalInstanceService.stop(INSTANCE_NAME);

      expect(doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
      expect(stopCompose.args).to.deep.equal([[INSTANCE_NAME], [`${INSTANCE_NAME}-up`]]);
    }));

    it('returns error when volume does not exist for project', run(function* () {
      doesVolumeExistWithLabel.returns(Effect.succeed(false));

      const either = yield* LocalInstanceService
        .stop(INSTANCE_NAME)
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal(new Error(`Instance ${INSTANCE_NAME} does not exist`));
        expect(doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
        expect(stopCompose.args).to.deep.equal([[INSTANCE_NAME], [`${INSTANCE_NAME}-up`]]);
      } else {
        expect.fail('Expected error');
      }
    }));
  });

  describe('rm', () => {
    let destroyCompose: SinonStub;

    beforeEach(() => {
      destroyCompose = sinon
        .stub(Docker, 'destroyCompose')
        .returns(Effect.void);
    });

    it('removes containers for project', run(function* () {
      yield* LocalInstanceService.rm(INSTANCE_NAME);
      expect(destroyCompose.args).to.deep.equal([[INSTANCE_NAME], [`${INSTANCE_NAME}-up`]]);
    }));

    it('returns error when failing to remove containers', run(function* () {
      destroyCompose.returns(Effect.fail('Failed to remove containers'));

      const either = yield* LocalInstanceService
        .rm(INSTANCE_NAME)
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal('Failed to remove containers');
        expect(destroyCompose.args).to.deep.equal([[INSTANCE_NAME], [`${INSTANCE_NAME}-up`]]);
      } else {
        expect.fail('Expected error');
      }
    }));
  });

  describe('setSSLCerts', () => {
    const sslType = 'local-ip';
    const expectedFullChain = 'fullchain';
    const expectedKey = 'key';

    let startCompose: SinonStub;
    let restartComposeService: SinonStub;

    beforeEach(() => {
      startCompose = sinon
        .stub(Docker, 'startCompose')
        .returns(Effect.void);
      restartComposeService = sinon
        .stub(Docker, 'restartComposeService')
        .returns(Effect.void);
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
        doesVolumeExistWithLabel.returns(Effect.succeed(true));
        doesComposeProjectHaveContainers.returns(Effect.succeed(true));
        getEnvarFromComposeContainerInner.returns(Effect.succeed(PORT));
        httpClientExecute.returns(Effect.void);
        const tmpDir = '/tmp/asdfasdfas';
        createTmpDir.returns(Effect.succeed(tmpDir));
        getRemoteFile.withArgs(chainURL).returns(Effect.succeed(expectedFullChain));
        getRemoteFile.withArgs(keyURL).returns(Effect.succeed(expectedKey));

        yield* LocalInstanceService.setSSLCerts(INSTANCE_NAME, sslType as SSLType);

        expect(doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
        expect(doesComposeProjectHaveContainers.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(startCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(getEnvarFromComposeContainerOuter.calledOnceWithExactly(
          'cht-upgrade-service', 'NGINX_HTTPS_PORT'
        )).to.be.true;
        expect(getEnvarFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(filterStatusOk.calledOnce).to.be.true;
        expect(httpClientRequestGet.calledOnceWithExactly(`https://localhost:${PORT}/api/info`)).to.be.true;
        expect(httpClientExecute.calledOnceWithExactly(HTTP_CLIENT_REQUEST)).to.be.true;
        expect(createTmpDir.calledOnceWithExactly()).to.be.true;
        expect(getRemoteFile.args).to.deep.equal([[chainURL], [keyURL]]);
        expect(writeFileOuter.args).to.deep.equal([[`${tmpDir}/cert.pem`], [`${tmpDir}/key.pem`]]);
        expect(writeFileInner.args).to.deep.equal([[expectedFullChain], [expectedKey]]);
        expect(copyFileToComposeContainerOuter.calledOnceWithExactly(INSTANCE_NAME, 'nginx')).to.be.true;
        expect(copyFileToComposeContainerInner.calledTwice).to.be.true;
        expect(copyFileToComposeContainerInner.args[0][0]).to.deep.equal(
          [`${tmpDir}/cert.pem`, '/etc/nginx/private/cert.pem']
        );
        expect(copyFileToComposeContainerInner.args[1][0]).to.deep.equal(
          [`${tmpDir}/key.pem`, '/etc/nginx/private/key.pem']
        );
        expect(restartComposeService.calledOnceWithExactly(INSTANCE_NAME, 'nginx')).to.be.true;
      }));
    });

    it('returns error if invalid port value found for project', run(function* () {
      doesVolumeExistWithLabel.returns(Effect.succeed(true));
      doesComposeProjectHaveContainers.returns(Effect.succeed(true));
      getEnvarFromComposeContainerInner.returns(Effect.succeed('invalid_port'));
      const tmpDir = '/tmp/asdfasdfas';
      createTmpDir.returns(Effect.succeed(tmpDir));

      const either = yield* LocalInstanceService
        .setSSLCerts(INSTANCE_NAME, sslType)
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal(new Error(`Could not get port for instance ${INSTANCE_NAME}`));
        expect(doesVolumeExistWithLabel.calledOnceWithExactly(`chtx.instance=${INSTANCE_NAME}`)).to.be.true;
        expect(doesComposeProjectHaveContainers.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(startCompose.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(getEnvarFromComposeContainerOuter.calledOnceWithExactly(
          'cht-upgrade-service', 'NGINX_HTTPS_PORT'
        )).to.be.true;
        expect(getEnvarFromComposeContainerInner.calledOnceWithExactly(`${INSTANCE_NAME}-up`)).to.be.true;
        expect(filterStatusOk.notCalled).to.be.true;
        expect(httpClientRequestGet.notCalled).to.be.true;
        expect(httpClientExecute.notCalled).to.be.true;
        expect(createTmpDir.calledOnceWithExactly()).to.be.true;
        expect(getRemoteFile.notCalled).to.be.true;
        expect(writeFileOuter.notCalled).to.be.true;
        expect(writeFileInner.notCalled).to.be.true;
        expect(copyFileToComposeContainerOuter.notCalled).to.be.true;
        expect(copyFileToComposeContainerInner.notCalled).to.be.true;
        expect(restartComposeService.calledOnceWithExactly(INSTANCE_NAME, 'nginx')).to.be.true;
      } else {
        expect.fail('Expected error');
      }
    }));
  });

  describe('ls', () => {
    let getVolumeNamesWithLabel: SinonStub;
    let getVolumeLabelValueInner: SinonStub;
    let getVolumeLabelValueOuter: SinonStub;

    beforeEach(() => {
      getVolumeNamesWithLabel = sinon.stub(Docker, 'getVolumeNamesWithLabel');
      getVolumeLabelValueInner = sinon.stub();
      getVolumeLabelValueOuter = sinon
        .stub(Docker, 'getVolumeLabelValue')
        .returns(getVolumeLabelValueInner);
    });

    it('returns the project info for the current local instances', run(function* () {
      const volumeNames = ['chtx-instance-1', 'chtx-instance-2', 'chtx-instance-3'];
      const projectNames = ['myfirstinstance', 'mysecondinstance', 'mythirdinstance'];
      const ports = ['1111', '2222', '3333'];
      getVolumeNamesWithLabel.returns(Effect.succeed(volumeNames));
      projectNames.forEach((name, i) => getVolumeLabelValueInner.onCall(i).returns(Effect.succeed(name)));
      ports.forEach((port, i) => getEnvarFromComposeContainerInner.onCall(i).returns(Effect.succeed(port)));

      const results = yield* LocalInstanceService.ls();

      const expectedResults = pipe(
        Array.map(ports, Option.some),
        Array.zipWith(projectNames, (port, name) => ({ name, port })),
      );
      expect(results).to.deep.equal(expectedResults);
      expect(getVolumeNamesWithLabel.calledOnceWithExactly('chtx.instance')).to.be.true;
      expect(getVolumeLabelValueOuter.calledOnceWithExactly('chtx.instance')).to.be.true;
      expect(getVolumeLabelValueInner.args).to.deep.equal(Array.map(volumeNames, Array.make));
      const expectedGetEnvarParams = pipe(
        Array.map(projectNames, name => `${name}-up`),
        Array.map(names => [names]),
      );
      expect(getEnvarFromComposeContainerInner.args).to.deep.equal(expectedGetEnvarParams);
    }));

    it('does not include port when it cannot be found', run(function* () {
      const volumeName = 'chtx-instance-1';
      const projectName = 'myfirstinstance';
      getVolumeNamesWithLabel.returns(Effect.succeed([volumeName]));
      getVolumeLabelValueInner.returns(Effect.succeed(projectName));
      getEnvarFromComposeContainerInner.returns(Effect.succeed('invalid port'));

      const results = yield* LocalInstanceService.ls();

      const expectedResults = [{ name: projectName, port: Option.none() }];
      expect(results).to.deep.equal(expectedResults);
      expect(getVolumeNamesWithLabel.calledOnceWithExactly('chtx.instance')).to.be.true;
      expect(getVolumeLabelValueOuter.calledOnceWithExactly('chtx.instance')).to.be.true;
      expect(getVolumeLabelValueInner.args).to.deep.equal(Array.map([volumeName], Array.make));
      expect(getEnvarFromComposeContainerInner.calledOnceWithExactly(`${projectName}-up`)).to.be.true;
    }));

    it('returns error when there is a problem getting volume names', run(function* () {
      const message = 'Docker not installed';
      getVolumeNamesWithLabel.returns(Effect.fail(message));

      const either = yield* LocalInstanceService
        .ls()
        .pipe(Effect.either);

      if (Either.isLeft(either)) {
        expect(either.left).to.deep.equal(message);
        expect(getVolumeNamesWithLabel.calledOnceWithExactly('chtx.instance')).to.be.true;
        expect(getVolumeLabelValueOuter.calledOnceWithExactly('chtx.instance')).to.be.true;
        expect(getVolumeLabelValueInner.notCalled).to.be.true;
      } else {
        expect.fail('Expected error to be returned');
      }
    }));
  });
});
