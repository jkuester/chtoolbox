"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warmViews = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../index");
const warm_views_1 = require("../services/warm-views");
const designsCurrentlyUpdating = warm_views_1.WarmViewsService.pipe(effect_1.Effect.delay(1000), effect_1.Effect.flatMap(service => service.designsCurrentlyUpdating()), effect_1.Effect.map(effect_1.Array.map(({ dbName, designId }) => `${dbName}/${designId}`)), effect_1.Effect.tap(effect_1.Console.log('Designs currently updating:')), effect_1.Effect.tap(effect_1.Console.log));
let noViewsWarmingCount = 0;
const viewWarmingComplete = (designsUpdating) => (0, effect_1.pipe)(designsUpdating, effect_1.Array.length, effect_1.Option.liftPredicate(length => length === 0), effect_1.Option.map(() => noViewsWarmingCount += 1), effect_1.Option.getOrElse(() => noViewsWarmingCount = 0), count => count === 3);
exports.warmViews = cli_1.Command
    .make('warm-views', {}, () => (0, effect_1.pipe)(index_1.initializeUrl, effect_1.Effect.tap(effect_1.Console.log('Warming views...')), effect_1.Effect.andThen(warm_views_1.WarmViewsService), effect_1.Effect.flatMap(warmViewsService => warmViewsService.warmAll()), effect_1.Effect.andThen(effect_1.Effect.repeat(designsCurrentlyUpdating, { until: viewWarmingComplete })), effect_1.Effect.tap(effect_1.Console.log('View warming complete.'))))
    .pipe(cli_1.Command.withDescription(`Warm all view indexes.`));
//# sourceMappingURL=warm-views.js.map