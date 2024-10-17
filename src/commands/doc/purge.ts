import { Args, Command, Options, Prompt } from '@effect/cli';
import { Console, Effect, Either, Function, Option, pipe, Sink, Stream } from 'effect';
import { initializeUrl } from '../../index';
import { PurgeService } from '../../services/purge';

const clearLog = (...args: readonly unknown[]) => Console.clear.pipe(Effect.tap(Console.log(...args)));

const purgeAllDocs = (dbName: string) => PurgeService
  .purgeAll(dbName)
  .pipe(
    Effect.map(Stream.scan({ current: 0, total: 0 }, (acc, next) => ({
      total: acc.total || next.total_rows,
      current: (acc.total || next.total_rows) - next.total_rows,
    }))),
    Effect.map(Stream.tap(({ current, total }) => clearLog(`Purging ${current.toString()}/${total.toString()}`))),
    Effect.flatMap(Stream.run(Sink.last())),
    Effect.map(Option.getOrThrow),
    Effect.tap(({ total }) => clearLog(`Purged ${total.toString()}/${total.toString()}`)),
  );

const confirmPurge = (dbName: string, yes: boolean) => Prompt
  .confirm({
    message: `Are you sure you want to permanently purge docs from ${dbName}?`,
    initial: false,
  })
  .pipe(
    Either.liftPredicate(
      () => !yes,
      () => Effect.succeed(true)
    ),
    Either.getOrElse(Function.identity),
  );

const yes = Options
  .boolean('yes')
  .pipe(
    Options.withAlias('y'),
    Options.withDescription('Do not prompt for confirmation.'),
    Options.withDefault(false),
  );

const database = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The database to purge'),
  );

export const purge = Command
  .make('purge', { database, yes }, ({ database, yes }) => initializeUrl.pipe(
    Effect.andThen(confirmPurge(database, yes)),
    Effect.flatMap(confirmed => pipe(
      Option.liftPredicate(purgeAllDocs(database), () => confirmed),
      Option.getOrElse(() => Console.log('Operation cancelled')),
    )),
  ))
  .pipe(Command.withDescription(`Purge docs from a database`));
