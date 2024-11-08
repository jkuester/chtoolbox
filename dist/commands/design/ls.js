"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ls = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const design_docs_1 = require("../../services/couch/design-docs");
const dbs_info_1 = require("../../services/couch/dbs-info");
const core_1 = require("../../libs/core");
const printDesignDocNames = (dbName) => design_docs_1.CouchDesignDocsService
    .getNames(dbName)
    .pipe(effect_1.Effect.flatMap(core_1.logJson));
const getDisplayDict = (data) => effect_1.Array.reduce(data, {}, (dict, [designNames, dbName]) => effect_1.Record.set(dbName, designNames)(dict));
const printAllDesignDocNames = dbs_info_1.CouchDbsInfoService
    .getDbNames()
    .pipe(effect_1.Effect.flatMap(dbNames => (0, effect_1.pipe)(effect_1.Array.map(dbNames, design_docs_1.CouchDesignDocsService.getNames), effect_1.Effect.all, effect_1.Effect.map(effect_1.Array.zip(dbNames)), effect_1.Effect.map(getDisplayDict))), effect_1.Effect.flatMap(core_1.logJson));
const database = cli_1.Args
    .text({ name: 'database' })
    .pipe(cli_1.Args.withDescription('The database with the designs to list'), cli_1.Args.optional);
exports.ls = cli_1.Command
    .make('ls', { database }, ({ database }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(effect_1.Effect.succeed(database)), effect_1.Effect.map(effect_1.Option.map(printDesignDocNames)), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => printAllDesignDocNames))))
    .pipe(cli_1.Command.withDescription(`List designs for a Couch database`));
//# sourceMappingURL=ls.js.map