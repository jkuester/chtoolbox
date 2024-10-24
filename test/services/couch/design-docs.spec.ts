import { afterEach, describe, it } from 'mocha';
import { Effect, Layer, TestContext } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { ChtClientService } from '../../../src/services/cht-client';
import { HttpClientRequest } from '@effect/platform';
import { CouchDesignDocsService } from '../../../src/services/couch/design-docs';

const FAKE_CLIENT_REQUEST = { hello: 'world' } as const;

describe('Couch Design Docs Service', () => {
  let couchRequest: SinonStub;
  let requestGet: SinonStub;

  beforeEach(() => {
    couchRequest = sinon.stub();
    requestGet = sinon.stub(HttpClientRequest, 'get');
  });

  afterEach(() => sinon.restore());

  const run = (test:  Effect.Effect<unknown, unknown, CouchDesignDocsService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(CouchDesignDocsService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(ChtClientService, {
        request: couchRequest,
      } as unknown as ChtClientService)),
    ));
  };

  it('gets design names for a database', run(Effect.gen(function* () {
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

    const designNames = yield* CouchDesignDocsService.getNames('medic');

    expect(designNames).to.deep.equal(['medic', 'medic-client', 'medic-sms']);
    expect(requestGet.calledOnceWithExactly('/medic/_design_docs')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  })));

  it('returns an empty array if the database has no designs', run(Effect.gen(function* () {
    requestGet.returns(FAKE_CLIENT_REQUEST);
    couchRequest.returns(Effect.succeed({
      json: Effect.succeed({ rows: [] }),
    }));

    const designNames = yield* CouchDesignDocsService.getNames('medic');

    expect(designNames).to.deep.equal([]);
    expect(requestGet.calledOnceWithExactly('/medic/_design_docs')).to.be.true;
    expect(couchRequest.calledOnceWithExactly(FAKE_CLIENT_REQUEST)).to.be.true;
  })));
});
