import { describe, it } from 'mocha';
import { Config, Effect, Layer, Redacted, Ref, TestContext } from 'effect';
import sinon, { SinonStub } from 'sinon';
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

  describe('replicateAsync', () => {
    let bulkDocs: SinonStub;

    beforeEach(() => {
      bulkDocs = sinon.stub();
      pouchGet.returns(Effect.succeed({ bulkDocs }));
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
      bulkDocs.resolves(FAKE_RESPONSE);

      const replicateSvc = yield* ReplicateService;
      const response = yield* replicateSvc.replicateAsync(source, target);

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
    })));
  });

  describe('replicate', () => {
    it('replicates the source database into the target', run(Effect.gen(function* () {
      const source = 'source';
      const target = 'target';
      const sourceDb = { replicate: { to: sinon.stub().resolves(FAKE_RESPONSE) } };
      const targetDb = { target: true };
      pouchGet.withArgs(source).returns(Effect.succeed(sourceDb));
      pouchGet.withArgs(target).returns(Effect.succeed(targetDb));

      const replicateSvc = yield* ReplicateService;
      const replication = yield* replicateSvc.replicate(source, target);
      const response = yield* Effect.promise(() => replication);

      expect(response).to.deep.equal(FAKE_RESPONSE);
      expect(pouchGet.args).to.deep.equal([[source], [target]]);
      expect(environmentGet.notCalled).to.be.true;
      expect(sourceDb.replicate.to.calledOnceWithExactly(targetDb)).to.be.true;
    })));
  });
});
