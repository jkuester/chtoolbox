import { describe, it } from 'mocha';
import { Array, Effect, Either, Layer, Option } from 'effect';
import sinon from 'sinon';
import { expect } from 'chai';
import { genWithLayer, sandbox } from '../utils/base.ts';
import * as LocalIpSvc from '../../src/services/local-ip.ts';
import { NodeContext } from '@effect/platform-node';
import esmock from 'esmock';

const mockDockerLib = {
  pullImage: sandbox.stub(),
  doesContainerExist: sandbox.stub(),
  getContainerLabelValue: sandbox.stub(),
  getContainerNamesWithLabel: sandbox.stub(),
  rmContainer: sandbox.stub(),
  runContainer: sandbox.stub(),
};
const mockNetworkLib = {
  getFreePort: sandbox.stub(),
  getLANIPAddress: sandbox.stub(),
};

const { LocalIpService } = await esmock<typeof LocalIpSvc>('../../src/services/local-ip.ts', {
  '../../src/libs/docker.ts': mockDockerLib,
  '../../src/libs/local-network.ts': mockNetworkLib,
});
const run = LocalIpService.Default.pipe(
  Layer.provide(NodeContext.layer),
  genWithLayer,
);

const TO_PORT = 8080;
const FROM_PORT = 3000;
const LOCAL_IP_ADDRESS = '192.168.1.100';

describe('Local IP Service', () => {
  describe('create', () => {
    beforeEach(() => {
      mockDockerLib.runContainer.returns(Effect.void);
      mockNetworkLib.getLANIPAddress.returns(LOCAL_IP_ADDRESS);
      mockNetworkLib.getFreePort.returns(Effect.succeed(FROM_PORT));
    });

    it('creates a new instance with the given TO and FROM ports', run(function* () {
      mockDockerLib.doesContainerExist.returns(Effect.succeed(false));
      mockDockerLib.pullImage.returns(Effect.void);

      const result = yield* LocalIpService.create(TO_PORT, Option.some(FROM_PORT));

      expect(result).to.equal(FROM_PORT);
      expect(mockDockerLib.doesContainerExist.calledOnceWithExactly(`chtx_local_ip_${TO_PORT.toString()}`)).to.be.true;
      expect(mockDockerLib.pullImage.calledOnceWithExactly('medicmobile/nginx-local-ip')).to.be.true;
      expect(mockNetworkLib.getFreePort.calledOnceWithExactly({ port: FROM_PORT })).to.be.true;
      expect(mockNetworkLib.getLANIPAddress.calledOnceWithExactly()).to.be.true;
      expect(mockDockerLib.runContainer.calledOnceWithExactly({
        image: 'medicmobile/nginx-local-ip',
        name: `chtx_local_ip_${TO_PORT.toString()}`,
        ports: [[FROM_PORT, 443]],
        env: { APP_URL: `http://${LOCAL_IP_ADDRESS}:${TO_PORT.toString()}` },
        labels: [`chtx.instance.local-ip=${FROM_PORT.toString()}:${TO_PORT.toString()}`],
      })).to.be.true;
    }));

    it('creates a new instance with a random FROM port', run(function* () {
      mockDockerLib.doesContainerExist.returns(Effect.succeed(false));
      mockDockerLib.pullImage.returns(Effect.void);

      const result = yield* LocalIpService.create(TO_PORT, Option.none());

      expect(result).to.equal(FROM_PORT);
      expect(mockDockerLib.doesContainerExist.calledOnceWithExactly(`chtx_local_ip_${TO_PORT.toString()}`)).to.be.true;
      expect(mockDockerLib.pullImage.calledOnceWithExactly('medicmobile/nginx-local-ip')).to.be.true;
      expect(mockNetworkLib.getFreePort.calledOnceWithExactly()).to.be.true;
      expect(mockNetworkLib.getLANIPAddress.calledOnceWithExactly()).to.be.true;
      expect(mockDockerLib.runContainer.calledOnceWithExactly({
        image: 'medicmobile/nginx-local-ip',
        name: `chtx_local_ip_${TO_PORT.toString()}`,
        ports: [[FROM_PORT, 443]],
        env: { APP_URL: `http://${LOCAL_IP_ADDRESS}:${TO_PORT.toString()}` },
        labels: [`chtx.instance.local-ip=${FROM_PORT.toString()}:${TO_PORT.toString()}`],
      })).to.be.true;
    }));

    it('returns error when an instance already exists with the given TO port', run(function* () {
      mockDockerLib.doesContainerExist.returns(Effect.succeed(true));
      mockDockerLib.pullImage.returns(Effect.void);

      const either = yield* LocalIpService
        .create(TO_PORT, Option.none())
        .pipe(Effect.either);

      if (Either.isRight(either)) {
        expect.fail('Expected error');
      }
      expect(either.left).to.deep.equal(
        new Error(`Local-ip instance already exists for port [${TO_PORT.toString()}].`)
      );
      expect(mockDockerLib.doesContainerExist.calledOnceWithExactly(`chtx_local_ip_${TO_PORT.toString()}`)).to.be.true;
      expect(mockDockerLib.pullImage.notCalled).to.be.true;
      expect(mockNetworkLib.getFreePort.calledOnceWithExactly()).to.be.true;
      expect(mockNetworkLib.getLANIPAddress.notCalled).to.be.true;
      expect(mockDockerLib.runContainer.notCalled).to.be.true;
    }));

    it('returns error when the given FROM port is not available', run(function* () {
      mockDockerLib.doesContainerExist.returns(Effect.succeed(false));
      mockDockerLib.pullImage.returns(Effect.void);
      const fromPort = 123556;

      const either = yield* LocalIpService
        .create(TO_PORT, Option.some(fromPort))
        .pipe(Effect.either);

      if (Either.isRight(either)) {
        expect.fail('Expected error');
      }
      expect(either.left).to.deep.equal(new Error(`Port [${fromPort.toString()}] is not available.`));
      expect(mockDockerLib.doesContainerExist.calledOnceWithExactly(`chtx_local_ip_${TO_PORT.toString()}`)).to.be.true;
      expect(mockDockerLib.pullImage.calledOnceWithExactly('medicmobile/nginx-local-ip')).to.be.true;
      expect(mockNetworkLib.getFreePort.calledOnceWithExactly({ port: fromPort })).to.be.true;
      expect(mockNetworkLib.getLANIPAddress.notCalled).to.be.true;
      expect(mockDockerLib.runContainer.notCalled).to.be.true;
    }));

    it('creates a new instance even when error returned pulling image', run(function* () {
      mockDockerLib.doesContainerExist.returns(Effect.succeed(false));
      mockDockerLib.pullImage.returns(Effect.fail(new Error('Failed to pull image')));

      const result = yield* LocalIpService.create(TO_PORT, Option.none());

      expect(result).to.equal(FROM_PORT);
      expect(mockDockerLib.doesContainerExist.calledOnceWithExactly(`chtx_local_ip_${TO_PORT.toString()}`)).to.be.true;
      expect(mockDockerLib.pullImage.calledOnceWithExactly('medicmobile/nginx-local-ip')).to.be.true;
      expect(mockNetworkLib.getFreePort.calledOnceWithExactly()).to.be.true;
      expect(mockNetworkLib.getLANIPAddress.calledOnceWithExactly()).to.be.true;
      expect(mockDockerLib.runContainer.calledOnceWithExactly({
        image: 'medicmobile/nginx-local-ip',
        name: `chtx_local_ip_${TO_PORT.toString()}`,
        ports: [[FROM_PORT, 443]],
        env: { APP_URL: `http://${LOCAL_IP_ADDRESS}:${TO_PORT.toString()}` },
        labels: [`chtx.instance.local-ip=${FROM_PORT.toString()}:${TO_PORT.toString()}`],
      })).to.be.true;
    }));
  });

  describe('rm', () => {
    it('removes container for the given TO port', run(function* () {
      mockDockerLib.rmContainer.returns(Effect.void);
      yield* LocalIpService.rm(TO_PORT);
      expect(mockDockerLib.rmContainer.calledOnceWithExactly(`chtx_local_ip_${TO_PORT.toString()}`)).to.be.true;
    }));

    it('maps error thrown when removing container', run(function* () {
      const expectedError = new Error('Failed to remove container');
      mockDockerLib.rmContainer.returns(Effect.fail(expectedError));

      const either = yield* LocalIpService
        .rm(TO_PORT)
        .pipe(Effect.either);

      if (Either.isRight(either)) {
        expect.fail('Expected error');
      }
      expect(either.left).to.deep.equal(expectedError);
      expect(mockDockerLib.rmContainer.calledOnceWithExactly(`chtx_local_ip_${TO_PORT.toString()}`)).to.be.true;
    }));
  });

  describe('ls', () => {
    let getContainerLabelInner: sinon.SinonStub;

    beforeEach(() => {
      getContainerLabelInner = sinon.stub();
      mockDockerLib.getContainerLabelValue.returns(getContainerLabelInner);
    });

    it('returns ports for the existing local-ip instances', run(function* () {
      const containerName0 = 'chtx_local_ip_8080';
      const containerName1 = 'chtx_local_ip_9090';
      mockDockerLib.getContainerNamesWithLabel.returns(Effect.succeed([containerName0, containerName1]));
      getContainerLabelInner.withArgs(containerName0).returns(Effect.succeed('3000:8080'));
      getContainerLabelInner.withArgs(containerName1).returns(Effect.succeed('4000:9090'));

      const result = yield* LocalIpService.ls();

      expect(result).to.deep.equal([{ from: 3000, to: 8080 }, { from: 4000, to: 9090 }]);
      expect(mockDockerLib.getContainerNamesWithLabel.calledOnceWithExactly('chtx.instance.local-ip')).to.be.true;
      expect(mockDockerLib.getContainerLabelValue.calledOnceWithExactly('chtx.instance.local-ip')).to.be.true;
      expect(getContainerLabelInner.args).to.deep.equal(Array.map([containerName0, containerName1], Array.make));
    }));

    it('returns an empty array when there are no existing local-ip instances', run(function* () {
      mockDockerLib.getContainerNamesWithLabel.returns(Effect.succeed([]));

      const result = yield* LocalIpService.ls();

      expect(result).to.be.empty;
      expect(mockDockerLib.getContainerNamesWithLabel.calledOnceWithExactly('chtx.instance.local-ip')).to.be.true;
      expect(mockDockerLib.getContainerLabelValue.calledOnceWithExactly('chtx.instance.local-ip')).to.be.true;
      expect(getContainerLabelInner.notCalled).to.be.true;
    }));
  });
});
