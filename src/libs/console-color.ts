const ANSI_CODES = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[34m'
};
export type AnsiColor = keyof typeof ANSI_CODES;
const resetCode = '\x1b[0m';

export const color = (color: AnsiColor) => (text: string): string => `${ANSI_CODES[color]}${text}${resetCode}`;
