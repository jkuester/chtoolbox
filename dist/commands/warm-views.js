"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warmViews = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../index");
const warm_views_1 = require("../services/warm-views");
const designsCurrentlyUpdating = warm_views_1.WarmViewsService.pipe(effect_1.Effect.flatMap(service => service.designsCurrentlyUpdating()), effect_1.Effect.map(effect_1.Array.map(({ dbName, designId }) => `${dbName}/${designId}`)), effect_1.Effect.tap(effect_1.Console.log('Designs currently updating:')), effect_1.Effect.tap(effect_1.Console.log));
let noViewsWarmingCount = 0;
const viewWarmingComplete = (designsUpdating) => (0, effect_1.pipe)(designsUpdating, effect_1.Array.length, effect_1.Option.liftPredicate(length => length === 0), effect_1.Option.map(() => noViewsWarmingCount += 1), effect_1.Option.getOrElse(() => noViewsWarmingCount = 0), count => count === 3);
const repeatSchedule = effect_1.Schedule
    .recurUntil(viewWarmingComplete)
    .pipe(effect_1.Schedule.delayed(() => 1000));
const followIndexing = effect_1.Effect
    .repeat(designsCurrentlyUpdating, repeatSchedule)
    .pipe(effect_1.Effect.tap(effect_1.Console.log('View warming complete.')));
const follow = cli_1.Options
    .boolean('follow')
    .pipe(cli_1.Options.withAlias('f'), cli_1.Options.withDescription('After triggering warming, wait for all indexing jobs to complete.'), cli_1.Options.withDefault(false));
exports.warmViews = cli_1.Command
    .make('warm-views', { follow }, ({ follow }) => (0, effect_1.pipe)(index_1.initializeUrl, effect_1.Effect.tap(effect_1.Console.log('Warming views...')), effect_1.Effect.andThen(effect_1.Effect.flatMap(warm_views_1.WarmViewsService, warmViewsService => warmViewsService.warmAll())), effect_1.Effect.andThen(() => followIndexing.pipe(effect_1.Option.liftPredicate(() => follow), effect_1.Option.getOrElse(() => effect_1.Console.log('View warming started. Watch the active tasks for progress: chtx active-tasks'))))))
    .pipe(cli_1.Command.withDescription(`Warm all view indexes.`));
//# sourceMappingURL=warm-views.js.map