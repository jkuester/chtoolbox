import { describe, it } from 'mocha';
import { Effect, Layer, Redacted, TestContext } from 'effect';
import sinon, { SinonStub } from 'sinon';
import * as PouchSvc from '../../src/services/pouchdb';
import { PouchDBService } from '../../src/services/pouchdb';
import { EnvironmentService } from '../../src/services/environment';
import { expect } from 'chai';
import { ReplicateService } from '../../src/services/replicate';

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
      Effect.provide(ReplicateService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(PouchDBService, {
        get: pouchGet,
      } as unknown as PouchDBService),),
      Effect.provide(Layer.succeed(EnvironmentService, {
        get: environmentGet,
      } as unknown as EnvironmentService)),
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
      const url = `http://${owner}:password@localhost:5984/`;
      const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
      environmentGet.returns(Effect.succeed(env));
      const source = 'source';
      const target = 'target';
      bulkDocs.resolves([FAKE_RESPONSE]);
      assertPouchResponse.returns(FAKE_RESPONSE);

      const response = yield* ReplicateService.replicate(source, target);

      expect(response).to.deep.equal(FAKE_RESPONSE);
      expect(pouchGet.calledOnceWithExactly('_replicator')).to.be.true;
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(bulkDocs.calledOnceWithExactly([{
        user_ctx: {
          name: owner,
          roles: ['_admin', '_reader', '_writer'],
        },
        source: { url: `${url}${source}` },
        target: { url: `${url}${target}` },
        create_target: false,
        continuous: false,
        owner,
        selector: {
          _id: { '$regex': '^(?!_design/)' },
        },
      }])).to.be.true;
      expect(assertPouchResponse.calledOnceWithExactly(FAKE_RESPONSE)).to.be.true;
    })));

    it('includes ddocs in replication when param is set', run(Effect.gen(function* () {
      const owner = 'medic';
      const url = `http://${owner}:password@localhost:5984/`;
      const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
      environmentGet.returns(Effect.succeed(env));
      const source = 'source';
      const target = 'target';
      bulkDocs.resolves([FAKE_RESPONSE]);
      assertPouchResponse.returns(FAKE_RESPONSE);

      const response = yield* ReplicateService.replicate(source, target, true);

      expect(response).to.deep.equal(FAKE_RESPONSE);
      expect(pouchGet.calledOnceWithExactly('_replicator')).to.be.true;
      expect(environmentGet.calledOnceWithExactly()).to.be.true;
      expect(bulkDocs.calledOnceWithExactly([{
        user_ctx: {
          name: owner,
          roles: ['_admin', '_reader', '_writer'],
        },
        source: { url: `${url}${source}` },
        target: { url: `${url}${target}` },
        create_target: false,
        continuous: false,
        owner,
        selector: undefined,
      }])).to.be.true;
      expect(assertPouchResponse.calledOnceWithExactly(FAKE_RESPONSE)).to.be.true;
    })));
  });

  describe('watch', () => {
    let changes: SinonStub;

    beforeEach(() => {
      changes = sinon.stub();
      pouchGet.returns(Effect.succeed({ changes }));
    });

    it('watches a replication doc', run(Effect.gen(function* () {
      const docId = 'repDocId';
      changes.returns(FAKE_RESPONSE);

      const changesFeed = yield* ReplicateService.watch(docId);

      expect(changesFeed).to.equal(FAKE_RESPONSE);
      expect(pouchGet.calledOnceWithExactly('_replicator')).to.be.true;
      expect(environmentGet.notCalled).to.be.true;
      expect(changes.calledOnceWithExactly({
        since: 'now',
        live: true,
        include_docs: true,
        doc_ids: [docId],
      })).to.be.true;
    })));
  });
});
