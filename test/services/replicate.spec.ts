import { describe, it } from 'mocha';
import { Chunk, Effect, Layer, Redacted, Stream } from 'effect';
import sinon, { SinonStub } from 'sinon';
import * as PouchSvc from '../../src/services/pouchdb';
import * as pouchDbService from '../../src/services/pouchdb';
import { PouchDBService } from '../../src/services/pouchdb';
import { EnvironmentService } from '../../src/services/environment';
import { expect } from 'chai';
import { ReplicateService } from '../../src/services/replicate';
import { genWithLayer, sandbox } from '../utils/base';

const FAKE_RESPONSE = { id: 'world' } as const;

const environmentGet = sandbox.stub();
const pouchGet = sandbox.stub();
const bulkDocs = sandbox.stub();

const run = ReplicateService.Default.pipe(
  Layer.provide(Layer.succeed(PouchDBService, {
    get: pouchGet,
  } as unknown as PouchDBService),),
  Layer.provide(Layer.succeed(EnvironmentService, {
    get: environmentGet,
  } as unknown as EnvironmentService)),
  genWithLayer,
);

describe('Replicate Service', () => {
  let assertPouchResponse: SinonStub;
  let streamChanges: SinonStub;

  beforeEach(() => {
    pouchGet.returns(Effect.succeed({ bulkDocs }));
    assertPouchResponse = sinon.stub(PouchSvc, 'assertPouchResponse');
    streamChanges = sinon.stub(pouchDbService, 'streamChanges');
  });

  it('creates a doc in the _replication database', run(function* () {
    const owner = 'medic';
    const url = `http://${owner}:password@localhost:5984/`;
    const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
    environmentGet.returns(Effect.succeed(env));
    const source = 'source';
    const target = 'target';
    bulkDocs.resolves([FAKE_RESPONSE]);
    assertPouchResponse.returns(FAKE_RESPONSE);
    streamChanges.returns(sinon.stub().returns(Stream.empty));

    yield* ReplicateService.replicate(source, target);

    expect(pouchGet.args).to.deep.equal([['_replicator'], ['_replicator']]);
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
    expect(streamChanges.calledOnceWithExactly({
      include_docs: true,
      doc_ids: [FAKE_RESPONSE.id],
    })).to.be.true;
  }));

  it('includes ddocs in replication when param is set', run(function* () {
    const owner = 'medic';
    const url = `http://${owner}:password@localhost:5984/`;
    const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
    environmentGet.returns(Effect.succeed(env));
    const source = 'source';
    const target = 'target';
    bulkDocs.resolves([FAKE_RESPONSE]);
    assertPouchResponse.returns(FAKE_RESPONSE);
    streamChanges.returns(sinon.stub().returns(Stream.empty));

    yield* ReplicateService.replicate(source, target, true);

    expect(pouchGet.args).to.deep.equal([['_replicator'], ['_replicator']]);
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
    expect(streamChanges.calledOnceWithExactly({
      include_docs: true,
      doc_ids: [FAKE_RESPONSE.id],
    })).to.be.true;
  }));

  it('streams updates to the replication doc until the replication state is completed', run(function* () {
    const owner = 'medic';
    const url = `http://${owner}:password@localhost:5984/`;
    const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
    environmentGet.returns(Effect.succeed(env));
    const source = 'source';
    const target = 'target';
    bulkDocs.resolves([FAKE_RESPONSE]);
    assertPouchResponse.returns(FAKE_RESPONSE);
    const repDocInitial = {
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
    };
    const repDocChanges = [
      {
        _id: FAKE_RESPONSE.id,
      },
      {
        _id: FAKE_RESPONSE.id,
        _replication_state: 'stuff is happening',
      },
      {
        _id: FAKE_RESPONSE.id,
        _replication_state: 'completed',
        _replication_stats: {
          docs_written: 100,
        },
      }
    ];
    const changesStream = Stream
      .fromIterable(repDocChanges)
      .pipe(Stream.map(doc => ({ doc })));
    streamChanges.returns(sinon.stub().returns(changesStream));

    const stream = yield* ReplicateService.replicate(source, target);
    const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

    expect(results).to.deep.equal(repDocChanges);
    expect(pouchGet.args).to.deep.equal([['_replicator'], ['_replicator']]);
    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(bulkDocs.calledOnceWithExactly([repDocInitial])).to.be.true;
    expect(assertPouchResponse.calledOnceWithExactly(FAKE_RESPONSE)).to.be.true;
    expect(streamChanges.calledOnceWithExactly({
      include_docs: true,
      doc_ids: [FAKE_RESPONSE.id],
    })).to.be.true;
  }));
});
