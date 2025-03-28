import { Args, Command, Options } from '@effect/cli';
import { Array, Console, Effect, Option, pipe, Predicate, Stream } from 'effect';
import { initializeUrl } from '../../index.js';
import { ReplicateService } from '../../services/replicate.js';
import { streamActiveTasks } from '../../libs/couch/active-tasks.js';
import { clearThen } from '../../libs/console.js';
const DB_SPECIFIER_DESCRIPTION = `This can either be a database name for the current instance (e.g. 'medic') `
    + `or a full URL to a remote Couch database (including username/password). `
    + `E.g. 'https://medic:password@192-168-1-80.local-ip.medicmobile.org:38593/medic'`;
const isRepTask = (id) => pipe(({ type }) => type === 'replication', Predicate.and(({ doc_id }) => doc_id === id), Predicate.and(({ docs_written }) => docs_written !== undefined));
const printReplicatingDocs = (id) => (tasks) => pipe(tasks, Array.findFirst(isRepTask(id)), Option.map(({ docs_written }) => docs_written?.toString() ?? ''), Option.map(docs_written => clearThen(Console.log(`Replicating docs: ${docs_written}`))), Option.getOrElse(() => Effect.void), Effect.tap(Effect.logDebug('Printed replication doc task')));
const streamReplicationTasks = (id) => streamActiveTasks()
    .pipe(Stream.tap(printReplicatingDocs(id)), Stream.runDrain);
const getReplicationDocId = (completionStream) => Stream
    .take(completionStream, 1)
    .pipe(Stream.runHead, Effect.map(Option.getOrThrow), Effect.map(({ _id }) => _id));
const watchReplication = (completionStream) => Stream
    .runDrain(completionStream)
    .pipe(Effect.race(getReplicationDocId(completionStream)
    .pipe(Effect.flatMap(streamReplicationTasks))));
const follow = Options
    .boolean('follow')
    .pipe(Options.withAlias('f'), Options.withDescription('After triggering replication, wait for job to complete.'));
const all = Options
    .boolean('all')
    .pipe(Options.withDescription('Replicate everything including design documents'));
const contacts = Options
    .text('contacts')
    .pipe(Options.withAlias('c'), Options.withDescription('Replicate contacts with the given contact type'), Options.atLeast(0));
const source = Args
    .text({ name: 'source' })
    .pipe(Args.withDescription(`The replication source. ${DB_SPECIFIER_DESCRIPTION}`));
const target = Args
    .text({ name: 'target' })
    .pipe(Args.withDescription(`The replication target. ${DB_SPECIFIER_DESCRIPTION}`));
export const replicate = Command
    .make('replicate', { follow, contacts, source, target, all }, ({ follow, contacts, source, target, all }) => initializeUrl.pipe(Effect.andThen(ReplicateService.replicate(source, target, {
    includeDdocs: all,
    contactTypes: contacts
})), Effect.map(completionStream => Option.liftPredicate(completionStream, () => follow)), Effect.map(Option.map(watchReplication)), Effect.flatMap(Option.getOrElse(() => Console.clear.pipe(Effect.andThen(Console.log('Replication started. Watch the active tasks for progress: chtx active-tasks -f')))))))
    .pipe(Command.withDescription('Triggers a one-time server-side replication of the docs from the source to the target database.'));
//# sourceMappingURL=replicate.js.map