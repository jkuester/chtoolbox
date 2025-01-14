"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rm = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const pouchdb_1 = require("../../services/pouchdb");
const destroyDbs = (dbs) => (0, effect_1.pipe)(dbs, effect_1.Array.map(pouchdb_1.PouchDBService.get), effect_1.Array.map(effect_1.Effect.flatMap(db => effect_1.Effect.promise(() => db.destroy()))), effect_1.Effect.all, effect_1.Effect.tap(effect_1.Console.log('Database(s) removed')));
const getConfirmationPrompt = (dbNames) => cli_1.Prompt.confirm({
    message: `Are you sure you want to permanently remove ${effect_1.Array.join(dbNames, ', ')}?`,
    initial: false,
});
const isRemoveConfirmed = (dbNames, yes) => effect_1.Match
    .value(yes)
    .pipe(effect_1.Match.when(true, () => effect_1.Effect.succeed(true)), effect_1.Match.orElse(() => getConfirmationPrompt(dbNames)));
const yes = cli_1.Options
    .boolean('yes')
    .pipe(cli_1.Options.withAlias('y'), cli_1.Options.withDescription('Do not prompt for confirmation.'));
const databases = cli_1.Args
    .text({ name: 'database' })
    .pipe(cli_1.Args.withDescription('The name of the database to remove'), cli_1.Args.atLeast(1));
exports.rm = cli_1.Command
    .make('rm', { databases, yes }, ({ databases, yes }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(isRemoveConfirmed(databases, yes)), effect_1.Effect.map(removeConfirmed => effect_1.Option.liftPredicate(destroyDbs(databases), () => removeConfirmed)), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => effect_1.Console.log('Operation cancelled')))))
    .pipe(cli_1.Command.withDescription(`Remove Couch database. Nothing happens if the database does not exist.`));
//# sourceMappingURL=rm.js.map