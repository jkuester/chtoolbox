"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replicate = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../index");
const replicate_1 = require("../services/replicate");
const replicateSync = (source, target) => replicate_1.ReplicateService.pipe(effect_1.Effect.tap(effect_1.Console.log(`Replicating ${source} > ${target} synchronously. Do not kill this process...`)), effect_1.Effect.flatMap(service => service.replicate(source, target)), effect_1.Effect.tap(effect_1.Console.log('Replication complete!')));
const replicateAsync = (source, target) => replicate_1.ReplicateService.pipe(effect_1.Effect.tap(effect_1.Console.log(`Replicating ${source} > ${target} asynchronously...`)), effect_1.Effect.flatMap(service => service.replicateAsync(source, target)), effect_1.Effect.tap(effect_1.Console.log('Replication started. Watch the active tasks for progress: chtx active-tasks')));
const follow = cli_1.Options
    .boolean('follow')
    .pipe(cli_1.Options.withAlias('f'), cli_1.Options.withDescription('Run the replication synchronously.'), cli_1.Options.withDefault(false));
const source = cli_1.Args
    .text({ name: 'source' })
    .pipe(cli_1.Args.withDescription('The source database name.'));
const target = cli_1.Args
    .text({ name: 'target' })
    .pipe(cli_1.Args.withDescription('The target database name.'));
exports.replicate = cli_1.Command
    .make('replicate', { follow, source, target }, ({ follow, source, target }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(replicateSync(source, target)), effect_1.Option.liftPredicate(() => follow), effect_1.Option.getOrElse(() => replicateAsync(source, target))))
    .pipe(cli_1.Command.withDescription(`Triggers a one-time replication from the source to the target database.`));
//# sourceMappingURL=replicate.js.map