"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pouchDB = exports.optionalUpdate = void 0;
const effect_1 = require("effect");
const pouchdb_core_1 = __importDefault(require("pouchdb-core"));
const optionalUpdate = (ref, value) => value.pipe(effect_1.Option.map(value => effect_1.Ref.update(ref, () => value)), effect_1.Option.getOrElse(() => effect_1.Effect.void));
exports.optionalUpdate = optionalUpdate;
/**
 * Shim to make PouchDB easier to mock.
 */
const pouchDB = (name, options) => new pouchdb_core_1.default(name, options);
exports.pouchDB = pouchDB;
//# sourceMappingURL=core.js.map