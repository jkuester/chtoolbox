"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compact = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const compact_1 = require("../../services/compact");
const compact_2 = require("../compact");
const core_1 = require("../../libs/core");
const database = cli_1.Args
    .text({ name: 'database' })
    .pipe(cli_1.Args.withDescription('The database with the design to compact'));
const designs = cli_1.Args
    .text({ name: 'design' })
    .pipe(cli_1.Args.withDescription('The design to compact'), cli_1.Args.atLeast(1));
const follow = cli_1.Options
    .boolean('follow')
    .pipe(cli_1.Options.withAlias('f'), cli_1.Options.withDescription('After triggering compaction, wait for all compacting jobs to complete.'), cli_1.Options.withDefault(false));
exports.compact = cli_1.Command
    .make('compact', { follow, database, designs }, ({ follow, database, designs }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(compact_1.CompactService.compactDesign(database)), effect_1.Effect.map(compactDesign => effect_1.Array.map(designs, compactDesign)), effect_1.Effect.flatMap(effect_1.Effect.all), effect_1.Effect.map(effect_1.Option.liftPredicate(() => follow)), effect_1.Effect.map(effect_1.Option.map(core_1.mergeArrayStreams)), effect_1.Effect.map(effect_1.Option.map(compact_2.streamActiveTasks)), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => effect_1.Console.log('Compaction started. Watch the active tasks for progress: chtx active-tasks')))))
    .pipe(cli_1.Command.withDescription(`Run compaction on one or more Couch designs`));
//# sourceMappingURL=compact.js.map