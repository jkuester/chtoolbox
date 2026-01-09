import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Effect } from 'effect';
import esmock from 'esmock';
import * as LibModule from '../src/lib.ts';
import { DEFAULT_CHT_PASSWORD, DEFAULT_CHT_URL, DEFAULT_CHT_USERNAME, sandbox } from './utils/base.ts';

const mockGetDesignDocsDiffWithCurrent = sandbox.stub();

const { createChtoolbox } = await esmock<typeof LibModule>('../src/lib.ts', {
  '../src/libs/medic-staging.ts': {
    getDesignDocsDiffWithCurrent: mockGetDesignDocsDiffWithCurrent
  }
});
const config = {
  url: DEFAULT_CHT_URL,
  username: DEFAULT_CHT_USERNAME,
  password: DEFAULT_CHT_PASSWORD
};

describe('lib', () => {
  it('getDiffWithCurrent', async () => {
    const expectedDiff = {
      'medic': { created: [], deleted: [], updated: [] },
      'medic-sentinel': { created: [], deleted: [], updated: [] },
      'medic-logs': { created: [], deleted: [], updated: [] },
      'medic-users-meta': { created: [], deleted: [], updated: [] },
      '_users': { created: [], deleted: [], updated: [] },
    };
    mockGetDesignDocsDiffWithCurrent.returns(Effect.succeed(expectedDiff));

    const chtoolbox = createChtoolbox(config);
    const result = await chtoolbox.design.getDiffWithCurrent('4.5.0');

    expect(result).to.deep.equal(expectedDiff);
    expect(mockGetDesignDocsDiffWithCurrent.calledOnceWithExactly('4.5.0')).to.be.true;
  });
});
