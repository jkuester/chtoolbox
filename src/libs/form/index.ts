import ExcelJS from 'exceljs';
import {
  clearSheetFormatting,
  findFirstEmptyColumnIndex,
  getColumnLetter,
  getHeaderNames,
  getWorksheetWithName,
  setColumnValues,
  setHeaderValue,
  STYLE,
  type Worksheet
} from '../xlsx.ts';
import { Array, Effect, Option, pipe, Record, Tuple } from 'effect';

export const SHEET_NAME_SURVEY = 'survey';
export const SHEET_NAME_SETTINGS = 'settings';
export const SHEET_NAME_CHOICES = 'choices';
const SHEET_NAMES = [SHEET_NAME_SURVEY, SHEET_NAME_CHOICES, SHEET_NAME_SETTINGS];
const SHEET_NAME_CHTX = 'chtx';
export const BUFFER_COL_COUNT = 50;
export const BUFFER_ROW_COUNT = 1000;

const BORDER_HEADER_SIDES: Partial<ExcelJS.Borders> = {
  left: STYLE.BORDER.DARK_GREY,
  right: STYLE.BORDER.DARK_GREY,
};
export const FORM_STYLE = {
  HEADER: {
    BASE: {
      font: { ...STYLE.FONT.BASE, bold: true },
      fill: STYLE.FILL.GREY,
      border: BORDER_HEADER_SIDES,
    } satisfies Partial<ExcelJS.Style>,
    EMPTY: {
      font: { ...STYLE.FONT.BASE, bold: true, italic: true },
      fill: STYLE.FILL.GREY,
      border: BORDER_HEADER_SIDES,
    } satisfies Partial<ExcelJS.Style>,
    EXPRESSION: {
      font: { ...STYLE.FONT.BASE, bold: true },
      fill: STYLE.FILL.BLUE_GREY,
      border: BORDER_HEADER_SIDES,
    } satisfies Partial<ExcelJS.Style>,
    EXPRESSION_EMPTY: {
      font: { ...STYLE.FONT.BASE, bold: true, italic: true },
      fill: STYLE.FILL.BLUE_GREY,
      border: BORDER_HEADER_SIDES,
    } satisfies Partial<ExcelJS.Style>,
    TRANSLATABLE: {
      font: { ...STYLE.FONT.BASE, bold: true },
      fill: STYLE.FILL.GREEN,
      border: BORDER_HEADER_SIDES,
    } satisfies Partial<ExcelJS.Style>,
    TRANSLATABLE_EMPTY: {
      font: { ...STYLE.FONT.BASE, bold: true, italic: true },
      fill: STYLE.FILL.GREEN,
      border: BORDER_HEADER_SIDES,
    } satisfies Partial<ExcelJS.Style>
  },
  ERROR: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } } } satisfies Partial<ExcelJS.Style>
};

export const getTypeColumnLetter = (worksheet: Worksheet): string => Option.getOrThrowWith(
  getColumnLetter('type', worksheet),
  () => new Error('No "type" column found in worksheet.')
);

export const getTypeValidationRange = (column: string, rowCount: number): string =>
  `${column}2:${column}${String(rowCount + BUFFER_ROW_COUNT)}`;

// Freeze the header row and the first two columns so they stay visible while scrolling.
export const freezeHeaderAndKeyColumns = (worksheet: Worksheet): void => {
  worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
};

export const buildTranslatableHeaderFormula = (cell: string, names: readonly string[]): string => pipe(
  names,
  Array.flatMap(name => [
    `${cell}="${name}"`,
    `LEFT(${cell},${String(name.length + 2)})="${name}::"`,
  ]),
  parts => `OR(${parts.join(',')})`,
);

export const buildKnownHeaderFormula = (cell: string, names: readonly string[]): string => pipe(
  names,
  Array.map(name => `"${name}"`),
  quoted => `NOT(ISERROR(MATCH(${cell},{${quoted.join(',')}},0)))`,
);

export const buildEmptyBodyFormula = (worksheet: Worksheet): string =>
  `COUNTA(A$2:A$${String(worksheet.rowCount + BUFFER_ROW_COUNT)})=0`;
export const buildEmptyColumnFormula = (
  worksheet: Worksheet
): string => `AND(A1<>"",${buildEmptyBodyFormula(worksheet)})`;

const getChtxWorksheet = (workbook: ExcelJS.Workbook): Worksheet => pipe(
  getWorksheetWithName(workbook)(SHEET_NAME_CHTX),
  Option.getOrElse(() => workbook.addWorksheet(SHEET_NAME_CHTX) as Worksheet),
  worksheet => Object.assign(worksheet, { state: 'veryHidden' })
);

export const writeChtxColumn = (
  workbook: ExcelJS.Workbook,
  label: string
) => (
  values: readonly string[],
): Effect.Effect<string> => pipe(
  getChtxWorksheet(workbook),
  sheet => Tuple.make(sheet, findFirstEmptyColumnIndex(sheet)),
  Effect.succeed,
  Effect.tap(setHeaderValue(label)),
  Effect.tap(setColumnValues(values)),
  Effect.map(([sheet, columnIndex]) => pipe(
    sheet.getColumn(columnIndex).letter,
    colLetter => `'${SHEET_NAME_CHTX}'!$${colLetter}$2:$${colLetter}$${String(values.length + 1)}`
  )),
);

type ColumnsWithSupportedValues = Record<string, { supportedValues?: readonly string[] }>;
const supportedValueColumns = (columns: ColumnsWithSupportedValues, sheet: Worksheet) => pipe(
  Record.toEntries(columns),
  Array.filterMap(([name, { supportedValues }]) => pipe(
    Option.fromNullable(supportedValues),
    Option.flatMap(values => pipe(
      getColumnLetter(name, sheet),
      Option.map(column => Tuple.make(column, values)),
    )),
  )),
);

const validateColumnSupportedValues = (sheet: Worksheet) => (
  [column, values]: [string, readonly string[]]
) => sheet.dataValidations.add(getTypeValidationRange(column, sheet.rowCount), {
  type: 'list',
  allowBlank: true,
  formulae: [`"${values.join(',')}"`],
  showErrorMessage: true,
  errorStyle: 'stop',
  errorTitle: 'Invalid value',
  error: `This column only accepts ${nonEmptyValues(values)
    .map(v => `"${v}"`)
    .join(', ')} or an empty value.`,
});
export const setSupportedValuesValidation = (columns: ColumnsWithSupportedValues) => (sheet: Worksheet): void => pipe(
  supportedValueColumns(columns, sheet),
  Array.forEach(validateColumnSupportedValues(sheet))
);

const nonEmptyValues = (values: readonly string[]) => Array.filter(values, value => value !== '');
const formatColumnSupportedValues = (sheet: Worksheet) => (
  [column, values]: [string, readonly string[]]
) => {
  sheet.getColumn(column).numFmt = '@';
  sheet.addConditionalFormatting({
    ref: getTypeValidationRange(column, sheet.rowCount),
    rules: [
      {
        type: 'expression',
        formulae: [
          `AND(${column}2<>"",${nonEmptyValues(values)
            .map(v => `${column}2<>"${v}"`)
            .join(',')})`
        ],
        style: { ...FORM_STYLE.ERROR },
        priority: 1,
      }
    ]
  });
};
export const setSupportedValuesFormatting = (columns: ColumnsWithSupportedValues) => (sheet: Worksheet): void => pipe(
  supportedValueColumns(columns, sheet),
  Array.forEach(formatColumnSupportedValues(sheet))
);

export const setHeaderlessCellFormatting = (worksheet: Worksheet): void => pipe(
  worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter,
  lastCol => worksheet.addConditionalFormatting({
    ref: `A2:${lastCol}${String(worksheet.rowCount + BUFFER_ROW_COUNT)}`,
    rules: [
      {
        type: 'expression',
        formulae: ['AND(A2<>"",A$1="")'],
        style: { ...FORM_STYLE.ERROR },
        priority: 1,
      }
    ]
  })
);


const clearChtxSheet = (workbook: ExcelJS.Workbook) => workbook.removeWorksheet(SHEET_NAME_CHTX);
export const clearWorkbookFormatting = (workbook: ExcelJS.Workbook): void => pipe(
  SHEET_NAMES,
  Array.map(getWorksheetWithName(workbook)),
  Array.filter(Option.isSome),
  Array.map(Option.getOrThrow),
  Array.forEach(clearSheetFormatting),
  () => clearChtxSheet(workbook)
);
