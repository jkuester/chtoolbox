import ExcelJS from 'exceljs';
import { Array, Option, pipe, Record, Tuple } from 'effect';

export type Worksheet = ExcelJS.Worksheet & {
  // worksheet.dataValidations exists at runtime but isn't in the public TS types.
  dataValidations: {
    model: object;
    add: (range: string, validation: ExcelJS.DataValidation) => void;
  };
};

export const STYLE = {
  FONT: { BASE: { name: 'Liberation Sans', size: 10 } satisfies Partial<ExcelJS.Font> },
  FILL: {
    GREY: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } } satisfies ExcelJS.Fill,
    BLUE_GREY: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCF0' } } satisfies ExcelJS.Fill,
    GREEN: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFAFD095' } } satisfies ExcelJS.Fill,
  },
  BORDER: {
    DARK_GREY: { style: 'thin', color: { argb: 'FF808080' } } satisfies Partial<ExcelJS.Border>,
    BLUE: { style: 'medium', color: { argb: 'FF0070C0' } } satisfies Partial<ExcelJS.Border>,
    PURPLE: { style: 'medium', color: { argb: 'FF7030A0' } } satisfies Partial<ExcelJS.Border>,
  }
};
const BASE_ALIGNMENT: Partial<ExcelJS.Alignment> = { vertical: 'bottom' };
const STYLE_DEFAULT: Partial<ExcelJS.Style> = {
  font: { ...STYLE.FONT.BASE },
  alignment: { ...BASE_ALIGNMENT }
};

const worksheetHasName = (targetName: string) => ({ name }: ExcelJS.Worksheet) => name === targetName;
export const getWorksheetWithName = (
  workbook: ExcelJS.Workbook
) => (name: string): Option.Option<Worksheet> => pipe(
  Array.findFirst(workbook.worksheets, worksheetHasName(name)),
  Option.map(worksheet => worksheet as Worksheet)
);

const setDefaultStyle = (obj: object) => Object.assign(obj, { style: { ...STYLE_DEFAULT } });

const clearRowFormatting = (row: ExcelJS.Row) => row.eachCell({ includeEmpty: true }, setDefaultStyle);

const clearComment = (cell: ExcelJS.Cell) => pipe(
  cell as { _comment?: unknown; _value?: { model?: { comment?: unknown } } },
  c => Object.assign(c, { _comment: undefined }),
  c => c._value?.model ? Object.assign(c._value.model, { comment: undefined }) : c
);
// ExcelJS has no public API to remove a comment.
const clearHeaderComments = (ws: Worksheet) => ws
  .getRow(1)
  .eachCell({ includeEmpty: true }, clearComment);

const clearFrozenPanes = (ws: Worksheet): void => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  ws.views = ws.views?.filter(view => view.state !== 'frozen');
};
export const clearSheetFormatting = (ws: Worksheet): void => {
  ws.removeConditionalFormatting(null);
  ws.dataValidations.model = {};
  ws.eachRow({ includeEmpty: true }, clearRowFormatting);
  clearHeaderComments(ws);
  ws.columns.forEach(setDefaultStyle);
  clearFrozenPanes(ws);
};

export const getHeaderNames = (worksheet: Worksheet): string[] => pipe(
  worksheet.getRow(1).values,
  values => Array.isArray(values) ? values : Object.values(values),
  Array.map(val => typeof val === 'string' ? val : ''),
);

export const getColumnLettersMatching = (predicate: (val?: string) => boolean, worksheet: Worksheet): string[] => pipe(
  getHeaderNames(worksheet),
  Array.filterMap((val, idx) => predicate(val) ? Option.some(idx) : Option.none()),
  Array.map(colIndex => worksheet.getColumn(colIndex).letter)
);

const getColumnLetterMatching = (predicate: (val?: string) => boolean, worksheet: Worksheet) => pipe(
  getHeaderNames(worksheet),
  Array.findFirstIndex(predicate),
  Option.map(colIndex => worksheet.getColumn(colIndex).letter)
);
export const getColumnLetter = (colName: string, worksheet: Worksheet): Option.Option<string> =>
  getColumnLetterMatching(val => val === colName, worksheet);


type ColumnsWithComment = Record<string, { comment?: string, translatable?: boolean }>;
// Translatable columns can appear as the bare key or a "key::<lang>" variant, so match every column
// starting with the key; non-translatable columns match the key exactly.
const commentColumnLetters = (name: string, translatable: boolean | undefined, sheet: Worksheet) => translatable
  ? getColumnLettersMatching(val => !!val?.startsWith(name), sheet)
  : Array.fromOption(getColumnLetter(name, sheet));
const commentColumns = (columns: ColumnsWithComment, sheet: Worksheet) => pipe(
  Record.toEntries(columns),
  Array.flatMap(([name, { comment, translatable }]) => pipe(
    Option.fromNullable(comment),
    Option.map(text => pipe(
      commentColumnLetters(name, translatable, sheet),
      Array.map(column => Tuple.make(column, text)),
    )),
    Option.getOrElse(() => []),
  )),
);
const setColumnHeaderComment = (sheet: Worksheet) => (
  [column, comment]: [string, string]
) => sheet.getCell(`${column}1`).note = comment;
export const setHeaderComments = (columns: ColumnsWithComment) => (sheet: Worksheet): void => pipe(
  commentColumns(columns, sheet),
  Array.forEach(setColumnHeaderComment(sheet))
);

export const findFirstEmptyColumnIndex = (sheet: Worksheet): number => pipe(
  getHeaderNames(sheet),
  names => names.length + 1
);
export const setHeaderValue = (label: string) => (
  [sheet, columnIndex]: [Worksheet, number]
): string => sheet.getCell(1, columnIndex).value = label;
export const setColumnValues = (values: readonly string[]) => (
  [sheet, columnIndex]: [Worksheet, number]
): void => values.forEach((value, idx) => sheet.getCell(idx + 2, columnIndex).value = value);

