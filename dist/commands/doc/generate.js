"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const test_data_generator_1 = require("../../services/test-data-generator");
const designScriptPath = cli_1.Args
    .path({ name: 'designScriptPath', exists: 'yes' })
    .pipe(cli_1.Args.withDescription('Path to the design script to use.'));
exports.generate = cli_1.Command
    .make('generate', { designScriptPath }, ({ designScriptPath }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen(test_data_generator_1.TestDataGeneratorService.generate(designScriptPath))))
    .pipe(cli_1.Command.withDescription('Generate docs using https://github.com/medic/test-data-generator.'));
//# sourceMappingURL=generate.js.map