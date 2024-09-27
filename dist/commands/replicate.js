"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replicate = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../index");
const replicate_1 = require("../services/replicate");
const repSyncMessage = effect_1.Console.clear.pipe(effect_1.Effect.tap(effect_1.Console.log(`Replicating synchronously. Do not kill this process...`)));
const monitorReplication = (rep) => new Promise((resolve, reject) => {
    void rep
        .on('error', err => reject(new Error(JSON.stringify(err))))
        .on('change', info => effect_1.Effect.runSync(repSyncMessage.pipe(effect_1.Effect.tap(effect_1.Console.log(`Docs replicated: ${info.docs_written.toString()}`)))))
        .on('complete', resolve);
});
const replicateSync = (source, target) => replicate_1.ReplicateService.pipe(effect_1.Effect.tap(effect_1.Console.log(`Replicating ${source} > ${target} synchronously. Do not kill this process...`)), effect_1.Effect.flatMap(service => service.replicate(source, target)), effect_1.Effect.flatMap(rep => effect_1.Effect.promise(() => monitorReplication(rep))), effect_1.Effect.tap(repSyncMessage.pipe(effect_1.Effect.tap(effect_1.Console.log('Replication completed.')))));
const replicateAsync = (source, target) => replicate_1.ReplicateService.pipe(effect_1.Effect.flatMap(service => service.replicateAsync(source, target)), effect_1.Effect.tap(effect_1.Console.log('Replication started. Watch the active tasks for progress: chtx active-tasks')));
const async = cli_1.Options
    .boolean('async')
    .pipe(cli_1.Options.withAlias('a'), cli_1.Options.withDescription('Run the replication asynchronously. Do not wait for replication to complete.'), cli_1.Options.withDefault(false));
const source = cli_1.Args
    .text({ name: 'source' })
    .pipe(cli_1.Args.withDescription('The source database name.'));
const target = cli_1.Args
    .text({ name: 'target' })
    .pipe(cli_1.Args.withDescription('The target database name.'));
exports.replicate = cli_1.Command
    .make('replicate', { async, source, target }, ({ async, source, target }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(replicateAsync(source, target)), effect_1.Option.liftPredicate(() => async), effect_1.Option.getOrElse(() => replicateSync(source, target))))
    .pipe(cli_1.Command.withDescription(`Triggers a one-time replication from the source to the target database.`));
//# sourceMappingURL=replicate.js.map