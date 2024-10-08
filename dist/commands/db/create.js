"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const pouchdb_1 = require("../../services/pouchdb");
const getPouchDB = (dbName) => effect_1.Effect.flatMap(pouchdb_1.PouchDBService, svc => svc.get(dbName));
const createDbs = (dbs) => (0, effect_1.pipe)(dbs, effect_1.Array.map(getPouchDB), effect_1.Effect.all);
const databases = cli_1.Args
    .text({ name: 'database' })
    .pipe(cli_1.Args.withDescription('The name of the database to create'), cli_1.Args.atLeast(1));
exports.create = cli_1.Command
    .make('create', { databases }, ({ databases }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(createDbs(databases)), effect_1.Effect.map(effect_1.Array.map(db => effect_1.Effect.promise(() => db.info()))), effect_1.Effect.flatMap(effect_1.Effect.all), effect_1.Effect.tap(effect_1.Console.log)))
    .pipe(cli_1.Command.withDescription(`Create new Couch database. Nothing happens if the database already exists.`));
//# sourceMappingURL=create.js.map