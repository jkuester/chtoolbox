import { describe, it } from 'mocha';
import { TestContext, Redacted, Option } from 'effect';
import { expect } from 'chai';
import sinon from 'sinon';
import { genWithLayer, sandbox } from '../utils/base.js';
import OS from 'node:os';
import * as LocalNetworkLibs from '../../src/libs/local-network.js';
import esmock from 'esmock';
import { getLocalIpUrlBasicAuth } from '../../src/libs/local-network.js';

const mockGetPort = sandbox.stub();

const run = TestContext.TestContext.pipe(genWithLayer);
const { getFreePorts, getLocalIpUrl } = await esmock<typeof LocalNetworkLibs>('../../src/libs/local-network.js', {
  'get-port': mockGetPort
});

describe('local network libs', () => {
  it('getFreePorts', run(function* () {
    mockGetPort.onFirstCall().resolves(1234);
    mockGetPort.onSecondCall().resolves(5678);

    const result = yield* getFreePorts();

    expect(result).to.deep.equal([1234, 5678]);
    expect(mockGetPort.calledTwice).to.be.true;
    expect(mockGetPort.firstCall.calledWithExactly({ exclude: [] })).to.be.true;
    expect(mockGetPort.secondCall.calledWithExactly({ exclude: [1234] })).to.be.true;
  }));

  describe('getLocalIpUrl', () => {
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
      it('returns the local-ip URL with the given port', () => {
        networkInterfaces.returns(interfaces);

        const result = getLocalIpUrl('1234');

        expect(result).to.equal('https://192-168-1-111.local-ip.medicmobile.org:1234');
        expect(networkInterfaces.calledOnceWithExactly()).to.be.true;
      });
    });

    it('returns the localhost IP URL when no ip address found', () => {
      networkInterfaces.returns({ eth_ipv6: [
        { family: 'IPv6', address: '192.168.1.112' },
        { family: 6, address: '192.168.1.113' },
      ] });

      const result = getLocalIpUrl('1234');

      expect(result).to.equal('https://127-0-0-1.local-ip.medicmobile.org:1234');
      expect(networkInterfaces.calledOnceWithExactly()).to.be.true;
    });
  });

  it('getLocalIpUrlBasicAuth', () => {
    const networkInterfaces: sinon.SinonStub = sinon.stub(OS, 'networkInterfaces');
    networkInterfaces.returns({ eth_ipv4: [{ family: 'IPv4', address: '192.168.1.111' }] });

    const result = getLocalIpUrlBasicAuth({
      name: 'myInst',
      username: 'medic',
      password: Redacted.make('password'),
      port: Option.some('1234')
    });

    expect(result).to.deep.equal(Option.some('https://medic:password@192-168-1-111.local-ip.medicmobile.org:1234'));
    expect(networkInterfaces.calledOnceWithExactly()).to.be.true;
  });
});
