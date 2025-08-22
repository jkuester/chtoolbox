import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { getDoc, PouchDBService, saveDoc } from './pouchdb.ts';
import { Array, Option, pipe, Record, Schema } from 'effect';
import { ChtClientService } from './cht-client.ts';
import { getDbsInfoByName } from '../libs/couch/dbs-info.ts';
import { mapErrorToGeneric } from '../libs/core.ts';

class LocalTransitionsSeq extends Schema.Class<LocalTransitionsSeq>('LocalTransitionsSeq')({
  value: Schema.String,
}) {
}

const medicUpdateSeqEffect = Effect.suspend(() => pipe(
  getDbsInfoByName(['medic']),
  Effect.map(Array.unsafeGet(0)),
  Effect.map(({ info }) => info.update_seq),
  Effect.tap(updateSeq => Effect.logDebug(`medic update_seq: ${updateSeq}`)),
));

const localTransitionsSeqEffect = Effect.suspend( () => pipe(
  '_local/transitions-seq',
  getDoc('medic-sentinel'),
  Effect.map(Option.flatMap(Schema.decodeUnknownOption(LocalTransitionsSeq, { onExcessProperty: 'preserve' }))),
  Effect.map(Option.getOrThrowWith(() => new Error('No _local/transitions-seq doc found.'))),
  Effect.tap(seq => Effect.logDebug(`local transitions seq: ${seq.value}`)),
));

const setLocalTransitionsSeq = Effect.fn((value: string) => pipe(
  localTransitionsSeqEffect,
  Effect.map(Record.set('value', value)),
  Effect.flatMap(saveDoc('medic-sentinel')),
  Effect.tap(() => Effect.logDebug(`Local transitions seq updated to ${value}`)),
));

const serviceContext = Effect
  .all([
    ChtClientService,
    PouchDBService,
  ])
  .pipe(Effect.map(([
    chtClient,
    pouch,
  ]) => Context
    .make(PouchDBService, pouch)
    .pipe(Context.add(ChtClientService, chtClient))));

export class SentinelBacklogService extends Effect.Service<SentinelBacklogService>()(
  'chtoolbox/SentinelBacklogService',
  {
    effect: serviceContext.pipe(Effect.map(context => ({
      getMedicUpdateSeq: (): Effect.Effect<string, Error> => pipe(
        medicUpdateSeqEffect,
        mapErrorToGeneric,
        Effect.provide(context),
      ),
      getTransitionsSeq: (): Effect.Effect<string, Error> => pipe(
        localTransitionsSeqEffect,
        Effect.map(({ value }) => value),
        Effect.provide(context),
      ),
      setTransitionsSeq: (value: string): Effect.Effect<void, Error> => pipe(
        setLocalTransitionsSeq(value),
        Effect.mapError(x => x as unknown as Error),
        Effect.asVoid,
        Effect.provide(context),
      ),
    }))),
    accessors: true,
  }
) {
}
