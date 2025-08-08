import { describe, it } from 'mocha';
import { Option, Redacted, TestContext } from 'effect';
import { expect } from 'chai';
import sinon from 'sinon';
import { genWithLayer, sandbox } from '../utils/base.ts';
import OS from 'node:os';
import * as LocalNetworkLibs from '../../src/libs/local-network.ts';
import esmock from 'esmock';

const mockGetPort = sandbox.stub();

const run = TestContext.TestContext.pipe(genWithLayer);
const {
  getFreePort,
  getFreePorts,
  getLANIPAddress,
  getLocalIpUrl,
  getLocalIpUrlBasicAuth
} = await esmock<typeof LocalNetworkLibs>('../../src/libs/local-network.ts', {
  'get-port': mockGetPort
});

describe('local network libs', () => {
  describe('getFreePort', () => {
    it('returns port when called with all params', run(function* () {
      const args = {
        port: 1234,
        exclude: [5678]
      };
      mockGetPort.resolves(args.port);

      const result = yield* getFreePort(args);

      expect(result).to.equal(args.port);
      expect(mockGetPort.calledWithExactly(args)).to.be.true;
    }));

    it('returns port when called with no params', run(function* () {
      const port = 1234;
      mockGetPort.resolves(port);

      const result = yield* getFreePort();

      expect(result).to.equal(port);
      expect(mockGetPort.calledWithExactly(undefined)).to.be.true;
    }));
  });

  it('getFreePorts', run(function* () {
    mockGetPort.onFirstCall().resolves(1234);
    mockGetPort.onSecondCall().resolves(5678);

    const result = yield* getFreePorts();

    expect(result).to.deep.equal([1234, 5678]);
    expect(mockGetPort.calledTwice).to.be.true;
    expect(mockGetPort.firstCall.calledWithExactly(undefined)).to.be.true;
    expect(mockGetPort.secondCall.calledWithExactly({ exclude: [1234] })).to.be.true;
  }));

  describe('getLANIPAddress', () => {
    let networkInterfaces: sinon.SinonStub;

    beforeEach(() => {
      networkInterfaces = sinon.stub(OS, 'networkInterfaces');
    });

    [
      { eth_ipv4: [{ family: 'IPv4', address: '192.168.1.111' }] },
      { eth_ipv4: [
        { family: 'IPv4', address: '192.168.1.112', internal: true },
        { family: 'IPv4', address: '192.168.1.111', internal: false },
        { family: 'IPv4', address: '192.168.1.113' }
      ] },
      {
        eth_ipv6: [
          { family: 'IPv6', address: '192.168.1.112' },
          { family: 6, address: '192.168.1.113' }
        ],
        eth_ipv4: [{ family: 4, address: '192.168.1.111' }]
      },
      { eth_all: [
        { family: 'IPv6', address: '192.168.1.112' },
        { family: 6, address: '192.168.1.113' },
        { family: 4, address: '192.168.1.111' }
      ] },
    ].forEach((interfaces) => {
      it('returns the LAN ip address', () => {
        networkInterfaces.returns(interfaces);

        const result = getLANIPAddress();

        expect(result).to.equal('192.168.1.111');
        expect(networkInterfaces.calledOnceWithExactly()).to.be.true;
      });
    });

    it('returns the localhost IP URL when no ip address found', () => {
      networkInterfaces.returns({ eth_ipv6: [
        { family: 'IPv6', address: '192.168.1.112' },
        { family: 6, address: '192.168.1.113' },
      ] });

      const result = getLANIPAddress();

      expect(result).to.equal('127.0.0.1');
      expect(networkInterfaces.calledOnceWithExactly()).to.be.true;
    });
  });

  it('getLocalIpUrl', () => {
    const networkInterfaces: sinon.SinonStub = sinon.stub(OS, 'networkInterfaces');
    networkInterfaces.returns({ eth_ipv4: [{ family: 'IPv4', address: '192.168.1.111' }] });

    const result = getLocalIpUrl('1234');

    expect(result).to.deep.equal('https://192-168-1-111.local-ip.medicmobile.org:1234');
    expect(networkInterfaces.calledOnceWithExactly()).to.be.true;
  });

  it('getLocalIpUrlBasicAuth', () => {
    const networkInterfaces: sinon.SinonStub = sinon.stub(OS, 'networkInterfaces');
    networkInterfaces.returns({ eth_ipv4: [{ family: 'IPv4', address: '192.168.1.111' }] });

    const result = getLocalIpUrlBasicAuth({
      name: 'myInst',
      username: 'medic',
      password: Redacted.make('password'),
      port: Option.some('1234'),
      status: 'running'
    });

    expect(result).to.deep.equal(Option.some('https://medic:password@192-168-1-111.local-ip.medicmobile.org:1234'));
    expect(networkInterfaces.calledOnceWithExactly()).to.be.true;
  });
});
