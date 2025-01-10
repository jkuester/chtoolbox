"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspect = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const design_info_1 = require("../../libs/couch/design-info");
const design_1 = require("../../libs/couch/design");
const console_1 = require("../../libs/console");
const getViewData = (database) => (design) => effect_1.Effect
    .all([
    (0, design_info_1.getDesignInfo)(database, design),
    (0, design_1.getViewNames)(database, design),
])
    .pipe(effect_1.Effect.map(([designInfo, views]) => ({
    ...designInfo,
    views
})));
const database = cli_1.Args
    .text({ name: 'database' })
    .pipe(cli_1.Args.withDescription('The database with the design to inspect'));
const designs = cli_1.Args
    .text({ name: 'design' })
    .pipe(cli_1.Args.withDescription('The design to inspect'), cli_1.Args.atLeast(1));
exports.inspect = cli_1.Command
    .make('inspect', { database, designs }, ({ database, designs }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen((0, effect_1.pipe)(designs, effect_1.Array.map(getViewData(database)), effect_1.Effect.all)), effect_1.Effect.tap(console_1.logJson)))
    .pipe(cli_1.Command.withDescription(`Display detailed information on one or more designs for a Couch database`));
//# sourceMappingURL=inspect.js.map