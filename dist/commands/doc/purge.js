"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purge = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const purge_1 = require("../../services/purge");
const core_1 = require("../../libs/core");
const contradictoryTypeQualifiersProvided = (opts) => (0, effect_1.pipe)([opts.all, opts.reports, effect_1.Option.isSome(opts.contacts)], effect_1.Array.filter(Boolean), effect_1.Array.length, length => length > 1);
const dateQualifiersProvidedWithoutReports = (0, effect_1.pipe)(({ before }) => effect_1.Option.isSome(before), effect_1.Predicate.or(({ since }) => effect_1.Option.isSome(since)), effect_1.Predicate.and(({ reports }) => !reports));
const assertOpts = (opts) => effect_1.Match
    .value(opts)
    .pipe(effect_1.Match.when(contradictoryTypeQualifiersProvided, () => effect_1.Effect.fail(new Error('Can only specify one of --all, --contacts, and --reports'))), effect_1.Match.when(dateQualifiersProvidedWithoutReports, () => effect_1.Effect.fail(new Error('Can only specify --before or --since when using --reports'))), effect_1.Match.orElse(() => effect_1.Effect.void));
const purgeAction = (opts) => effect_1.Match
    .value(opts)
    .pipe(effect_1.Match.when(({ reports }) => reports, ({ database, since, before }) => purge_1.PurgeService.purgeReports(database, { since, before })), effect_1.Match.when(({ contacts }) => effect_1.Option.isSome(contacts), ({ database, contacts, }) => purge_1.PurgeService.purgeContacts(database, contacts.pipe(effect_1.Option.getOrThrow))), effect_1.Match.orElse(({ database, all }) => purge_1.PurgeService.purgeAll(database, all)));
const purgeDocs = (opts) => purgeAction(opts)
    .pipe(effect_1.Effect.map(effect_1.Stream.scan(0, (acc, next) => acc + next.rows.length)), effect_1.Effect.map(effect_1.Stream.tap((count) => (0, core_1.clearThen)(effect_1.Console.log(`Purging docs: ${count.toString()}`)))), effect_1.Effect.flatMap(effect_1.Stream.run(effect_1.Sink.last())), effect_1.Effect.map(effect_1.Option.getOrThrow), effect_1.Effect.tap((count) => (0, core_1.clearThen)(effect_1.Console.log(`Purged docs: ${count.toString()}`))));
const getConfirmationPrompt = ({ database }) => cli_1.Prompt
    .confirm({
    message: `Are you sure you want to permanently purge docs from ${database}?`,
    initial: false,
});
const isPurgeConfirmed = (opts) => effect_1.Match
    .value(opts.yes)
    .pipe(effect_1.Match.when(true, () => effect_1.Effect.succeed(true)), effect_1.Match.orElse(() => getConfirmationPrompt(opts)));
const yes = cli_1.Options
    .boolean('yes')
    .pipe(cli_1.Options.withAlias('y'), cli_1.Options.withDescription('Do not prompt for confirmation'), cli_1.Options.withDefault(false));
const all = cli_1.Options
    .boolean('all')
    .pipe(cli_1.Options.withDescription('Purge everything including design documents'), cli_1.Options.withDefault(false));
const reports = cli_1.Options
    .boolean('reports')
    .pipe(cli_1.Options.withDescription('Purge docs with the data_record type'), cli_1.Options.withDefault(false));
const contacts = cli_1.Options
    .text('contacts')
    .pipe(cli_1.Options.withDescription('Purge contacts with the given contact type'), cli_1.Options.optional);
const since = cli_1.Options
    .date('since')
    .pipe(cli_1.Options.withDescription('Purge reports with a reported_date on or after the given date. Can only be used with --reports.'), cli_1.Options.optional);
const before = cli_1.Options
    .date('before')
    .pipe(cli_1.Options.withDescription('Purge reports with a reported_date before the given date. Can only be used with --reports.'), cli_1.Options.optional);
const database = cli_1.Args
    .text({ name: 'database' })
    .pipe(cli_1.Args.withDescription('The database to purge'));
exports.purge = cli_1.Command
    .make('purge', { contacts, database, yes, all, reports, before, since }, (opts) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(assertOpts(opts)), effect_1.Effect.andThen(isPurgeConfirmed(opts)), effect_1.Effect.map(confirmed => effect_1.Option.liftPredicate(purgeDocs(opts), () => confirmed)), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => effect_1.Console.log('Operation cancelled')))))
    .pipe(cli_1.Command.withDescription('Purge docs from a database. This operation is inefficient with large numbers of docs. When possible, simply ' +
    'delete and recreate the database. The results of a purge operation will NOT be replicated to client dbs, so ' +
    'any currently logged in users should be logged out and have their cache cleared to force a re-sync.'));
//# sourceMappingURL=purge.js.map