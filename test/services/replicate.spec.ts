import { describe, it } from 'mocha';
import { Chunk, Effect, Either, Layer, Stream } from 'effect';
import sinon, { type SinonStub } from 'sinon';
import { PouchDBService } from '../../src/services/pouchdb.ts';
import { expect } from 'chai';
import * as ReplicateSvc from '../../src/services/replicate.ts';
import { DEFAULT_CHT_URL_AUTH, DEFAULT_CHT_USERNAME, genWithDefaultConfig, sandbox } from '../utils/base.ts';
import esmock from 'esmock';

const FAKE_RESPONSE = { id: 'world' } as const;
const mockPouchSvc = {
  saveDoc: sandbox.stub(),
  streamChanges: sandbox.stub(),
};

const { ReplicateService } = await esmock<typeof ReplicateSvc>('../../src/services/replicate.ts', {
  '../../src/services/pouchdb.ts': mockPouchSvc,
});
const run = ReplicateService.Default.pipe(
  Layer.provide(Layer.succeed(PouchDBService, { } as unknown as PouchDBService)),
  genWithDefaultConfig,
);

describe('Replicate Service', () => {
  let saveDoc: SinonStub;
  beforeEach(() => {
    saveDoc = sinon.stub();
    mockPouchSvc.saveDoc.returns(saveDoc);
  });

  it('creates a doc in the _replication database', run(function* () {
    const source = 'source';
    const target = 'target';
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
    const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
    mockPouchSvc.streamChanges.returns(streamChanges);

    yield* ReplicateService.replicate(source, target);

    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(saveDoc.calledOnceWithExactly({
      user_ctx: {
        name: DEFAULT_CHT_USERNAME,
        roles: ['_admin', '_reader', '_writer'],
      },
      source: { url: `${DEFAULT_CHT_URL_AUTH}${source}` },
      target: { url: `${DEFAULT_CHT_URL_AUTH}${target}` },
      create_target: false,
      continuous: false,
      owner: DEFAULT_CHT_USERNAME,
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
    const source = 'source';
    const target = 'http://remoteUser:password@remote.couch.instance.com/target';
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
    const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
    mockPouchSvc.streamChanges.returns(streamChanges);

    yield* ReplicateService.replicate(source, target);

    expect(saveDoc.calledOnceWithExactly({
      user_ctx: {
        name: DEFAULT_CHT_USERNAME,
        roles: ['_admin', '_reader', '_writer'],
      },
      source: { url: `${DEFAULT_CHT_URL_AUTH}${source}` },
      target: { url: target },
      create_target: false,
      continuous: false,
      owner: DEFAULT_CHT_USERNAME,
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
    const source = 'http://remoteUser:password@remote.couch.instance.com/source';
    const target = 'target';
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
    const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
    mockPouchSvc.streamChanges.returns(streamChanges);

    yield* ReplicateService.replicate(source, target);

    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(saveDoc.calledOnceWithExactly({
      user_ctx: {
        name: DEFAULT_CHT_USERNAME,
        roles: ['_admin', '_reader', '_writer'],
      },
      source: { url: source },
      target: { url: `${DEFAULT_CHT_URL_AUTH}${target}` },
      create_target: false,
      continuous: false,
      owner: DEFAULT_CHT_USERNAME,
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
    const source = 'source';
    const target = 'target';
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
    const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
    mockPouchSvc.streamChanges.returns(streamChanges);

    yield* ReplicateService.replicate(source, target, { includeDdocs: true });

    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(saveDoc.calledOnceWithExactly({
      user_ctx: {
        name: DEFAULT_CHT_USERNAME,
        roles: ['_admin', '_reader', '_writer'],
      },
      source: { url: `${DEFAULT_CHT_URL_AUTH}${source}` },
      target: { url: `${DEFAULT_CHT_URL_AUTH}${target}` },
      create_target: false,
      continuous: false,
      owner: DEFAULT_CHT_USERNAME,
      selector: { },
    })).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly('_replicator')).to.be.true;
    expect(streamChanges.calledOnceWithExactly({
      include_docs: true,
      doc_ids: [FAKE_RESPONSE.id],
    })).to.be.true;
  }));

  it('replicates only contact types when param is set', run(function* () {
    const source = 'source';
    const target = 'target';
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
    const streamChanges = sinon.stub().returns(Effect.succeed(Stream.empty));
    mockPouchSvc.streamChanges.returns(streamChanges);
    const contactTypes = ['person', 'clinic'];

    yield* ReplicateService.replicate(source, target, { contactTypes });

    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(saveDoc.calledOnceWithExactly({
      user_ctx: {
        name: DEFAULT_CHT_USERNAME,
        roles: ['_admin', '_reader', '_writer'],
      },
      source: { url: `${DEFAULT_CHT_URL_AUTH}${source}` },
      target: { url: `${DEFAULT_CHT_URL_AUTH}${target}` },
      create_target: false,
      continuous: false,
      owner: DEFAULT_CHT_USERNAME,
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
    expect(saveDoc.notCalled).to.be.true;
    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(mockPouchSvc.streamChanges.notCalled).to.be.true;
  }));

  it('streams updates to the replication doc until the replication state is completed', run(function* () {
    const source = 'source';
    const target = 'target';
    saveDoc.returns(Effect.succeed(FAKE_RESPONSE));
    const repDocInitial = {
      user_ctx: {
        name: DEFAULT_CHT_USERNAME,
        roles: ['_admin', '_reader', '_writer'],
      },
      source: { url: `${DEFAULT_CHT_URL_AUTH}${source}` },
      target: { url: `${DEFAULT_CHT_URL_AUTH}${target}` },
      create_target: false,
      continuous: false,
      owner: DEFAULT_CHT_USERNAME,
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
    expect(saveDoc.calledOnceWithExactly(repDocInitial)).to.be.true;
    expect(mockPouchSvc.saveDoc.calledOnceWithExactly('_replicator')).to.be.true;
    expect(mockPouchSvc.streamChanges.calledOnceWithExactly('_replicator')).to.be.true;
    expect(streamChanges.calledOnceWithExactly({
      include_docs: true,
      doc_ids: [FAKE_RESPONSE.id],
    })).to.be.true;
  }));
});
