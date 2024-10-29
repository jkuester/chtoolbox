import { Args, Command, Options, Prompt } from '@effect/cli';
import { Console, Effect, Either, Function, Match, Option, pipe, Sink, Stream } from 'effect';
import { initializeUrl } from '../../index';
import { PurgeService } from '../../services/purge';
import { clearThen } from '../../libs/core';

const assertOpts = (opts: PurgeOptions) => Match
  .value(opts)
  .pipe(
    Match.when(
      ({ all, contacts, reports }) => [all, reports, Option.isSome(contacts)]
        .filter(Boolean)
        .length > 1,
      () => Effect.fail(new Error('Cannot specify one of --all --contacts, and --reports'))
    ),
    Match.when(
      ({
        before, since, reports
      }) => !reports && (Option.isSome(before) || Option.isSome(since)),
      () => Effect.fail(new Error('Can only specify --before or --since when using --reports'))
    ),
    Match.orElse(() => Effect.void),
  );

const purgeAction = (opts: PurgeOptions) => Match
  .value(opts)
  .pipe(
    Match.when(
      ({ reports }) => reports,
      ({ database, since, before }) => PurgeService.purgeReports(database, { since, before })
    ),
    Match.when(
      ({ contacts }) => Option.isSome(contacts),
      ({ database, contacts, }) => PurgeService
        .purgeContacts(database, contacts.pipe(Option.getOrThrow))
    ),
    Match.orElse(({ database, all }) => PurgeService.purgeAll(database, all)),
  );

const purgeDocs = (opts: PurgeOptions) => purgeAction(opts)
  .pipe(
    Effect.map(Stream.scan(0, (acc, next) => acc + next.rows.length)),
    Effect.map(Stream.tap((count) => clearThen(Console.log(`Purging docs: ${count.toString()}`)))),
    Effect.flatMap(Stream.run(Sink.last())),
    Effect.map(Option.getOrThrow),
    Effect.tap((count) => clearThen(Console.log(`Purged docs: ${count.toString()}`))),
  );

const confirmPurge = ({ database, yes }: PurgeOptions) => Prompt
  .confirm({
    message: `Are you sure you want to permanently purge docs from ${database}?`,
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
    Options.withDescription('Do not prompt for confirmation'),
    Options.withDefault(false),
  );

const all = Options
  .boolean('all')
  .pipe(
    Options.withDescription('Purge everything including design documents'),
    Options.withDefault(false),
  );

const reports = Options
  .boolean('reports')
  .pipe(
    Options.withDescription('Purge docs with the data_record type'),
    Options.withDefault(false),
  );

const contacts = Options
  .text('contacts')
  .pipe(
    Options.withDescription('Purge contacts with the given contact type'),
    Options.optional,
  );

const since = Options
  .date('since')
  .pipe(
    Options.withDescription(
      'Purge reports with a reported_date on or after the given date. Can only be used with --reports.'
    ),
    Options.optional,
  );
const before = Options
  .date('before')
  .pipe(
    Options.withDescription(
      'Purge reports with a reported_date before the given date. Can only be used with --reports.'
    ),
    Options.optional,
  );

const database = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The database to purge'),
  );

interface PurgeOptions {
  readonly database: string,
  readonly yes: boolean,
  readonly all: boolean,
  readonly reports: boolean,
  readonly contacts: Option.Option<string>,
  readonly since: Option.Option<Date>,
  readonly before: Option.Option<Date>
}

export const purge = Command
  .make('purge', { contacts, database, yes, all, reports, before, since }, (opts: PurgeOptions) => initializeUrl.pipe(
    Effect.andThen(assertOpts(opts)),
    Effect.andThen(confirmPurge(opts)),
    Effect.flatMap(confirmed => pipe(
      Option.liftPredicate(purgeDocs(opts), () => confirmed),
      Option.getOrElse(() => Console.log('Operation cancelled')),
    )),
  ))
  .pipe(Command.withDescription(
    'Purge docs from a database. This operation is inefficient with large numbers of docs. When possible, simply ' +
    'delete and recreate the database. The results of a purge operation will NOT be replicated to client dbs, so ' +
    'any currently logged in users should be logged out and have their cache cleared to force a re-sync.'
  ));
