"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentServiceImpl = exports.EnvironmentService = void 0;
const Schema = __importStar(require("@effect/schema/Schema"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const effect_1 = require("effect");
const WITH_MEDIC_PATTERN = /^(.+)\/medic$/g;
const { COUCH_URL } = process.env;
class Environment extends Schema.Class('Environment')({
    couchUrl: Schema.String,
}) {
}
exports.EnvironmentService = Context.GenericTag('chtoolbox/EnvironmentService');
const trimTrailingMedic = (url) => url.replace(WITH_MEDIC_PATTERN, '$1');
const getCouchUrl = effect_1.Effect
    .fromNullable(COUCH_URL)
    .pipe(effect_1.Effect.catchTag('NoSuchElementException', () => effect_1.Effect.fail(new Error('COUCH_URL not set'))), effect_1.Effect.map(trimTrailingMedic));
const createEnvironmentService = getCouchUrl.pipe(effect_1.Effect.map(couchUrl => new Environment({
    couchUrl
})), effect_1.Effect.map(env => exports.EnvironmentService.of({ get: () => env })));
exports.EnvironmentServiceImpl = Layer.effect(exports.EnvironmentService, createEnvironmentService);
//# sourceMappingURL=environment.service.js.map