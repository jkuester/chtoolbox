import { describe, it } from 'mocha';
import { Chunk, Effect, Either, Layer, Redacted, Stream } from 'effect';
import sinon, { type SinonStub } from 'sinon';
import { PouchDBService } from '../../src/services/pouchdb.ts';
import { EnvironmentService } from '../../src/services/environment.ts';
import { expect } from 'chai';
import * as ReplicateSvc from '../../src/services/replicate.ts';
import { genWithLayer, sandbox } from '../utils/base.ts';
import esmock from 'esmock';

const FAKE_RESPONSE = { id: 'world' } as const;
const mockPouchSvc = {
  saveDoc: sandbox.stub(),
  streamChanges: sandbox.stub(),
};

const environmentGet = sandbox.stub();

const { ReplicateService } = await esmock<typeof ReplicateSvc>('../../src/services/replicate.ts', {
  '../../src/services/pouchdb.ts': mockPouchSvc,
});
const run = ReplicateService.Default.pipe(
  Layer.provide(Layer.succeed(PouchDBService, { } as unknown as PouchDBService)),
  Layer.provide(Layer.succeed(EnvironmentService, {
    get: environmentGet,
  } as unknown as EnvironmentService)),
  genWithLayer,
);

describe('Replicate Service', () => {
  let saveDoc: SinonStub;
  beforeEach(() => {
    saveDoc = sinon.stub();
    mockPouchSvc.saveDoc.returns(saveDoc);
  });

  it('creates a doc in the _replication database', run(function* () {
    const owner = 'medic';
    const url = `http://${owner}:password@localhost:5984/`;
    const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
    environmentGet.returns(Effect.succeed(env));
    const source = 'source';
    const target = 'target';
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
    const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
    mockPouchSvc.streamChanges.returns(streamChanges);

    yield* ReplicateService.replicate(source, target);

    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(saveDoc.calledOnceWithExactly({
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
    })).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly('_replicator')).to.be.true;
    expect(streamChanges.calledOnceWithExactly({
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
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
    const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
    mockPouchSvc.streamChanges.returns(streamChanges);

    yield* ReplicateService.replicate(source, target);

    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(saveDoc.calledOnceWithExactly({
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
    })).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly('_replicator')).to.be.true;
    expect(streamChanges.calledOnceWithExactly({
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
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
    const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
    mockPouchSvc.streamChanges.returns(streamChanges);

    yield* ReplicateService.replicate(source, target);

    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(saveDoc.calledOnceWithExactly({
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
    })).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly('_replicator')).to.be.true;
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
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
    const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
    mockPouchSvc.streamChanges.returns(streamChanges);

    yield* ReplicateService.replicate(source, target, { includeDdocs: true });

    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(saveDoc.calledOnceWithExactly({
      user_ctx: {
        name: owner,
        roles: ['_admin', '_reader', '_writer'],
      },
      source: { url: `${url}${source}` },
      target: { url: `${url}${target}` },
      create_target: false,
      continuous: false,
      owner,
      selector: { },
    })).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly('_replicator')).to.be.true;
    expect(streamChanges.calledOnceWithExactly({
      include_docs: true,
      doc_ids: [FAKE_RESPONSE.id],
    })).to.be.true;
  }));

  it('replicates only contact types when param is set', run(function* () {
    const owner = 'medic';
    const url = `http://${owner}:password@localhost:5984/`;
    const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
    environmentGet.returns(Effect.succeed(env));
    const source = 'source';
    const target = 'target';
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
    const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
    mockPouchSvc.streamChanges.returns(streamChanges);
    const contactTypes = ['person', 'clinic'];

    yield* ReplicateService.replicate(source, target, { contactTypes });

    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(saveDoc.calledOnceWithExactly({
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
        $or: [
          { type: { $in: contactTypes } },
          { $and: [
            { type: 'contact', },
            { contact_type: { $in: contactTypes } }
          ] }
        ]
      },
    })).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly('_replicator')).to.be.true;
    expect(streamChanges.calledOnceWithExactly({
      include_docs: true,
      doc_ids: [FAKE_RESPONSE.id],
    })).to.be.true;
  }));

  it('fails when replicating ddocs and filtering by contact type', run(function* () {
    const owner = 'medic';
    const url = `http://${owner}:password@localhost:5984/`;
    const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
    environmentGet.returns(Effect.succeed(env));
    const source = 'source';
    const target = 'target';

    const either = yield* Effect.either(ReplicateService.replicate(source, target, {
      includeDdocs: true,
      contactTypes: ['person', 'clinic']
    }));

    if (Either.isRight(either)) {
      expect.fail('Expected error to be thrown.');
    }

    expect(either.left.message).to.equal('Cannot replicate ddocs while also filtering by contact type.');
    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(saveDoc.notCalled).to.be.true;
    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(mockPouchSvc.streamChanges.notCalled).to.be.true;
  }));

  it('streams updates to the replication doc until the replication state is completed', run(function* () {
    const owner = 'medic';
    const url = `http://${owner}:password@localhost:5984/`;
    const env = Redacted.make(url).pipe(url => ({ url, user: owner }));
    environmentGet.returns(Effect.succeed(env));
    const source = 'source';
    const target = 'target';
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
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
    const streamChanges = sinon.stub().returns(Effect.succeed(changesStream));
    mockPouchSvc.streamChanges.returns(streamChanges);

    const stream = yield* ReplicateService.replicate(source, target);
    const results = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

    expect(results).to.deep.equal(repDocChanges);
    expect(environmentGet.calledOnceWithExactly()).to.be.true;
    expect(saveDoc.calledOnceWithExactly(repDocInitial)).to.be.true;
    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly('_replicator')).to.be.true;
    expect(streamChanges.calledOnceWithExactly({
      include_docs: true,
      doc_ids: [FAKE_RESPONSE.id],
    })).to.be.true;
  }));
});
