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
exports.CouchDesignDocsService = exports.CouchDesignDocs = void 0;
const Schema = __importStar(require("@effect/schema/Schema"));
const platform_1 = require("@effect/platform");
const Effect = __importStar(require("effect/Effect"));
const Context = __importStar(require("effect/Context"));
const effect_1 = require("effect");
const cht_client_1 = require("../cht-client");
class CouchDesignDocs extends Schema.Class('CouchDesignDocs')({
    rows: Schema.Array(Schema.Struct({
        id: Schema.String,
    })),
}) {
    static decodeResponse = platform_1.HttpClientResponse.schemaBodyJson(CouchDesignDocs);
}
exports.CouchDesignDocs = CouchDesignDocs;
const serviceContext = cht_client_1.ChtClientService.pipe(Effect.map(couch => Context.make(cht_client_1.ChtClientService, couch)));
class CouchDesignDocsService extends Effect.Service()('chtoolbox/CouchDesignDocsService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        getNames: (dbName) => cht_client_1.ChtClientService
            .request(platform_1.HttpClientRequest.get(`/${dbName}/_design_docs`))
            .pipe(Effect.flatMap(CouchDesignDocs.decodeResponse), Effect.scoped, Effect.map(designDocs => designDocs.rows), Effect.map(effect_1.Array.map(({ id }) => id)), Effect.map(effect_1.Array.map(id => id.split('/')[1])), Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.CouchDesignDocsService = CouchDesignDocsService;
//# sourceMappingURL=design-docs.js.map