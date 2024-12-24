declare const ANSI_CODES: {
    red: string;
    green: string;
    blue: string;
};
export type AnsiColor = keyof typeof ANSI_CODES;
export declare const color: (color: AnsiColor) => (text: string) => string;
export {};
//# sourceMappingURL=console-color.d.ts.map