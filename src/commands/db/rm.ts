import { Args, Command, Options, Prompt } from '@effect/cli';
import { Array, Console, Effect, Either, Function, pipe } from 'effect';
import { initializeUrl } from '../../index';
import { PouchDBService } from '../../services/pouchdb';

const destroyDbs = (dbs: string[]) => pipe(
  dbs,
  Array.map(PouchDBService.get),
  Array.map(Effect.flatMap(db => Effect.promise(() => db.destroy()))),
  Effect.all,
);

const getConfirmationPrompt = (dbNames: string[]) => Prompt.confirm({
  message: `Are you sure you want to permanently remove ${Array.join(dbNames, ', ')}?`,
  initial: false,
});

const yes = Options
  .boolean('yes')
  .pipe(
    Options.withAlias('y'),
    Options.withDescription('Do not prompt for confirmation.'),
    Options.withDefault(false),
  );

const databases = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The name of the database to remove'),
    Args.atLeast(1),
  );

export const rm = Command
  .make('rm', { databases, yes }, ({ databases, yes }) => initializeUrl.pipe(
    Effect.andThen(getConfirmationPrompt(databases)
      .pipe(
        Either.liftPredicate(() => !yes, () => Effect.succeed(true)),
        Either.getOrElse(Function.identity),
      )),
    Effect.flatMap(confirmYes => destroyDbs(databases)
      .pipe(
        Either.liftPredicate(() => confirmYes, () => Console.log('Operation cancelled')),
        Either.map(Effect.tap(Console.log('Database(s) removed'))),
        Either.getOrElse(Function.identity),
      )),
  ))
  .pipe(Command.withDescription(`Remove Couch database. Nothing happens if the database does not exist.`));
