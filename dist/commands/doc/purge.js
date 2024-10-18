"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purge = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const purge_1 = require("../../services/purge");
const core_1 = require("../../libs/core");
const purgeAllDocs = (dbName, purgeDdocs) => purge_1.PurgeService
    .purgeAll(dbName, purgeDdocs)
    .pipe(effect_1.Effect.map(effect_1.Stream.scan({ current: 0, total: 0 }, (acc, next) => ({
    total: acc.total || next.total_rows,
    current: (acc.total || next.total_rows) - next.total_rows,
}))), effect_1.Effect.map(effect_1.Stream.tap(({ current, total }) => (0, core_1.clearThenLog)(`Purging ${current.toString()}/${total.toString()}`))), effect_1.Effect.flatMap(effect_1.Stream.run(effect_1.Sink.last())), effect_1.Effect.map(effect_1.Option.getOrThrow), effect_1.Effect.tap(({ total }) => (0, core_1.clearThenLog)(`Purged ${total.toString()}/${total.toString()}`)));
const confirmPurge = (dbName, yes) => cli_1.Prompt
    .confirm({
    message: `Are you sure you want to permanently purge docs from ${dbName}?`,
    initial: false,
})
    .pipe(effect_1.Either.liftPredicate(() => !yes, () => effect_1.Effect.succeed(true)), effect_1.Either.getOrElse(effect_1.Function.identity));
const yes = cli_1.Options
    .boolean('yes')
    .pipe(cli_1.Options.withAlias('y'), cli_1.Options.withDescription('Do not prompt for confirmation'), cli_1.Options.withDefault(false));
const all = cli_1.Options
    .boolean('all')
    .pipe(cli_1.Options.withAlias('a'), cli_1.Options.withDescription('Purge everything including design documents'), cli_1.Options.withDefault(false));
const database = cli_1.Args
    .text({ name: 'database' })
    .pipe(cli_1.Args.withDescription('The database to purge'));
exports.purge = cli_1.Command
    .make('purge', { database, yes, all }, ({ database, yes, all }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(confirmPurge(database, yes)), effect_1.Effect.flatMap(confirmed => (0, effect_1.pipe)(effect_1.Option.liftPredicate(purgeAllDocs(database, all), () => confirmed), effect_1.Option.getOrElse(() => effect_1.Console.log('Operation cancelled'))))))
    .pipe(cli_1.Command.withDescription(`Purge docs from a database`));
//# sourceMappingURL=purge.js.map