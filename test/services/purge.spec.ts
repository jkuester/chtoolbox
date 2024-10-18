import { describe, it } from 'mocha';
import { Array, Chunk, Effect, Layer, Stream, TestContext } from 'effect';
import sinon, { SinonStub } from 'sinon';
import * as pouchDBService from '../../src/services/pouchdb';
import { PouchDBService } from '../../src/services/pouchdb';
import { expect } from 'chai';
import { PurgeService } from '../../src/services/purge';
import * as couchPurgeService from '../../src/services/couch/purge';
import { CouchPurgeService } from '../../src/services/couch/purge';

const FAKE_DB = { name: 'test-db' } as const;

describe('Purge Service', () => {
  let purgeFromInner: SinonStub;
  let purgeFrom: SinonStub;
  let pouchGet: SinonStub;
  let streamAllDocPagesInner: SinonStub;
  let streamAllDocPages: SinonStub;

  beforeEach(() => {
    purgeFromInner = sinon.stub().returns(Effect.void);
    purgeFrom = sinon.stub(couchPurgeService, 'purgeFrom').returns(purgeFromInner);
    pouchGet = sinon.stub().returns(Effect.succeed(FAKE_DB));
    streamAllDocPagesInner = sinon.stub();
    streamAllDocPages = sinon.stub(pouchDBService, 'streamAllDocPages').returns(streamAllDocPagesInner);
  });

  afterEach(() => sinon.restore());

  const run = (test: Effect.Effect<unknown, unknown, PurgeService | CouchPurgeService>) => async () => {
    await Effect.runPromise(test.pipe(
      Effect.provide(PurgeService.Default),
      Effect.provide(TestContext.TestContext),
      Effect.provide(Layer.succeed(PouchDBService, {
        get: pouchGet,
      } as unknown as PouchDBService),),
      Effect.provide(Layer.succeed(CouchPurgeService, {} as unknown as CouchPurgeService)),
    ));
  };

  describe('purgeAll', () => {
    it('purges all rows except ddocs', run(Effect.gen(function* () {
      const expectedResponses = [
        { rows: [{ id: '1', value: { rev: 'a' } }, { id: '_design/3', value: { rev: 'c' } }] },
        { rows: [{ id: '2', value: { rev: 'b' } }] },
        { rows: [{ id: '_design/4', value: { rev: 'd' } }] },
      ];
      streamAllDocPagesInner.returns(Stream.make(...expectedResponses));

      const stream = yield* PurgeService.purgeAll(FAKE_DB.name);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal(expectedResponses);
      expect(pouchGet.calledOnceWithExactly(FAKE_DB.name)).to.be.true;
      expect(streamAllDocPages.calledOnceWithExactly({ limit: 100, skip: 0 })).to.be.true;
      expect(streamAllDocPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(purgeFrom.args).to.deep.equal(Array.replicate([FAKE_DB.name], 3));
      expect(purgeFromInner.args).to.deep.equal([
        [[{ _id: '1', _rev: 'a' }]],
        [[{ _id: '2', _rev: 'b' }]],
      ]);
    })));

    it('purges all rows when purgeDdocs is true', run(Effect.gen(function* () {
      const expectedResponses = [
        { rows: [{ id: '1', value: { rev: 'a' } }, { id: '_design/3', value: { rev: 'c' } }] },
        { rows: [{ id: '2', value: { rev: 'b' } }] },
      ];
      streamAllDocPagesInner.returns(Stream.make(...expectedResponses));

      const stream = yield* PurgeService.purgeAll(FAKE_DB.name, true);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal(expectedResponses);
      expect(pouchGet.calledOnceWithExactly(FAKE_DB.name)).to.be.true;
      expect(streamAllDocPages.calledOnceWithExactly({ limit: 100, skip: 0 })).to.be.true;
      expect(streamAllDocPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(purgeFrom.args).to.deep.equal(Array.replicate([FAKE_DB.name], 2));
      expect(purgeFromInner.args).to.deep.equal([
        [[{ _id: '1', _rev: 'a' }, { _id: '_design/3', _rev: 'c' }]],
        [[{ _id: '2', _rev: 'b' }]],
      ]);
    })));

    it('does not purge anything if nothing is found', run(Effect.gen(function* () {
      streamAllDocPagesInner.returns(Stream.empty);

      const stream = yield* PurgeService.purgeAll(FAKE_DB.name, true);
      const pages = Chunk.toReadonlyArray(yield* Stream.runCollect(stream));

      expect(pages).to.deep.equal([]);
      expect(pouchGet.calledOnceWithExactly(FAKE_DB.name)).to.be.true;
      expect(streamAllDocPages.calledOnceWithExactly({ limit: 100, skip: 0 })).to.be.true;
      expect(streamAllDocPagesInner.calledOnceWithExactly(FAKE_DB)).to.be.true;
      expect(purgeFrom.notCalled).to.be.true;
      expect(purgeFromInner.notCalled).to.be.true;
    })));
  });
});
