import { Command } from '@effect/cli';
import { Console, Effect, Number, Option, pipe, String, Tuple } from 'effect';
import { initializeUrl } from '../../index.ts';
import { SentinelBacklogService } from '../../services/sentinel-backlog.js';
import { color } from '../../libs/console.js';

const getBacklog = (sequenceData: [string, string]) => pipe(
  sequenceData,
  Tuple.map(String.split('-')),
  Tuple.map(Tuple.at(0)),
  Tuple.map(Number.parse),
  Tuple.map(Option.getOrElse(() => NaN)),
  ([transSeq, updateSeq]) => updateSeq - transSeq,
  backlog => backlog.toString()
);

const logInfo = (sequenceData: [string, string]) => pipe(
  sequenceData,
  Tuple.map(color('green')),
  ([transSeq, updateSeq]) => Console.log(`
Sentinel Backlog: ${pipe(getBacklog(sequenceData), color('blue'))}
Transitions seq: ${transSeq}
Medic update seq: ${updateSeq}
  `),
);

export const ls = Command
  .make('ls', {}, () => initializeUrl.pipe(
    Effect.andThen(Effect.all([
      SentinelBacklogService.getTransitionsSeq(),
      SentinelBacklogService.getMedicUpdateSeq()
    ], { concurrency: 'unbounded' })),
    Effect.flatMap(logInfo),
  ))
  .pipe(Command.withDescription(`List current Sentinel backlog details.`));
