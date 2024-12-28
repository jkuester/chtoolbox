import { describe, it } from 'mocha';
import { TestContext } from 'effect';
import { expect } from 'chai';
import sinon from 'sinon';
import { genWithLayer, sandbox } from '../utils/base';
import OS from 'node:os';
import { getFreePorts, getLocalIpUrl } from '../../src/libs/local-network';
import * as Core from '../../src/libs/core';

const run = TestContext.TestContext.pipe(genWithLayer);

describe('local network libs', () => {
  it('getFreePorts', run(function* () {
    const promisedGetPort = sandbox.stub(Core, 'promisedGetPort');
    const getPortStub = sinon.stub();
    // Types + ES Modules gets weird here
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    promisedGetPort.resolves({ default: getPortStub } as any);
    getPortStub.onFirstCall().resolves(1234);
    getPortStub.onSecondCall().resolves(5678);

    const result = yield* getFreePorts();

    expect(result).to.deep.equal([1234, 5678]);
    expect(promisedGetPort.calledTwice).to.be.true;
    expect(getPortStub.calledTwice).to.be.true;
    expect(getPortStub.firstCall.calledWithExactly({ exclude: [] })).to.be.true;
    expect(getPortStub.secondCall.calledWithExactly({ exclude: [1234] })).to.be.true;
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
});
