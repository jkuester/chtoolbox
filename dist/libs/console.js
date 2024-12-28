"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logJson = exports.clearThen = exports.color = void 0;
const effect_1 = require("effect");
const ANSI_CODES = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    blue: '\x1b[34m'
};
const resetCode = '\x1b[0m';
const color = (color) => (text) => `${ANSI_CODES[color]}${text}${resetCode}`;
exports.color = color;
const clearThen = (printEffect) => effect_1.Console.clear.pipe(effect_1.Effect.tap(printEffect));
exports.clearThen = clearThen;
const logJson = (data) => (0, effect_1.pipe)(JSON.stringify(data, null, 2), effect_1.Console.log);
exports.logJson = logJson;
//# sourceMappingURL=console.js.map