import { describe, it } from 'mocha';
import { Chunk, Effect, Layer, Redacted, Stream } from 'effect';
import sinon from 'sinon';
import { PouchDBService } from '../../src/services/pouchdb.js';
import { EnvironmentService } from '../../src/services/environment.js';
import { expect } from 'chai';
import * as ReplicateSvc from '../../src/services/replicate.js';
import { genWithLayer, sandbox } from '../utils/base.js';
import esmock from 'esmock';

const FAKE_RESPONSE = { id: 'world' } as const;
const mockPouchSvc = {
  assertPouchResponse: sandbox.stub(),
  streamChanges: sandbox.stub(),
};

const environmentGet = sandbox.stub();
const pouchGet = sandbox.stub();
const bulkDocs = sandbox.stub();

const { ReplicateService } = await esmock<typeof ReplicateSvc>('../../src/services/replicate.js', {
  '../../src/services/pouchdb.js': mockPouchSvc,
});
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

  beforeEach(() => pouchGet.returns(Effect.succeed({ bulkDocs })));

  it('creates a doc in the _replication database', run(function* () {
    const owner = 'medic';
    const url = `http://${owner}:password@localhost:5984/`;
    const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
    environmentGet.returns(Effect.succeed(env));
    const source = 'source';
    const target = 'target';
    bulkDocs.resolves([FAKE_RESPONSE]);
    mockPouchSvc.assertPouchResponse.returns(FAKE_RESPONSE);
    mockPouchSvc.streamChanges.returns(sinon.stub().returns(Stream.empty));

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
    expect(mockPouchSvc.assertPouchResponse.calledOnceWithExactly(FAKE_RESPONSE)).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
      include_docs: true,
      doc_ids: [FAKE_RESPONSE.id],
    })).to.be.true;
  }));

  it('accepts remote url for target', run(function* () {
    const owner = 'medic';
    const url = `http://${owner}:password@localhost:5984/`;
    const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
    environmentGet.returns(Effect.succeed(env));
    const source = 'source';
    const target = 'http://remoteUser:password@remote.couch.instance.com/target';
    bulkDocs.resolves([FAKE_RESPONSE]);
    mockPouchSvc.assertPouchResponse.returns(FAKE_RESPONSE);
    mockPouchSvc.streamChanges.returns(sinon.stub().returns(Stream.empty));

    yield* ReplicateService.replicate(source, target);

    expect(pouchGet.args).to.deep.equal([['_replicator'], ['_replicator']]);
    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(bulkDocs.calledOnceWithExactly([{
      user_ctx: {
        name: owner,
        roles: ['_admin', '_reader', '_writer'],
      },
      source: { url: `${url}${source}` },
      target: { url: target },
      create_target: false,
      continuous: false,
      owner,
      selector: {
        _id: { '$regex': '^(?!_design/)' },
      },
    }])).to.be.true;
    expect(mockPouchSvc.assertPouchResponse.calledOnceWithExactly(FAKE_RESPONSE)).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
      include_docs: true,
      doc_ids: [FAKE_RESPONSE.id],
    })).to.be.true;
  }));

  it('accepts remote url for source', run(function* () {
    const owner = 'medic';
    const url = `http://${owner}:password@localhost:5984/`;
    const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
    environmentGet.returns(Effect.succeed(env));
    const source = 'http://remoteUser:password@remote.couch.instance.com/source';
    const target = 'target';
    bulkDocs.resolves([FAKE_RESPONSE]);
    mockPouchSvc.assertPouchResponse.returns(FAKE_RESPONSE);
    mockPouchSvc.streamChanges.returns(sinon.stub().returns(Stream.empty));

    yield* ReplicateService.replicate(source, target);

    expect(pouchGet.args).to.deep.equal([['_replicator'], ['_replicator']]);
    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(bulkDocs.calledOnceWithExactly([{
      user_ctx: {
        name: owner,
        roles: ['_admin', '_reader', '_writer'],
      },
      source: { url: source },
      target: { url: `${url}${target}` },
      create_target: false,
      continuous: false,
      owner,
      selector: {
        _id: { '$regex': '^(?!_design/)' },
      },
    }])).to.be.true;
    expect(mockPouchSvc.assertPouchResponse.calledOnceWithExactly(FAKE_RESPONSE)).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
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
    mockPouchSvc.assertPouchResponse.returns(FAKE_RESPONSE);
    mockPouchSvc.streamChanges.returns(sinon.stub().returns(Stream.empty));

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
    expect(mockPouchSvc.assertPouchResponse.calledOnceWithExactly(FAKE_RESPONSE)).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
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
    mockPouchSvc.assertPouchResponse.returns(FAKE_RESPONSE);
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
    mockPouchSvc.streamChanges.returns(sinon.stub().returns(changesStream));

    const stream = yield* ReplicateService.replicate(source, target);
    const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

    expect(results).to.deep.equal(repDocChanges);
    expect(pouchGet.args).to.deep.equal([['_replicator'], ['_replicator']]);
    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(bulkDocs.calledOnceWithExactly([repDocInitial])).to.be.true;
    expect(mockPouchSvc.assertPouchResponse.calledOnceWithExactly(FAKE_RESPONSE)).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly({
      include_docs: true,
      doc_ids: [FAKE_RESPONSE.id],
    })).to.be.true;
  }));
});
