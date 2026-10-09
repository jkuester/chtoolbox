import ExcelJS from 'exceljs';
import { Array, Option, pipe, Predicate, Record, Struct, Tuple } from 'effect';

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
export const setDefaultColumnStyle = (column: Partial<ExcelJS.Column>): Partial<ExcelJS.Column> => Object.assign(
  setDefaultStyle(column),
  { width: column.width ?? DEFAULT_COLUMN_WIDTH }
);

// Only the cells that already exist are reset. eachCell's includeEmpty creates every missing cell up to the
// last one in the row, which then gets written out as an empty styled cell. The gaps fall back to the row's
// style, so that is reset too.
const getRowCells = (row: ExcelJS.Row) => (row as unknown as { _cells: (ExcelJS.Cell | undefined)[] })._cells;
const isEmptyCell = (cell: ExcelJS.Cell | undefined) => !cell || (cell.type === ExcelJS.ValueType.Null && !cell.note);
const removeTrailingEmptyCells = (row: ExcelJS.Row): void => {
  const cells = getRowCells(row);
  cells.length = cells.findLastIndex(cell => !isEmptyCell(cell)) + 1;
};
const clearRowFormatting = (row: ExcelJS.Row): void => {
  setDefaultStyle(row);
  removeTrailingEmptyCells(row);
  getRowCells(row).filter(Predicate.isNotUndefined).forEach(setDefaultStyle);
};

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

type View = Partial<ExcelJS.WorksheetViewCommon> & {
  state?: string,
  style?: string,
  xSplit?: number,
  ySplit?: number,
  topLeftCell?: string,
};
const unfreezeView = (view: View): View => pipe(
  view,
  Struct.omit('xSplit', 'ySplit', 'topLeftCell'),
  rest => ({ ...rest, state: 'normal' }),
);
export const freezeView = (xSplit: number, ySplit: number) => (view: View = {}): ExcelJS.WorksheetView => ({
  ...unfreezeView(view),
  state: 'frozen',
  xSplit,
  ySplit,
}) as ExcelJS.WorksheetView;

const clearFrozenPanes = (ws: Worksheet): void => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  ws.views = ws.views?.map(view => view.state === 'frozen' ? unfreezeView(view) as ExcelJS.WorksheetView : view);
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

// ExcelJS returns null (despite its types) for a sheet with no column definitions, such as an empty sheet.
const getColumns = (ws: Worksheet) => (ws.columns as Partial<ExcelJS.Column>[] | null) ?? [];

// Sheets end at column XFD. Inserting a column into a sheet whose column definitions already reach the end
// (as LibreOffice writes them) pushes the last definition past it, and ExcelJS writes it out regardless.
// `columns` returns ExcelJS's own array, so truncating it drops the extra definitions.
const MAX_COLUMN_COUNT = 16384;
export const removeColumnsPastSheetEnd = (ws: Worksheet): void => {
  const columns = getColumns(ws);
  columns.length = Math.min(columns.length, MAX_COLUMN_COUNT);
};

interface FormulaModel { formula?: string, result?: ExcelJS.CellFormulaValue['result'] }
const getFormulaModel = (cell: ExcelJS.Cell) => (cell as unknown as { _value: { model: FormulaModel } })._value.model;

// ExcelJS drops a formula's cached result whenever the cell's value is copied if that result is falsy (FALSE, 0
// or ""). pyxform reads the cached result, so e.g. a `=FALSE()` relevant would be lost.
const isFormulaWithFalsyResult = (cell: ExcelJS.Cell) => cell.type === ExcelJS.ValueType.Formula && !cell.result;
const setFormulaResult = (cell: ExcelJS.Cell, result: FormulaModel['result']) => Object.assign(
  getFormulaModel(cell),
  { result },
);

const isSharedFormula = (cell: ExcelJS.Cell) => cell.formulaType === ExcelJS.FormulaType.Shared
  || (cell.value as { shareType?: string } | null)?.shareType === 'shared';
// A shared formula's clones reference their master by address, and ExcelJS does not update that address when
// columns/rows are spliced. Giving every cell its own formula keeps them valid across a splice.
const unshareFormula = (cell: ExcelJS.Cell) => pipe(
  cell,
  Option.liftPredicate(isSharedFormula),
  Option.map(c => Tuple.make(c, c.result)),
  Option.map(([c, result]) => setFormulaResult(Object.assign(c, { value: { formula: c.formula } }), result)),
);
const unshareFormulas = (ws: Worksheet) => ws.eachRow(row => row.eachCell(unshareFormula));

const getFalsyFormulaResults = (ws: Worksheet) => pipe(
  getRowRecords(ws),
  Array.filter(Predicate.isNotUndefined),
  Array.flatMap(getRowCells),
  Array.filter(Predicate.isNotUndefined),
  Array.filter(isFormulaWithFalsyResult),
  Array.map(({ row, col, result }) => ({ row: Number(row), col: Number(col), result })),
);

type MoveColumn = (col: number) => Option.Option<number>;
const getColumnAfterSplice = (start: number, deleteCount: number, insertCount: number): MoveColumn => col => {
  if (col < start) {
    return Option.some(col);
  }
  return col < start + deleteCount ? Option.none() : Option.some(col - deleteCount + insertCount);
};
// A range shrinks to the columns that survive the splice, and is gone when none of them do.
const getColumnsAfterSplice = (moveColumn: MoveColumn) => (
  left: number,
  right: number
): Option.Option<[number, number]> => pipe(
  Array.range(Math.min(left, right), Math.max(left, right)),
  Array.filterMap(moveColumn),
  cols => Option.all([Array.head(cols), Array.last(cols)]),
);

interface CellRange { top: number, left: number, bottom: number, right: number }
const getMergedRanges = (ws: Worksheet) => pipe(
  (ws as unknown as { _merges: Record<string, CellRange> })._merges,
  Record.values,
  Array.map(({ top, left, bottom, right }) => ({ top, left, bottom, right })),
);
const getMergeAfterSplice = (moveColumn: MoveColumn) => (
  { top, left, bottom, right }: CellRange
): Option.Option<CellRange> => pipe(
  getColumnsAfterSplice(moveColumn)(left, right),
  Option.map(([newLeft, newRight]) => ({ top, bottom, left: newLeft, right: newRight })),
  Option.filter(range => range.left < range.right || range.top < range.bottom),
);

const columnNumber = (letters: string): number => [...letters]
  .reduce((n, letter) => (n * 26) + letter.charCodeAt(0) - 64, 0);
const columnLetters = (n: number): string => (n > 26 ? columnLetters(Math.floor((n - 1) / 26)) : '')
  + String.fromCharCode(65 + ((n - 1) % 26));

// An A1 cell or range reference, optionally qualified with a sheet name (which Excel leaves unquoted when it is
// made of letters, including non-ASCII ones, digits, `_` and `.`). Whole-column/row references (e.g. `A:A`) are
// not matched. A reference right after a `!` is not matched on its own, so one qualified with a sheet name the
// pattern does not recognise is left alone.
const CELL_REF = String.raw`(\$?)([A-Z]{1,3})(\$?\d+)`;
const REF_PATTERN = new RegExp(
  String.raw`(?<![\p{L}\p{N}_$.'!])(?:('(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!)?${CELL_REF}(?::${CELL_REF})?`
    + String.raw`(?![\p{L}\p{N}_(!])`,
  'gu'
);
// Double-quoted string literals, captured so that splitting on them keeps them at the odd indexes.
const STRING_LITERAL_PATTERN = /("(?:[^"]|"")*")/;

const unquoteSheetName = (name: string) => name.replace(/^'|'$/g, '').replace(/''/g, '\'').toLowerCase();
// The range end's groups are undefined when the reference is a single cell.
const shiftRef = (moveColumn: MoveColumn, refersToSheet: (sheet?: string) => boolean) => (
  ref: string,
  sheet: string | undefined,
  abs1: string,
  col1: string,
  row1: string,
  abs2: string,
  col2: string | undefined,
  row2: string,
): string => {
  if (!refersToSheet(sheet)) {
    return ref;
  }
  return pipe(
    getColumnsAfterSplice(moveColumn)(columnNumber(col1), columnNumber(col2 ?? col1)),
    Option.map(([left, right]) => `${abs1}${columnLetters(left)}${row1}`
      + (col2 === undefined ? '' : `:${abs2}${columnLetters(right)}${row2}`)),
    Option.getOrElse(() => '#REF!'),
    shifted => `${sheet === undefined ? '' : `${sheet}!`}${shifted}`,
  );
};
const shiftFormulaRefs = (moveColumn: MoveColumn, refersToSheet: (sheet?: string) => boolean) => (
  formula: string
): string => formula
  .split(STRING_LITERAL_PATTERN)
  .map((part, idx) => idx % 2 ? part : part.replace(REF_PATTERN, shiftRef(moveColumn, refersToSheet)))
  .join('');

// ExcelJS does not update references to the cells it moves, neither in formulas (on this sheet or others) nor
// in the sheet's auto filter.
const shiftReferences = (ws: Worksheet, moveColumn: MoveColumn) => {
  const isThisSheet = (sheet: string) => unquoteSheetName(sheet) === ws.name.toLowerCase();
  ws.workbook.eachSheet(sheet => pipe(
    shiftFormulaRefs(moveColumn, sheetName => sheetName === undefined ? sheet === ws : isThisSheet(sheetName)),
    shift => sheet.eachRow(row => row.eachCell(cell => pipe(
      getFormulaModel(cell),
      model => Option.map(
        Option.fromNullable(model.formula),
        formula => Object.assign(model, { formula: shift(formula) }),
      ),
    ))),
  ));
  // The {from, to} form is only ever set by code, not read from a file.
  if (typeof ws.autoFilter === 'string') {
    const autoFilter = shiftFormulaRefs(moveColumn, sheetName => sheetName === undefined)(ws.autoFilter);
    if (autoFilter.includes('#REF!')) {
      delete ws.autoFilter;
    } else {
      ws.autoFilter = autoFilter;
    }
  }
};

/**
 * Wraps ExcelJS's spliceColumns, which moves cell values but leaves merged ranges and references to the moved
 * cells where they were, and drops falsy formula results from the cells it moves.
 */
export const spliceColumns = (ws: Worksheet, start: number, deleteCount: number, insertCount = 0): void => {
  const moveColumn = getColumnAfterSplice(start, deleteCount, insertCount);
  const merges = getMergedRanges(ws);
  const falsyResults = getFalsyFormulaResults(ws);
  merges.forEach(({ top, left, bottom, right }) => ws.unMergeCells(top, left, bottom, right));

  ws.spliceColumns(start, deleteCount, ...new globalThis.Array<[]>(insertCount).fill([]));

  falsyResults.forEach(({ row, col, result }) => pipe(
    moveColumn(col),
    Option.map(newCol => setFormulaResult(ws.getCell(row, newCol), result)),
  ));
  pipe(
    merges,
    Array.filterMap(getMergeAfterSplice(moveColumn)),
    Array.forEach(({ top, left, bottom, right }) => ws.mergeCells(top, left, bottom, right)),
  );
  shiftReferences(ws, moveColumn);
};

export const clearSheetFormatting = (ws: Worksheet): void => {
  unshareFormulas(ws);
  ws.removeConditionalFormatting(null);
  ws.dataValidations.model = {};
  removeTrailingEmptyRows(ws);
  ws.eachRow({ includeEmpty: true }, clearRowFormatting);
  clearHeaderComments(ws);
  clearInvalidNoteInsets(ws);
  removeColumnsPastSheetEnd(ws);
  getColumns(ws).forEach(setDefaultColumnStyle);
  clearFrozenPanes(ws);
};

// Index 0 is left empty so the indexes line up with ExcelJS's 1-based column numbers. A cell's text is what it
// displays, so rich text and formula headers resolve to their name too. Trailing empty cells are dropped.
export const getHeaderNames = (worksheet: Worksheet): string[] => pipe(
  getRowCells(worksheet.getRow(1)),
  cells => Array.makeBy(cells.length + 1, col => col === 0 ? '' : cells[col - 1]?.text ?? ''),
  names => names.slice(0, names.findLastIndex(name => name !== '') + 1),
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

export const findFirstEmptyColumnIndex = (sheet: Worksheet): number => sheet.getRow(1).cellCount + 1;
export const setHeaderValue = (label: string) => (
  [sheet, columnIndex]: [Worksheet, number]
): string => sheet.getCell(1, columnIndex).value = label;
export const setColumnValues = (values: readonly string[]) => (
  [sheet, columnIndex]: [Worksheet, number]
): void => values.forEach((value, idx) => sheet.getCell(idx + 2, columnIndex).value = value);

