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
exports.CouchNodeSystemServiceLive = exports.CouchNodeSystemService = exports.CouchNodeSystem = void 0;
const Schema = __importStar(require("@effect/schema/Schema"));
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const couch_1 = require("./couch");
const ENDPOINT = '/_node/_local/_system';
class CouchNodeSystem extends Schema.Class('CouchNodeSystem')({
    memory: Schema.Struct({
        processes_used: Schema.Number,
        binary: Schema.Number,
    }),
}) {
    static decodeResponse = platform_1.HttpClientResponse.schemaBodyJsonScoped(CouchNodeSystem);
}
exports.CouchNodeSystem = CouchNodeSystem;
exports.CouchNodeSystemService = Context.GenericTag('chtoolbox/CouchNodeSystemService');
const ServiceContext = couch_1.CouchService.pipe(Effect.map(couch => Context.make(couch_1.CouchService, couch)));
exports.CouchNodeSystemServiceLive = Layer.effect(exports.CouchNodeSystemService, ServiceContext.pipe(Effect.map(context => exports.CouchNodeSystemService.of({
    get: () => couch_1.CouchService.pipe(Effect.flatMap(couch => couch.request(platform_1.HttpClientRequest.get(ENDPOINT))), CouchNodeSystem.decodeResponse, Effect.provide(context)),
}))));
//# sourceMappingURL=node-system.js.map