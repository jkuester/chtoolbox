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
exports.CouchCompactServiceLive = exports.CouchCompactService = void 0;
const Schema = __importStar(require("@effect/schema/Schema"));
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const Layer = __importStar(require("effect/Layer"));
const couch_1 = require("./couch");
exports.CouchCompactService = Context.GenericTag('chtoolbox/CouchCompactService');
const getDesignPath = (designName) => designName ? `/${designName}` : '';
const getCompactRequest = (dbName, designName) => Schema
    .Struct({})
    .pipe(platform_1.HttpClientRequest.schemaBody, build => build(platform_1.HttpClientRequest.post(`/${dbName}/_compact${getDesignPath(designName)}`), {}));
const compact = (dbName, designName) => Effect
    .all([couch_1.CouchService, getCompactRequest(dbName, designName)])
    .pipe(Effect.flatMap(([couch, request]) => couch.request(request)), Effect.andThen(Effect.void), Effect.mapError(x => x), Effect.scoped);
exports.CouchCompactServiceLive = Layer.succeed(exports.CouchCompactService, exports.CouchCompactService.of({
    compactDb: compact,
    compactDesign: compact,
}));
//# sourceMappingURL=compact.js.map