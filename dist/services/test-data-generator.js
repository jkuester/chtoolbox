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
exports.TestDataGeneratorService = void 0;
const effect_1 = require("effect");
const platform_1 = require("@effect/platform");
const environment_1 = require("./environment");
const CommandExecutor_1 = require("@effect/platform/CommandExecutor");
const Context = __importStar(require("effect/Context"));
const tdgPath = require.resolve('test-data-generator');
const tdgCommand = (designScriptPath) => environment_1.EnvironmentService
    .get()
    .pipe(effect_1.Effect.flatMap(env => platform_1.Command
    .make('node', tdgPath, designScriptPath)
    .pipe(platform_1.Command.env({ COUCH_URL: effect_1.Redacted.value(env.url) }), platform_1.Command.stdout('inherit'), platform_1.Command.stderr('inherit'), platform_1.Command.exitCode)));
const serviceContext = effect_1.Effect
    .all([
    environment_1.EnvironmentService,
    CommandExecutor_1.CommandExecutor,
])
    .pipe(effect_1.Effect.map(([environmentSvc, commandExecutor,]) => Context
    .make(CommandExecutor_1.CommandExecutor, commandExecutor)
    .pipe(Context.add(environment_1.EnvironmentService, environmentSvc))));
class TestDataGeneratorService extends effect_1.Effect.Service()('chtoolbox/TestDataGeneratorService', {
    effect: serviceContext.pipe(effect_1.Effect.map(context => ({
        generate: (designScriptPath) => tdgCommand(designScriptPath)
            .pipe(effect_1.Effect.mapError(x => x), effect_1.Effect.map(effect_1.Option.liftPredicate(exitCode => exitCode === 0)), effect_1.Effect.map(effect_1.Option.getOrThrow), effect_1.Effect.provide(context)),
    }))),
    accessors: true,
}) {
}
exports.TestDataGeneratorService = TestDataGeneratorService;
//# sourceMappingURL=test-data-generator.js.map