import { Args, Command, Options, Prompt } from '@effect/cli';
import { Array, Console, Effect, Option, pipe } from 'effect';
import { PouchDBService } from '../../services/pouchdb.ts';

const destroyDbs = Effect.fn((dbs: string[]): Effect.Effect<void, Error, PouchDBService> => pipe(
  dbs,
  Array.map(PouchDBService.get),
  Array.map(Effect.flatMap(db => Effect.promise(() => db.destroy()))),
  Effect.allWith({ concurrency: 'unbounded' }),
  Effect.tap(Console.log('Database(s) removed')),
));

const getConfirmationPrompt = (dbNames: string[]) => Prompt.confirm({
  message: `Are you sure you want to permanently remove ${Array.join(dbNames, ', ')}?`,
  initial: false,
});

const isRemoveConfirmed = Effect.fn((dbNames: string[], yes: boolean) => Effect
  .succeed(true)
  .pipe(Effect.filterOrElse(
    () => yes,
    () => getConfirmationPrompt(dbNames),
  )));

const yes = Options
  .boolean('yes')
  .pipe(
    Options.withAlias('y'),
    Options.withDescription('Do not prompt for confirmation.'),
  );

const databases = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The name of the database to remove'),
    Args.atLeast(1),
  );

export const rm = Command
  .make('rm', { databases, yes }, Effect.fn(({ databases, yes }) => pipe(
    isRemoveConfirmed(databases, yes),
    Effect.map(removeConfirmed => Option.liftPredicate(destroyDbs(databases), () => removeConfirmed)),
    Effect.flatMap(Option.getOrElse(() => Console.log('Operation cancelled'))),
  )))
  .pipe(Command.withDescription(`Remove Couch database. Nothing happens if the database does not exist.`));
