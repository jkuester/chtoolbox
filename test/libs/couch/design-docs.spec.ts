import { describe, it } from 'mocha';
import { Effect, Layer } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest } from '@effect/platform';
import { getDesignDocNames } from '../../../src/libs/couch/design-docs';
import { genWithLayer, sandbox } from '../../utils/base';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

const couchRequest = sandbox.stub();

const run = Layer
  .succeed(ChtClientService, { request: couchRequest } as unknown as ChtClientService)
  .pipe(genWithLayer);

describe('Couch Design Docs libs', () => {
  let requestGet: SinonStub;

  beforeEach(() => {
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

  it('gets design names for a database', run(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    couchRequest.returns(Effect.succeed({
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
    expect(requestGet.calledOnceWithExactly('/medic/_design_docs')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));

  it('returns an empty array if the database has no designs', run(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed({ rows: [] }),
    }));

    const designNames = yield* getDesignDocNames('medic');

    expect(designNames).to.deep.equal([]);
    expect(requestGet.calledOnceWithExactly('/medic/_design_docs')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  }));
});
