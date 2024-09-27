import { Args, Command, Options } from '@effect/cli';
import { Console, Effect, Option } from 'effect';
import { initializeUrl } from '../index';
import { ReplicateService } from '../services/replicate';

const repSyncMessage = Console.clear.pipe(
  Effect.tap(Console.log(`Replicating synchronously. Do not kill this process...`)),
);

const monitorReplication = (rep: PouchDB.Replication.Replication<object>) => new Promise((resolve, reject) => {
  void rep
    .on('error', err => reject(new Error(JSON.stringify(err))))
    .on('change', info => Effect.runSync(repSyncMessage.pipe(Effect.tap(Console.log(
      `Docs replicated: ${info.docs_written.toString()}`
    )))))
    .on('complete', resolve);
});

const replicateSync = (source: string, target: string) => ReplicateService.pipe(
  Effect.tap(Console.log(`Replicating ${source} > ${target} synchronously. Do not kill this process...`)),
  Effect.flatMap(service => service.replicate(source, target)),
  Effect.flatMap(rep => Effect.promise(() => monitorReplication(rep))),
  Effect.tap(repSyncMessage.pipe(Effect.tap(Console.log('Replication completed.')))),
);

const replicateAsync = (source: string, target: string) => ReplicateService.pipe(
  Effect.flatMap(service => service.replicateAsync(source, target)),
  Effect.tap(Console.log('Replication started. Watch the active tasks for progress: chtx active-tasks')),
);

const async = Options
  .boolean('async')
  .pipe(
    Options.withAlias('a'),
    Options.withDescription('Run the replication asynchronously. Do not wait for replication to complete.'),
    Options.withDefault(false),
  );

const source = Args
  .text({ name: 'source' })
  .pipe(Args.withDescription('The source database name.'));
const target = Args
  .text({ name: 'target' })
  .pipe(Args.withDescription('The target database name.'));

export const replicate = Command
  .make('replicate', { async, source, target }, ({ async, source, target }) => initializeUrl.pipe(
    Effect.andThen(replicateAsync(source, target)),
    Option.liftPredicate(() => async),
    Option.getOrElse(() => replicateSync(source, target)),
  ))
  .pipe(Command.withDescription(`Triggers a one-time replication from the source to the target database.`));
