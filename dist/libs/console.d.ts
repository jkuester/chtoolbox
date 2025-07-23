import { Effect } from 'effect';
export declare const debugLoggingEnabled: Effect.Effect<boolean, never, never>;
export declare const clearConsole: Effect.Effect<void, never, never>;
export declare const clearThen: (printEffect: Effect.Effect<void>) => Effect.Effect<void>;
export declare const logJson: (data: unknown) => Effect.Effect<void>;
//# sourceMappingURL=console.d.ts.map