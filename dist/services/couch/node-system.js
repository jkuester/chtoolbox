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
exports.CouchNodeSystemService = exports.CouchNodeSystem = void 0;
const Schema = __importStar(require("@effect/schema/Schema"));
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const couch_1 = require("./couch");
const ENDPOINT = '/_node/_local/_system';
class CouchNodeSystem extends Schema.Class('CouchNodeSystem')({
    memory: Schema.Struct({
        processes_used: Schema.Number,
        binary: Schema.Number,
    }),
}) {
    static decodeResponse = platform_1.HttpClientResponse.schemaBodyJson(CouchNodeSystem);
}
exports.CouchNodeSystem = CouchNodeSystem;
const serviceContext = couch_1.CouchService.pipe(Effect.map(couch => Context.make(couch_1.CouchService, couch)));
class CouchNodeSystemService extends Effect.Service()('chtoolbox/CouchNodeSystemService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        get: () => couch_1.CouchService
            .request(platform_1.HttpClientRequest.get(ENDPOINT))
            .pipe(Effect.flatMap(CouchNodeSystem.decodeResponse), Effect.scoped, Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.CouchNodeSystemService = CouchNodeSystemService;
//# sourceMappingURL=node-system.js.map