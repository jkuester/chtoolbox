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
exports.CouchDesignServiceLive = exports.CouchDesignService = void 0;
const Schema = __importStar(require("@effect/schema/Schema"));
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const couch_1 = require("./couch");
const effect_1 = require("effect");
class CouchDesign extends Schema.Class('CouchDesign')({
    _id: Schema.String,
    views: Schema.UndefinedOr(Schema.Object),
}) {
    static decodeResponse = platform_1.HttpClientResponse.schemaBodyJsonScoped(CouchDesign);
}
exports.CouchDesignService = Context.GenericTag('chtoolbox/CouchDesignService');
const ServiceContext = couch_1.CouchService.pipe(Effect.map(couch => Context.make(couch_1.CouchService, couch)));
exports.CouchDesignServiceLive = Layer.effect(exports.CouchDesignService, ServiceContext.pipe(Effect.map(context => exports.CouchDesignService.of({
    getViewNames: (dbName, designName) => couch_1.CouchService.pipe(Effect.flatMap(couch => couch.request(platform_1.HttpClientRequest.get(`/${dbName}/_design/${designName}`))), CouchDesign.decodeResponse, Effect.map(design => design.views), Effect.map(effect_1.Option.fromNullable), Effect.map(effect_1.Option.map(Object.keys)), Effect.map(effect_1.Option.getOrElse(() => [])), Effect.provide(context)),
}))));
//# sourceMappingURL=design.js.map