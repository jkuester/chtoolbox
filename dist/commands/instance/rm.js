"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rm = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const local_instance_1 = require("../../services/local-instance");
const getConfirmationPrompt = (names) => cli_1.Prompt.confirm({
    message: `Are you sure you want to permanently remove ${effect_1.Array.join(names, ', ')}?`,
    initial: false,
});
const isRemoveConfirmed = (names, yes) => effect_1.Match
    .value(yes)
    .pipe(effect_1.Match.when(true, () => effect_1.Effect.succeed(true)), effect_1.Match.orElse(() => getConfirmationPrompt(names)));
const rmChtInstances = (names) => (0, effect_1.pipe)(names, effect_1.Array.map(local_instance_1.LocalInstanceService.rm), effect_1.Effect.all, effect_1.Effect.andThen(effect_1.Console.log('CHT instance(s) removed')));
const yes = cli_1.Options
    .boolean('yes')
    .pipe(cli_1.Options.withAlias('y'), cli_1.Options.withDescription('Do not prompt for confirmation.'), cli_1.Options.withDefault(false));
const names = cli_1.Args
    .text({ name: 'name' })
    .pipe(cli_1.Args.withDescription('The project name of the CHT instance to remove'), cli_1.Args.atLeast(1));
exports.rm = cli_1.Command
    .make('rm', { names, yes }, ({ names, yes }) => isRemoveConfirmed(names, yes)
    .pipe(effect_1.Effect.map(removeConfirmed => effect_1.Option.liftPredicate(rmChtInstances(names), () => removeConfirmed)), effect_1.Effect.flatMap(effect_1.Option.getOrElse(() => effect_1.Console.log('Operation cancelled')))))
    .pipe(cli_1.Command.withDescription('LOCAL ONLY: Remove a local CHT instance, completely deleting all associated data. ' +
    'Requires Docker and Docker Compose.'));
//# sourceMappingURL=rm.js.map