import { type Worksheet } from '../../src/libs/xlsx.ts';

// ExcelJS exposes conditional formatting and data validation models at runtime, but its public
// types either omit them or type them as `any`. These helpers narrow them to the shapes the
// tests assert on so the specs stay type-safe.

export interface ConditionalFormattingRule {
  type?: string;
  priority?: number;
  style?: object;
  formulae: readonly string[];
}

export interface ConditionalFormatting {
  ref: string;
  rules: ConditionalFormattingRule[];
}

export interface DataValidationModel {
  type?: string;
  allowBlank?: boolean;
  formulae: readonly string[];
  error?: string;
  errorStyle?: string;
  errorTitle?: string;
}

export const getConditionalFormattings = (worksheet: Worksheet): ConditionalFormatting[] =>
  (worksheet as unknown as { conditionalFormattings: ConditionalFormatting[] }).conditionalFormattings;

export const getConditionalFormatting = (worksheet: Worksheet, index = 0): ConditionalFormatting => {
  const formatting = getConditionalFormattings(worksheet)[index];
  if (!formatting) {
    throw new Error(`No conditional formatting at index ${String(index)}.`);
  }
  return formatting;
};

export const getConditionalFormattingRule = (
  worksheet: Worksheet,
  ruleIndex: number,
  formattingIndex = 0
): ConditionalFormattingRule => {
  const rule = getConditionalFormatting(worksheet, formattingIndex).rules[ruleIndex];
  if (!rule) {
    throw new Error(`No conditional formatting rule at index ${String(ruleIndex)}.`);
  }
  return rule;
};

export const getDataValidation = (worksheet: Worksheet, range: string): DataValidationModel | undefined =>
  (worksheet.dataValidations.model as Record<string, DataValidationModel>)[range];
