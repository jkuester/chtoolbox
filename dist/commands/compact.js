"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compact = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../index");
const compact_1 = require("../services/compact");
const currentlyCompacting = compact_1.CompactService.pipe(effect_1.Effect.delay(1000), effect_1.Effect.flatMap(service => service.currentlyCompacting), effect_1.Effect.tap(effect_1.Console.log('Currently compacting:')), effect_1.Effect.tap(effect_1.Console.log));
let noCompactingCount = 0;
const compactingComplete = (compacting) => (0, effect_1.pipe)(compacting, effect_1.Array.length, effect_1.Option.liftPredicate(length => length === 0), effect_1.Option.map(() => noCompactingCount += 1), effect_1.Option.getOrElse(() => noCompactingCount = 0), count => count === 3);
exports.compact = cli_1.Command
    .make('compact', {}, () => index_1.initializeUrl.pipe(effect_1.Effect.tap(effect_1.Console.log('Compacting all dbs and views...')), effect_1.Effect.andThen(compact_1.CompactService), effect_1.Effect.flatMap(compactService => compactService.compactAll), effect_1.Effect.andThen(effect_1.Effect.repeat(currentlyCompacting, { until: compactingComplete })), effect_1.Effect.tap(effect_1.Console.log('Compaction complete.'))))
    .pipe(cli_1.Command.withDescription(`Force compaction on databases and views.`));
//# sourceMappingURL=compact.js.map