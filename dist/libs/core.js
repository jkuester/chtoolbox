"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pouchDB = exports.untilEmptyCount = void 0;
const effect_1 = require("effect");
const pouchdb_core_1 = __importDefault(require("pouchdb-core"));
/**
 * Returns a function that takes an array. The function will return `false` until
 * it has been called `target` times with an empty array.
 * @param target the number of times the function will return `true` when called with
 * an empty array
 */
const untilEmptyCount = (target) => effect_1.Ref
    .unsafeMake(0)
    .pipe(countRef => (data) => countRef.pipe(effect_1.Ref.get, effect_1.Effect.map(effect_1.Option.liftPredicate(() => effect_1.Array.isEmptyArray(data))), effect_1.Effect.map(effect_1.Option.map(effect_1.Number.increment)), effect_1.Effect.map(effect_1.Option.getOrElse(() => 0)), effect_1.Effect.tap(count => countRef.pipe(effect_1.Ref.set(count))), effect_1.Effect.map(count => count === target)));
exports.untilEmptyCount = untilEmptyCount;
/**
 * Shim to make PouchDB easier to mock.
 */
const pouchDB = (name, options) => new pouchdb_core_1.default(name, options);
exports.pouchDB = pouchDB;
//# sourceMappingURL=core.js.map