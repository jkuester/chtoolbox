import ExcelJS from 'exceljs';
import { Array, Option, pipe, Predicate, Record, Tuple } from 'effect';

export type Worksheet = ExcelJS.Worksheet & {
  // worksheet.dataValidations exists at runtime but isn't in the public TS types.
  dataValidations: {
    model: object;
    add: (range: string, validation: ExcelJS.DataValidation) => void;
  };
};

const COLOR = {
  LIGHT_GREY: 'FFD3D3D3',
  DARK_GREY: 'FF808080',
  BLUE: 'FF0070C0',
  PURPLE: 'FF7030A0',
} as const;

export const STYLE = {
  COLOR,
  FONT: { BASE: { name: 'Liberation Sans', size: 10 } satisfies Partial<ExcelJS.Font> },
  FILL: {
    GREY: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.LIGHT_GREY } } satisfies ExcelJS.Fill,
    BLUE_GREY: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCF0' } } satisfies ExcelJS.Fill,
    GREEN: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFAFD095' } } satisfies ExcelJS.Fill,
  },
  BORDER: {
    DARK_GREY: { style: 'thin', color: { argb: COLOR.DARK_GREY } } satisfies Partial<ExcelJS.Border>,
    BLUE: { style: 'medium', color: { argb: COLOR.BLUE } } satisfies Partial<ExcelJS.Border>,
    PURPLE: { style: 'medium', color: { argb: COLOR.PURPLE } } satisfies Partial<ExcelJS.Border>,
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

// ExcelJS writes a column with no width as width 9, but merges adjacent columns into one <col> by comparing the
// unset width. So without an explicit width, every styled column is written as its own <col>.
const DEFAULT_COLUMN_WIDTH = 9;
const setDefaultColumnStyle = (column: Partial<ExcelJS.Column>) => Object.assign(
  setDefaultStyle(column),
  { width: column.width ?? DEFAULT_COLUMN_WIDTH }
);

// Only the cells that already exist are reset. eachCell's includeEmpty creates every missing cell up to the
// last one in the row, which then gets written out as an empty styled cell. The gaps fall back to the row's
// style, so that is reset too.
const getRowCells = (row: ExcelJS.Row) => (row as unknown as { _cells: (ExcelJS.Cell | undefined)[] })._cells;
const clearRowFormatting = (row: ExcelJS.Row) => pipe(
  setDefaultStyle(row),
  () => getRowCells(row),
  Array.filter(Predicate.isNotUndefined),
  Array.forEach(setDefaultStyle),
);

const clearComment = (cell: ExcelJS.Cell) => pipe(
  cell as { _comment?: unknown; _value?: { model?: { comment?: unknown } } },
  c => Object.assign(c, { _comment: undefined }),
  c => c._value?.model ? Object.assign(c._value.model, { comment: undefined }) : c
);
// ExcelJS has no public API to remove a comment.
const clearHeaderComments = (ws: Worksheet) => ws
  .getRow(1)
  .eachCell({ includeEmpty: true }, clearComment);

// ExcelJS reads a comment box that has no inset as [NaN], and then writes it back out as "NaNmm,...". A null
// inset (as ExcelJS reads it from other writers) is written with no inset at all, where undefined gets defaults.
interface NoteMargins { inset?: number[] }
const getNoteMargins = (cell: ExcelJS.Cell) => pipe(
  Option.fromNullable(cell.note as unknown as string | { margins?: NoteMargins } | undefined),
  Option.flatMap(note => typeof note === 'string' ? Option.none() : Option.fromNullable(note.margins)),
);
const clearInvalidNoteInset = (cell: ExcelJS.Cell) => pipe(
  getNoteMargins(cell),
  Option.filter(({ inset }) => !!inset?.some(margin => !Number.isFinite(margin))),
  Option.map(margins => Object.assign(margins, { inset: null })),
);
const clearInvalidNoteInsets = (ws: Worksheet) => ws.eachRow(row => row.eachCell(clearInvalidNoteInset));

const clearFrozenPanes = (ws: Worksheet): void => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  ws.views = ws.views?.filter(view => view.state !== 'frozen');
};

const lastRowWithValues = (ws: Worksheet) => pipe(
  Array.range(1, ws.rowCount),
  Array.findLast(rowNumber => !!ws.findRow(rowNumber)?.hasValues),
  Option.getOrElse(() => 0),
);
// ExcelJS has no public API for dropping rows off the end of a sheet. (spliceRows is a no-op when the
// range runs to the end of the sheet, so it cannot be used here.)
const getRowRecords = (ws: Worksheet) => (ws as unknown as { _rows: (ExcelJS.Row | undefined)[] })._rows;
export const removeTrailingEmptyRows = (ws: Worksheet): void => {
  getRowRecords(ws).length = lastRowWithValues(ws);
};

// Sheets end at column XFD. Inserting a column into a sheet whose column definitions already reach the end
// (as LibreOffice writes them) pushes the last definition past it, and ExcelJS writes it out regardless.
// `columns` returns ExcelJS's own array, so truncating it drops the extra definitions.
const MAX_COLUMN_COUNT = 16384;
export const removeColumnsPastSheetEnd = (ws: Worksheet): void => {
  ws.columns.length = Math.min(ws.columns.length, MAX_COLUMN_COUNT);
};

const isSharedFormula = (cell: ExcelJS.Cell) => cell.formulaType === ExcelJS.FormulaType.Shared
  || (cell.value as { shareType?: string } | null)?.shareType === 'shared';
// A shared formula's clones reference their master by address, and ExcelJS does not update that address when
// columns/rows are spliced. Giving every cell its own formula keeps them valid across a splice.
const unshareFormula = (cell: ExcelJS.Cell) => pipe(
  cell,
  Option.liftPredicate(isSharedFormula),
  Option.map(c => Object.assign(c, { value: { formula: c.formula, result: c.result } })),
);
const unshareFormulas = (ws: Worksheet) => ws.eachRow(row => row.eachCell(unshareFormula));

export const clearSheetFormatting = (ws: Worksheet): void => {
  unshareFormulas(ws);
  ws.removeConditionalFormatting(null);
  ws.dataValidations.model = {};
  removeTrailingEmptyRows(ws);
  ws.eachRow({ includeEmpty: true }, clearRowFormatting);
  clearHeaderComments(ws);
  clearInvalidNoteInsets(ws);
  removeColumnsPastSheetEnd(ws);
  ws.columns.forEach(setDefaultColumnStyle);
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

