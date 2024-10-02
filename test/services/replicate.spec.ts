import { describe, it } from 'mocha';
import { Config, Effect, Layer, Redacted, Ref, TestContext } from 'effect';
import sinon, { SinonStub } from 'sinon';
import * as PouchSvc from '../../src/services/pouchdb';
import { PouchDBService } from '../../src/services/pouchdb';
import { EnvironmentService } from '../../src/services/environment';
import { expect } from 'chai';
import { ReplicateService, ReplicateServiceLive } from '../../src/services/replicate';

const FAKE_RESPONSE = { hello: 'world' } as const;

describe('Replicate Service', () => {
  let environmentGet: SinonStub;
  let pouchGet: SinonStub;

  beforeEach(() => {
    environmentGet = sinon.stub();
    pouchGet = sinon.stub();
  });

  afterEach(() => sinon.restore());

  const run = (test: Effect.Effect<unknown, unknown, ReplicateService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(ReplicateServiceLive),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(PouchDBService, PouchDBService.of({
        get: pouchGet,
      }))),
      Effect.provide(Layer.succeed(EnvironmentService, EnvironmentService.of({
        get: environmentGet,
      }))),
    ));
  };

  describe('replicate', () => {
    let bulkDocs: SinonStub;
    let assertPouchResponse: SinonStub;

    beforeEach(() => {
      bulkDocs = sinon.stub();
      pouchGet.returns(Effect.succeed({ bulkDocs }));
      assertPouchResponse = sinon.stub(PouchSvc, 'assertPouchResponse');
    });

    it('creates a doc in the _replication database', run(Effect.gen(function* () {
      const owner = 'medic';
      const url = `http://${owner}:password@localhost:5984`;
      const env = yield* Redacted.make(url).pipe(
        Config.succeed,
        Ref.make,
        Effect.map(url => ({ url }))
      );
      environmentGet.returns(env);
      const source = 'source';
      const target = 'target';
      bulkDocs.resolves([FAKE_RESPONSE]);
      assertPouchResponse.returns(FAKE_RESPONSE);

      const replicateSvc = yield* ReplicateService;
      const response = yield* replicateSvc.replicate(source, target);

      expect(response).to.deep.equal(FAKE_RESPONSE);
      expect(pouchGet.calledOnceWithExactly('_replicator')).to.be.true;
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(bulkDocs.calledOnceWithExactly([{
        user_ctx: {
          name: owner,
          roles: ['_admin', '_reader', '_writer'],
        },
        source: { url: `${url}/${source}` },
        target: { url: `${url}/${target}` },
        create_target: false,
        continuous: false,
        owner,
      }])).to.be.true;
      expect(assertPouchResponse.calledOnceWithExactly(FAKE_RESPONSE)).to.be.true;
    })));
  });
});
