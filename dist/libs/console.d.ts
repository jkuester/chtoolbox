import { Effect } from 'effect';
declare const ANSI_CODES: {
    red: string;
    green: string;
    blue: string;
};
export type AnsiColor = keyof typeof ANSI_CODES;
export declare const color: (color: AnsiColor) => (text: string) => string;
export declare const clearThen: (printEffect: Effect.Effect<void>) => Effect.Effect<void>;
export declare const logJson: (data: unknown) => Effect.Effect<void>;
export {};
//# sourceMappingURL=console.d.ts.map