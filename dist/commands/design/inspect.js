"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspect = void 0;
const cli_1 = require("@effect/cli");
const effect_1 = require("effect");
const index_1 = require("../../index");
const design_info_1 = require("../../services/couch/design-info");
const design_1 = require("../../services/couch/design");
const getViewData = (database) => (design) => effect_1.Effect
    .all([
    design_info_1.CouchDesignInfoService.get(database, design),
    design_1.CouchDesignService.getViewNames(database, design),
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
    .make('inspect', { database, designs }, ({ database, designs }) => index_1.initializeUrl.pipe(effect_1.Effect.andThen((0, effect_1.pipe)(designs, effect_1.Array.map(getViewData(database)), effect_1.Effect.all)), effect_1.Effect.map(d => JSON.stringify(d, null, 2)), effect_1.Effect.tap(effect_1.Console.log)))
    .pipe(cli_1.Command.withDescription(`Display detailed information on one or more designs for a Couch database`));
//# sourceMappingURL=inspect.js.map