import { Args, Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option, Schedule } from 'effect';
import { initializeUrl } from '../../index';
import { ReplicateService, ReplicationDoc } from '../../services/replicate';
import { CouchActiveTask, CouchActiveTasksService } from '../../services/couch/active-tasks';

const logReplicationMessage = Console.clear.pipe(Effect.andThen(Console.log(`Replicating...`)));

const isRepTask = (id: string) => (
  task: CouchActiveTask
): task is CouchActiveTask & { docs_written: number } => task.type === 'replication'
  && task.doc_id === id
  && task.docs_written !== undefined;

const printActiveTasks = (id: string) => CouchActiveTasksService
  .get()
  .pipe(
    Effect.map(Array.findFirst(isRepTask(id))),
    Effect.map(Option.map(task => logReplicationMessage
      .pipe(Effect.andThen(Console.log(`Replicating docs: ${task.docs_written.toString()}`))))),
    Effect.flatMap(Option.getOrElse(() => Effect.void)),
  );

const pollActiveTasks = (id: string) => Effect.repeat(printActiveTasks(id), Schedule.spaced(1000));

const waitForCompletedRep = (
  changesFeed: PouchDB.Core.Changes<ReplicationDoc>
): Effect.Effect<void> => Effect.async((resume) => void changesFeed
  .on('error', err => resume(Console.log(`Replication failed: ${JSON.stringify(err)}`)))
  .on('complete', resp => resume(
    Console.log(`Could not follow replication doc changes feed: ${JSON.stringify(resp)}`)
  ))
  .on('change', ({ doc }) => Option
    .fromNullable(doc)
    .pipe(
      Option.flatMap(Option.liftPredicate(doc => doc._replication_state === 'completed')),
      Option.map(() => Console.clear.pipe(Effect.tap(Console.log('Replication complete')))),
      Option.getOrElse(() => Console.log(`Replication failed: ${JSON.stringify(doc)}`)),
      Effect.tap(() => changesFeed.cancel()),
      resume,
    )));

const watchReplication = ({ id }: PouchDB.Core.Response) => ReplicateService
  .watch(id)
  .pipe(
    Effect.flatMap(waitForCompletedRep),
    Effect.race(pollActiveTasks(id)),
  );

const follow = Options
  .boolean('follow')
  .pipe(
    Options.withAlias('f'),
    Options.withDescription('After triggering replication, wait for job to complete.'),
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
    Effect.tap(logReplicationMessage),
    Effect.andThen(ReplicateService.replicate(source, target)),
    Effect.map(resp => Option.liftPredicate(resp, () => follow)),
    Effect.map(Option.map(watchReplication)),
    Effect.flatMap(Option.getOrElse(() => Console.clear.pipe(
      Effect.andThen(Console.log('Replication started. Watch the active tasks for progress: chtx active-tasks'))
    ))),
  ))
  .pipe(Command.withDescription(`Triggers a one-time replication from the source to the target database.`));
