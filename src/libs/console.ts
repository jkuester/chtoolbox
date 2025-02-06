import { Console, Effect, pipe } from 'effect';

// const ANSI_CODES = {
//   red: '\x1b[31m',
//   green: '\x1b[32m',
//   blue: '\x1b[34m'
// };
// type AnsiColor = keyof typeof ANSI_CODES;
// const resetCode = '\x1b[0m';

// export const color = (color: AnsiColor) => (text: string): string => `${ANSI_CODES[color]}${text}${resetCode}`;

export const clearThen = (
  printEffect: Effect.Effect<void>
): Effect.Effect<void> => Console.clear.pipe(Effect.tap(printEffect));

export const logJson = (data: unknown): Effect.Effect<void> => pipe(
  JSON.stringify(data, null, 2),
  Console.log
);
