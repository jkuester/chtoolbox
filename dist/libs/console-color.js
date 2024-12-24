"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.color = void 0;
const ANSI_CODES = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    blue: '\x1b[34m'
};
const resetCode = '\x1b[0m';
const color = (color) => (text) => `${ANSI_CODES[color]}${text}${resetCode}`;
exports.color = color;
//# sourceMappingURL=console-color.js.map