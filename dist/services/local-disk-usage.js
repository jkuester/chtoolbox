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
exports.LocalDiskUsageServiceLive = exports.LocalDiskUsageService = void 0;
const platform_1 = require("@effect/platform");
const effect_1 = require("effect");
const Context = __importStar(require("effect/Context"));
exports.LocalDiskUsageService = Context.GenericTag('chtoolbox/LocalDiskUsageService');
const parseSize = (output) => (0, effect_1.pipe)(output.split(/\s/)[0], parseInt);
const duCommand = (path) => platform_1.Command
    .make('du', '-s', path)
    .pipe(platform_1.Command.string, effect_1.Effect.map(parseSize));
exports.LocalDiskUsageServiceLive = effect_1.Layer.succeed(exports.LocalDiskUsageService, exports.LocalDiskUsageService.of({
    getSize: path => (0, effect_1.pipe)(path, duCommand)
}));
//# sourceMappingURL=local-disk-usage.js.map