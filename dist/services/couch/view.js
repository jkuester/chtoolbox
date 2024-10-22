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
exports.CouchViewService = void 0;
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const cht_client_1 = require("../cht-client");
const getWarmRequest = (dbName, designName, viewName) => platform_1.HttpClientRequest
    .get(`/${dbName}/_design/${designName}/_view/${viewName}`)
    .pipe(platform_1.HttpClientRequest.setUrlParam('limit', '0'));
const serviceContext = cht_client_1.ChtClientService.pipe(Effect.map(couch => Context.make(cht_client_1.ChtClientService, couch)));
class CouchViewService extends Effect.Service()('chtoolbox/CouchViewService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        warm: (dbName, designName, viewName) => cht_client_1.ChtClientService
            .request(getWarmRequest(dbName, designName, viewName))
            .pipe(Effect.andThen(Effect.void), Effect.scoped, Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.CouchViewService = CouchViewService;
//# sourceMappingURL=view.js.map