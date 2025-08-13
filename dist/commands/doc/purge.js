import { Args, Command, Options, Prompt } from '@effect/cli';
import { Array, Console, Effect, Match, Option, pipe, Predicate, Sink, Stream } from 'effect';
import { initializeUrl } from "../../index.js";
import { PurgeService } from "../../services/purge.js";
import { clearThen } from "../../libs/console.js";
const contradictoryTypeQualifiersProvided = (opts) => pipe([opts.all, opts.reports, Option.isSome(opts.contacts)], Array.filter(Boolean), Array.length, length => length > 1);
const dateQualifiersProvidedWithoutReports = pipe(({ before }) => Option.isSome(before), Predicate.or(({ since }) => Option.isSome(since)), Predicate.and(({ reports }) => !reports));
const assertOpts = Effect.fn((opts) => Match
    .value(opts)
    .pipe(Match.when(contradictoryTypeQualifiersProvided, () => Effect.fail(new Error('Can only specify one of --all, --contacts, and --reports'))), Match.when(dateQualifiersProvidedWithoutReports, () => Effect.fail(new Error('Can only specify --before or --since when using --reports'))), Match.orElse(() => Effect.void)));
const purgeAction = Effect.fn((opts) => Match
    .value(opts)
    .pipe(Match.when(({ reports }) => reports, ({ database, since, before }) => PurgeService.purgeReports(database, { since, before })), Match.when(({ contacts }) => Option.isSome(contacts), ({ database, contacts, }) => PurgeService.purgeContacts(database, contacts.pipe(Option.getOrThrow))), Match.orElse(({ database, all }) => PurgeService.purgeAll(database, all))));
const purgeDocs = Effect.fn((opts) => purgeAction(opts)
    .pipe(Effect.map(Stream.scan(0, (acc, next) => acc + next.rows.length)), Effect.map(Stream.tap((count) => clearThen(Console.log(`Purging docs: ${count.toString()}`)))), Effect.flatMap(Stream.run(Sink.last())), Effect.map(Option.getOrThrow), Effect.tap((count) => clearThen(Console.log(`Purged docs: ${count.toString()}`)))));
const getConfirmationPrompt = ({ database }) => Prompt
    .confirm({
    message: `Are you sure you want to permanently purge docs from ${database}?`,
    initial: false,
});
const isPurgeConfirmed = Effect.fn((opts) => Effect
    .succeed(true)
    .pipe(Effect.filterOrElse(() => opts.yes, () => getConfirmationPrompt(opts))));
const yes = Options
    .boolean('yes')
    .pipe(Options.withAlias('y'), Options.withDescription('Do not prompt for confirmation'));
const all = Options
    .boolean('all')
    .pipe(Options.withDescription('Purge everything including design documents'));
const reports = Options
    .boolean('reports')
    .pipe(Options.withDescription('Purge docs with the data_record type'));
const contacts = Options
    .text('contacts')
    .pipe(Options.withDescription('Purge contacts with the given contact type'), Options.optional);
const since = Options
    .date('since')
    .pipe(Options.withDescription('Purge reports with a reported_date on or after the given date. Can only be used with --reports.'), Options.optional);
const before = Options
    .date('before')
    .pipe(Options.withDescription('Purge reports with a reported_date before the given date. Can only be used with --reports.'), Options.optional);
const database = Args
    .text({ name: 'database' })
    .pipe(Args.withDescription('The database to purge'));
export const purge = Command
    .make('purge', { contacts, database, yes, all, reports, before, since }, Effect.fn((opts) => initializeUrl.pipe(Effect.andThen(assertOpts(opts)), Effect.andThen(isPurgeConfirmed(opts)), Effect.map(confirmed => Option.liftPredicate(purgeDocs(opts), () => confirmed)), Effect.flatMap(Option.getOrElse(() => Console.log('Operation cancelled'))))))
    .pipe(Command.withDescription('Purge docs from a database. This operation is inefficient with large numbers of docs. When possible, simply ' +
    'delete and recreate the database. The results of a purge operation will NOT be replicated to client dbs, so ' +
    'any currently logged in users should be logged out and have their cache cleared to force a re-sync.'));
