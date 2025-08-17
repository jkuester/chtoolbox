import { Console, Effect, FiberRef, LogLevel, pipe } from 'effect';
// const ANSI_CODES = {
//   red: '\x1b[31m',
//   green: '\x1b[32m',
//   blue: '\x1b[34m'
// };
// type AnsiColor = keyof typeof ANSI_CODES;
// const resetCode = '\x1b[0m';
// export const color = (color: AnsiColor) => (text: string): string => `${ANSI_CODES[color]}${text}${resetCode}`;
export const debugLoggingEnabled = FiberRef
    .get(FiberRef.currentMinimumLogLevel)
    .pipe(Effect.map(LogLevel.lessThanEqual(LogLevel.Debug)));
export const clearConsoleEffect = Effect.void.pipe(Effect.filterEffectOrElse({
    predicate: () => debugLoggingEnabled,
    orElse: () => Console.clear
}));
export const clearThen = Effect.fn((printEffect) => clearConsoleEffect.pipe(Effect.tap(printEffect)));
export const logJson = Effect.fn((data) => pipe(JSON.stringify(data, null, 2), Console.log));
