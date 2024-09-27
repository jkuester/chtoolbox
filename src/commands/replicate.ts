import { Args, Command, Options } from '@effect/cli';
import { Console, Effect, Option } from 'effect';
import { initializeUrl } from '../index';
import { ReplicateService } from '../services/replicate';

const replicateSync = (source: string, target: string) => ReplicateService.pipe(
  Effect.tap(Console.log(`Replicating ${source} > ${target} synchronously. Do not kill this process...`)),
  Effect.flatMap(service => service.replicate(source, target)),
  Effect.tap(Console.log('Replication complete!')),
);

const replicateAsync = (source: string, target: string) => ReplicateService.pipe(
  Effect.tap(Console.log(`Replicating ${source} > ${target} asynchronously...`)),
  Effect.flatMap(service => service.replicateAsync(source, target)),
  Effect.tap(Console.log('Replication started. Watch the active tasks for progress: chtx active-tasks')),
);

const follow = Options
  .boolean('follow')
  .pipe(
    Options.withAlias('f'),
    Options.withDescription('Run the replication synchronously.'),
    Options.withDefault(false),
  );

const source = Args
  .text({ name: 'source' })
  .pipe(Args.withDescription('The source database name.'));
const target = Args
  .text({ name: 'target' })
  .pipe(Args.withDescription('The target database name.'));

export const replicate = Command
  .make('replicate', { follow, source, target }, ({ follow, source, target }) => initializeUrl.pipe(
    Effect.andThen(replicateSync(source, target)),
    Option.liftPredicate(() => follow),
    Option.getOrElse(() => replicateAsync(source, target)),
  ))
  .pipe(Command.withDescription(`Triggers a one-time replication from the source to the target database.`));
