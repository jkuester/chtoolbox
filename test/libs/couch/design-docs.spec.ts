import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import { ChtClientService } from '../../../src/services/cht-client.ts';
import * as DesignDocsLibs from '../../../src/libs/couch/design-docs.ts';
import { genWithLayer, sandbox } from '../../utils/base.ts';
import esmock from 'esmock';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;
const mockChtClient = { request: sandbox.stub() };
const mockHttpRequest = { get: sandbox.stub() };

const run = Layer
  .succeed(ChtClientService, mockChtClient as unknown as ChtClientService)
  .pipe(genWithLayer);
const { getDesignDocNames } = await esmock<typeof DesignDocsLibs>('../../../src/libs/couch/design-docs.ts', {
  '@effect/platform': { HttpClientRequest: mockHttpRequest }
});

describe('Couch Design Docs libs', () => {
  it('gets design names for a database', run(function* () {
    mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
    mockChtClient.request.returns(Effect.succeed({
      json: Effect.succeed({
        rows: [
          { id: '_design/medic' },
          { id: '_design/medic-client' },
          { id: '_design/medic-sms' },
        ],
      }),
    }));

    const designNames = yield* getDesignDocNames('medic');

    expect(designNames).to.deep.equal(['medic', 'medic-client', 'medic-sms']);
    expect(mockHttpRequest.get.calledOnceWithExactly('/medic/_design_docs')).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));

  it('returns an empty array if the database has no designs', run(function* () {
    mockHttpRequest.get.returns(FAKE_CLIENT_REQUEST);
    mockChtClient.request.returns(Effect.succeed({
      json: Effect.succeed({ rows: [] }),
    }));

    const designNames = yield* getDesignDocNames('medic');

    expect(designNames).to.deep.equal([]);
    expect(mockHttpRequest.get.calledOnceWithExactly('/medic/_design_docs')).to.be.true;
    expect(mockChtClient.request.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));
});
