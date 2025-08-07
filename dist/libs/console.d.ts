import { Effect } from 'effect';
// const ANSI_CODES = {
//   red: '\x1b[31m',
//   green: '\x1b[32m',
//   blue: '\x1b[34m'
// };
// type AnsiColor = keyof typeof ANSI_CODES;
// const resetCode = '\x1b[0m';
// export const color = (color: AnsiColor) => (text: string): string => `${ANSI_CODES[color]}${text}${resetCode}`;
export declare const debugLoggingEnabled: Effect.Effect<boolean, never, never>;
export declare const clearConsole: Effect.Effect<void, never, never>;
export declare const clearThen: (printEffect: Effect.Effect<void, never, never>) => Effect.Effect<void, never, never>;
export declare const logJson: (data: unknown) => Effect.Effect<void, never, never>;
//# sourceMappingURL=console.d.ts.map