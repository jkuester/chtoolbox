import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Effect } from 'effect';
import esmock from 'esmock';
import * as LibModule from '../src/lib.ts';
import { sandbox } from './utils/base.ts';

const mockGetDesignDocsDiffWithCurrent = sandbox.stub();

const { createChtoolbox } = await esmock<typeof LibModule>('../src/lib.ts', {
  '../src/libs/medic-staging.ts': {
    getDesignDocsDiffWithCurrent: mockGetDesignDocsDiffWithCurrent
  }
});

describe('lib', () => {
  describe('createChtoolbox', () => {
    const config = {
      url: 'https://example.com',
      username: 'admin',
      password: 'secret'
    };

    it('returns a Chtoolbox object with getDesignDocsDiffWithCurrent method', () => {
      const chtoolbox = createChtoolbox(config);

      expect(chtoolbox).to.have.property('getDesignDocsDiffWithCurrent');
      expect(chtoolbox.getDesignDocsDiffWithCurrent).to.be.a('function');
    });

    it('getDesignDocsDiffWithCurrent calls the underlying Effect and returns a promise', async () => {
      const expectedDiff = {
        'medic': { created: [], deleted: [], updated: [] },
        'medic-sentinel': { created: [], deleted: [], updated: [] },
        'medic-logs': { created: [], deleted: [], updated: [] },
        'medic-users-meta': { created: [], deleted: [], updated: [] },
        '_users': { created: [], deleted: [], updated: [] },
      };
      mockGetDesignDocsDiffWithCurrent.returns(Effect.succeed(expectedDiff));

      const chtoolbox = createChtoolbox(config);
      const result = await chtoolbox.getDesignDocsDiffWithCurrent('4.5.0');

      expect(result).to.deep.equal(expectedDiff);
      expect(mockGetDesignDocsDiffWithCurrent.calledOnceWithExactly('4.5.0')).to.be.true;
    });
  });
});
