import { Effect, pipe, Array, Option, Match } from 'effect';
import ExcelJS from 'exceljs';

type Worksheet = ExcelJS.Worksheet & {
  // worksheet.dataValidations exists at runtime but isn't in the public TS types.
  dataValidations: {
    model: object;
    add: (range: string, validation: ExcelJS.DataValidation) => void;
  };
};

const SURVEY_COLUMN_NAMES = [
  'appearance',
  'calculation',
  'choice_filter',
  'constraint',
  'default',
  'instance::cht:duration',
  'instance::cht:unique_tel',
  'instance::db-doc',
  'instance::db-doc-ref',
  'instance::type',
  'name',
  'note',
  'parameters',
  'read_only',
  'relevant',
  'repeat_count',
  'repeat_count',
  'required',
  'type',
];
const SURVEY_COLUMN_NAMES_TRANSLATABLE = [
  'label',
  'required_message',
  'constraint_message',
  'hint',
  'image',
  'audio',
  'video',
];
const SURVEY_FIELD_TYPES = [
  'text',
  'integer',
  'decimal',
  'note',
  'calculate',
  'select_one list_name',
  'select_multiple list_name',
  'begin_repeat',
  'end_repeat',
  'begin_group',
  'end_group',
  'geopoint',
  'geotrace',
  'geoshape',
  'range',
  'image',
  'audio',
  'video',
  'file',
  'date',
  'time',
  'datetime',
  'rank',
  'acknowledge',
  'start',
  'end',
  'today',
];

const SHEET_NAMES = ['survey', 'settings', 'choices'];
const BASE_FONT: Partial<ExcelJS.Font> = { name: 'Liberation Sans', size: 10 };
const BASE_ALIGNMENT: Partial<ExcelJS.Alignment> = { vertical: 'bottom' };
const STYLE_DEFAULT: Partial<ExcelJS.Style> = { font: { ...BASE_FONT }, alignment: { ...BASE_ALIGNMENT } };
const FILL_GREY: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
const FILL_GREEN: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFAFD095' } };
const BORDER_DARK_GREY: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF808080' } };
const BORDER_HEADER_SIDES: Partial<ExcelJS.Borders> = {
  left: BORDER_DARK_GREY,
  right: BORDER_DARK_GREY,
};
const STYLE_HEADER: Partial<ExcelJS.Style> = {
  font: { ...BASE_FONT, bold: true },
  fill: FILL_GREY,
  border: BORDER_HEADER_SIDES,
};
const STYLE_HEADER_TRANSLATABLE: Partial<ExcelJS.Style> = {
  font: { ...BASE_FONT, bold: true },
  fill: FILL_GREEN,
  border: BORDER_HEADER_SIDES,
};

const loadWorkbook = (filePath: string) => pipe(
  new ExcelJS.Workbook(),
  workbook => Effect.tryPromise(() => workbook.xlsx.readFile(filePath)),
);
const saveWorkbook = (
  filePath: string
) => (workbook: ExcelJS.Workbook) => Effect.promise(() => workbook.xlsx.writeFile(filePath));

const worksheetHasName = (targetName: string) => ({ name }: ExcelJS.Worksheet) => name === targetName;
const getWorksheetWithName = (
  workbook: ExcelJS.Workbook
) => (name: string) => pipe(
  Array.findFirst(workbook.worksheets, worksheetHasName(name)),
  Option.map(worksheet => worksheet as Worksheet)
);

const setDefaultStyle = (obj: object) => Object.assign(obj, { style: { ...STYLE_DEFAULT } });
const clearComment = (cell: ExcelJS.Cell) => pipe(
  cell as { _comment?: unknown; _value?: { model?: { comment?: unknown } } },
  c => Object.assign(c, { _comment: undefined }),
  c => c._value?.model ? Object.assign(c._value.model, { comment: undefined }) : c
);
const clearCellFormatting = (cell: ExcelJS.Cell) => {
  setDefaultStyle(cell);
  // ExcelJS has no public API to remove a comment.
  clearComment(cell);// TODO Actually probably do not need this on all cells.
};
const clearRowFormatting = (row: ExcelJS.Row) => row.eachCell({ includeEmpty: true }, clearCellFormatting);

const clearSheetFormatting = (ws: Worksheet): void => {
  ws.removeConditionalFormatting(null);
  ws.dataValidations.model = {};
  ws.eachRow({ includeEmpty: true }, clearRowFormatting);
  ws.columns.forEach(setDefaultStyle);
};
const clearWorkbookFormatting = (workbook: ExcelJS.Workbook) => pipe(
  SHEET_NAMES,
  Array.map(getWorksheetWithName(workbook)),
  Array.filter(Option.isSome),
  Array.map(Option.getOrThrow),
  Array.forEach(clearSheetFormatting),
  () => []
);

const getHeaderNames = (worksheet: Worksheet) => pipe(
  worksheet.getRow(1).values,
  values => Array.isArray(values) ? values : Object.values(values),
  Array.filter(Boolean),
  Array.map(Option.liftPredicate((val) => typeof val === 'string')),
  Array.map(Option.getOrThrowWith(() => new Error('Invalid column header'))),
);
const getColumnIndex = (colName: string) => (worksheet: Worksheet) => pipe(
  getHeaderNames(worksheet),
  Array.findFirstIndex(val => val === colName),
  Option.map(index => index + 1), // ExcelJS columns are 1-indexed
);
const getColumnLetter = (colName: string, worksheet: Worksheet) => pipe(
  getColumnIndex(colName)(worksheet),
  Option.map(colIndex => String.fromCharCode(64 + colIndex))
);

const isTranslatableSurveyColumn = (header: string) => SURVEY_COLUMN_NAMES_TRANSLATABLE
  .some(name => header === name || header.startsWith(`${name}::`));
const isSurveyColumn = (header: string) => SURVEY_COLUMN_NAMES.includes(header)
  || isTranslatableSurveyColumn(header);
const validateSurveyColumns = (surveySheet: Worksheet) => pipe(
  getHeaderNames(surveySheet),
  x => x,
  Array.filter(header => !isSurveyColumn(header)),
  Match.value,
  Match.when(Array.isEmptyArray, () => []),
  Match.orElse(invalidHeaders => [`Invalid survey column(s): ${invalidHeaders.join(', ')}`]),
);

const formatSurveyType = (surveySheet: Worksheet) => pipe(
  getColumnLetter('type', surveySheet),
  Option.getOrThrowWith(() => new Error('No "type" column found in survey sheet.')),
  column => surveySheet.addConditionalFormatting({
    ref: `${column}2:${column}${String(surveySheet.rowCount)}`,
    rules: [{
      type: 'containsText',
      operator: 'containsText',
      text: 'text',
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } } },
      priority: 1,
    }]
  }),
  () => []
);

const getColumnValuesRange = (rowCount: number) => (column: string) => `${column}2:${column}${String(rowCount + 1000)}`;

const validateSurveyType = (surveySheet: Worksheet) => pipe(
  getColumnLetter('type', surveySheet),
  Option.getOrThrowWith(() => new Error('No "type" column found in survey sheet.')),
  getColumnValuesRange(surveySheet.rowCount),
  range => {
    surveySheet.dataValidations.add(range, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${SURVEY_FIELD_TYPES.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Unknown type',
      error: 'If configuring a select, ensure your list name matches a list from the choices sheet.',
    });
  },
  () => []
);

const getHeaderStyle = (cell: ExcelJS.Cell) => pipe(
  STYLE_HEADER_TRANSLATABLE,
  Option.liftPredicate(() => typeof cell.value === 'string' && isTranslatableSurveyColumn(cell.value)),
  Option.getOrElse(() => STYLE_HEADER),
  style => ({ ...style })
);

const formatHeader = (worksheet: Worksheet): readonly string[] => pipe(
  worksheet.getRow(1),
  header => header.eachCell({ includeEmpty: true }, (cell) => Object.assign(cell.style, getHeaderStyle(cell))),
  () => []
);

const formatSurveyWorksheet = (workbook: ExcelJS.Workbook) => pipe(
  getWorksheetWithName(workbook)('survey'),
  Option.getOrThrowWith(() => new Error('No "survey" sheet found in workbook.')),
  surveyWorksheet => Array.flatten([
    validateSurveyColumns(surveyWorksheet),
    formatSurveyType(surveyWorksheet),
    validateSurveyType(surveyWorksheet),
    formatHeader(surveyWorksheet)
  ]),
);

const formatWorkbook = (workbook: ExcelJS.Workbook) => pipe(
  Array.flatten([
    clearWorkbookFormatting(workbook),
    formatSurveyWorksheet(workbook)
  ]),
  Effect.succeed
);

const formatFile = Effect.fn((filePath: string): Effect.Effect<string[], Error> => Effect.acquireUseRelease(
  loadWorkbook(filePath),
  formatWorkbook,
  saveWorkbook(filePath)
));

export class FormService extends Effect.Service<FormService>()('chtoolbox/FormService', {
  effect: Effect.succeed({
    formatFile,
  }),
  accessors: true,
}) {}
