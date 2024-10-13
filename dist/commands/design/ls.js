"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ls = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const design_docs_1 = require("../../services/couch/design-docs");
const dbs_info_1 = require("../../services/couch/dbs-info");
const getDesignDocNames = (dbName) => design_docs_1.CouchDesignDocsService.pipe(effect_1.Effect.flatMap(designDocsService => designDocsService.getNames(dbName)));
const printDesignDocNames = (dbName) => getDesignDocNames(dbName)
    .pipe(effect_1.Effect.map(d => JSON.stringify(d, null, 2)), effect_1.Effect.flatMap(effect_1.Console.log));
const getDisplayDict = (data) => effect_1.Array.reduce(data, {}, (dict, [designNames, dbName]) => effect_1.Record.set(dbName, designNames)(dict));
const printAllDesignDocNames = effect_1.Effect
    .flatMap(dbs_info_1.CouchDbsInfoService, svc => svc.getDbNames())
    .pipe(effect_1.Effect.flatMap(dbNames => (0, effect_1.pipe)(effect_1.Array.map(dbNames, getDesignDocNames), effect_1.Effect.all, effect_1.Effect.map(effect_1.Array.zip(dbNames)), effect_1.Effect.map(getDisplayDict))), effect_1.Effect.map(d => JSON.stringify(d, null, 2)), effect_1.Effect.flatMap(effect_1.Console.log));
const database = cli_1.Args
    .text({ name: 'database' })
    .pipe(cli_1.Args.withDescription('The database with the designs to list'), cli_1.Args.optional);
exports.ls = cli_1.Command
    .make('ls', { database }, ({ database }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(effect_1.Effect.succeed(database)), effect_1.Effect.map(effect_1.Option.map(printDesignDocNames)), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => printAllDesignDocNames))))
    .pipe(cli_1.Command.withDescription(`List designs for a Couch database`));
//# sourceMappingURL=ls.js.map