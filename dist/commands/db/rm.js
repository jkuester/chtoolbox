"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rm = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const pouchdb_1 = require("../../services/pouchdb");
const getPouchDB = (dbName) => effect_1.Effect.flatMap(pouchdb_1.PouchDBService, svc => svc.get(dbName));
const destroyDbs = (dbs) => (0, effect_1.pipe)(dbs, effect_1.Array.map(getPouchDB), effect_1.Array.map(effect_1.Effect.flatMap(db => effect_1.Effect.promise(() => db.destroy()))), effect_1.Effect.all);
const getConfirmationPrompt = (dbNames) => cli_1.Prompt.confirm({
    message: `Are you sure you want to permanently remove ${effect_1.Array.join(dbNames, ', ')}?`,
    initial: false,
});
const yes = cli_1.Options
    .boolean('yes')
    .pipe(cli_1.Options.withAlias('y'), cli_1.Options.withDescription('Do not prompt for confirmation.'), cli_1.Options.withDefault(false));
const databases = cli_1.Args
    .text({ name: 'database' })
    .pipe(cli_1.Args.withDescription('The name of the database to remove'), cli_1.Args.atLeast(1));
exports.rm = cli_1.Command
    .make('rm', { databases, yes }, ({ databases, yes }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(getConfirmationPrompt(databases)
    .pipe(effect_1.Either.liftPredicate(() => !yes, () => effect_1.Effect.succeed(true)), effect_1.Either.getOrElse(effect_1.Function.identity))), effect_1.Effect.flatMap(confirmYes => destroyDbs(databases)
    .pipe(effect_1.Either.liftPredicate(() => confirmYes, () => effect_1.Console.log('Operation cancelled')), effect_1.Either.map(effect_1.Effect.tap(effect_1.Console.log('Database(s) removed'))), effect_1.Either.getOrElse(effect_1.Function.identity)))))
    .pipe(cli_1.Command.withDescription(`Remove Couch database. Nothing happens if the database does not exist.`));
//# sourceMappingURL=rm.js.map