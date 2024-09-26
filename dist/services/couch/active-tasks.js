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
exports.CouchActiveTasksServiceLive = exports.CouchActiveTasksService = exports.CouchActiveTask = void 0;
const Schema = __importStar(require("@effect/schema/Schema"));
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const couch_1 = require("./couch");
const ENDPOINT = '/_active_tasks';
class CouchActiveTask extends Schema.Class('CouchActiveTask')({
    database: Schema.String,
    design_document: Schema.UndefinedOr(Schema.String),
    pid: Schema.String,
    progress: Schema.Number,
    started_on: Schema.Number,
    type: Schema.String,
}) {
    static decodeResponse = platform_1.HttpClientResponse.schemaBodyJsonScoped(Schema.Array(CouchActiveTask));
}
exports.CouchActiveTask = CouchActiveTask;
exports.CouchActiveTasksService = Context.GenericTag('chtoolbox/CouchActiveTasksService');
const ServiceContext = couch_1.CouchService.pipe(Effect.map(couch => Context.make(couch_1.CouchService, couch)));
exports.CouchActiveTasksServiceLive = Layer.effect(exports.CouchActiveTasksService, ServiceContext.pipe(Effect.map(context => exports.CouchActiveTasksService.of({
    get: () => couch_1.CouchService.pipe(Effect.flatMap(couch => couch.request(platform_1.HttpClientRequest.get(ENDPOINT))), CouchActiveTask.decodeResponse, Effect.provide(context)),
}))));
//# sourceMappingURL=active-tasks.js.map