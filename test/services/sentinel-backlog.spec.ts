import { describe, it } from 'mocha';
import { Effect, Either, Layer, Option } from 'effect';
import sinon, { type SinonStub } from 'sinon';
import { PouchDBService } from '../../src/services/pouchdb.ts';
import { expect } from 'chai';
import * as SentinelBacklogSvc from '../../src/services/sentinel-backlog.ts';
import { genWithLayer, sandbox } from '../utils/base.ts';
import { ChtClientService } from '../../src/services/cht-client.ts';
import esmock from 'esmock';
import { createDbInfo } from '../utils/data-models.js';

const getDbsInfoByName = sandbox.stub();
const mockPouchSvc = {
  getDoc: sandbox.stub(),
  saveDoc: sandbox.stub(),
};

const { SentinelBacklogService } = await esmock<typeof SentinelBacklogSvc>(
  '../../src/services/sentinel-backlog.ts',
  {
    '../../src/libs/couch/dbs-info.ts': { getDbsInfoByName },
    '../../src/services/pouchdb.ts': mockPouchSvc,
  }
);
const run = SentinelBacklogService.Default.pipe(
  Layer.provide(Layer.succeed(PouchDBService, {} as unknown as PouchDBService)),
  Layer.provide(Layer.succeed(ChtClientService, {} as unknown as ChtClientService)),
  genWithLayer,
);

describe('Sentinel Backlog Service', () => {
  let getDocInner: SinonStub;
  beforeEach(() => {
    getDocInner = sinon.stub();
    mockPouchSvc.getDoc.returns(getDocInner);
  });

  it('getMedicUpdateSeq', run(function* () {
    const update_seq = '123';
    const dbInfo = createDbInfo({ key: 'medic', update_seq });
    getDbsInfoByName.returns(Effect.succeed([dbInfo]));

    const result = yield* SentinelBacklogService.getMedicUpdateSeq();

    expect(result).to.equal(update_seq);
    expect(getDbsInfoByName).to.have.been.calledOnceWithExactly(['medic']);
    expect(mockPouchSvc.getDoc).to.not.have.been.called;
    expect(mockPouchSvc.saveDoc).to.not.have.been.called;
  }));

  describe('getTransitionsSeq', () => {
    afterEach(() => {
      expect(mockPouchSvc.saveDoc).to.not.have.been.called;
      expect(mockPouchSvc.getDoc).to.have.been.calledOnceWithExactly('medic-sentinel');
      expect(getDocInner).to.have.been.calledOnceWithExactly('_local/transitions-seq');
    });

    it('returns sequence value', run(function* () {
      const value = '456';
      getDocInner.returns(Effect.succeed(Option.some({ value })));

      const result = yield* SentinelBacklogService.getTransitionsSeq();

      expect(result).to.equal(value);
    }));

    it('throws error when sequence value not found', run(function* () {
      getDocInner.returns(Effect.succeed(Option.none()));

      const either = yield* SentinelBacklogService
        .getTransitionsSeq()
        .pipe(
          Effect.catchAllDefect(Effect.fail),
          Effect.either
        );

      if (Either.isRight(either)) {
        expect.fail('Expected error to be thrown.');
      }

      expect(either.left).to.deep.include(new Error('No _local/transitions-seq doc found.'));
    }));
  });

  describe('setTransitionsSeq', () => {
    let saveDocInner: SinonStub;
    beforeEach(() => {
      saveDocInner = sinon.stub();
      mockPouchSvc.saveDoc.returns(saveDocInner);
    });

    it('returns sequence value', run(function* () {
      const value = '456';
      getDocInner.returns(Effect.succeed(Option.some({ value: '123', _rev: '1-abc' })));
      saveDocInner.returns(Effect.void);

      yield* SentinelBacklogService.setTransitionsSeq(value);

      expect(mockPouchSvc.getDoc).to.have.been.calledOnceWithExactly('medic-sentinel');
      expect(getDocInner).to.have.been.calledOnceWithExactly('_local/transitions-seq');
      expect(mockPouchSvc.saveDoc).to.have.been.calledOnceWithExactly('medic-sentinel');
      expect(saveDocInner).to.have.been.calledOnceWithExactly({ value, _rev: '1-abc' });
    }));
  });
});
