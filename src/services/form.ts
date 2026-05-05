import { Effect, pipe, Array, Option, Match, Predicate } from 'effect';
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
  'hidden',
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
const clearRowFormatting = (row: ExcelJS.Row) => row.eachCell({ includeEmpty: true }, setDefaultStyle);
// ExcelJS has no public API to remove a comment.
const clearHeaderComments = (ws: Worksheet) => ws
  .getRow(1)
  .eachCell({ includeEmpty: true }, clearComment);

const clearSheetFormatting = (ws: Worksheet): void => {
  ws.removeConditionalFormatting(null);
  ws.dataValidations.model = {};
  ws.eachRow({ includeEmpty: true }, clearRowFormatting);
  clearHeaderComments(ws);
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
  Array.filter(Predicate.isNotNullable),
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
  Option.map(colIndex => String.fromCodePoint(64 + colIndex))
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

const SELECT_ONE_PREFIX = 'select_one ';
const SELECT_MULTIPLE_PREFIX = 'select_multiple ';
const FILL_RED: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } };
const TYPE_VALIDATION_BUFFER_ROWS = 1000;
const getTypeValidationRange = (column: string, rowCount: number) =>
  `${column}2:${column}${String(rowCount + TYPE_VALIDATION_BUFFER_ROWS)}`;
const startsWithSelectPrefix = (type: string) => type.startsWith(SELECT_ONE_PREFIX)
  || type.startsWith(SELECT_MULTIPLE_PREFIX);
const selectChoicesSubFormula = (prefix: string, cell: string, choicesListNameRange: Option.Option<string>) => pipe(
  choicesListNameRange,
  Option.map(
    r => `AND(LEFT(${cell},${prefix.length.toString()})="${prefix}",`
    + `NOT(ISERROR(MATCH(MID(${cell},${(prefix.length + 1).toString()},999),${r},0))))`
  ),
  Option.getOrElse(() => 'FALSE'),
);
const buildIsInvalidTypeFormula = (cell: string, choicesListNameRange: Option.Option<string>) => pipe(
  SURVEY_FIELD_TYPES,
  Array.filter(Predicate.not(startsWithSelectPrefix)),
  Array.map(t => `"${t}"`),
  Array.join(','),
  fixedListLiteral => `NOT(ISERROR(MATCH(${cell},{${fixedListLiteral}},0)))`,
  isFixed => `AND(${cell}<>"",NOT(OR(${isFixed},${
    selectChoicesSubFormula(SELECT_ONE_PREFIX, cell, choicesListNameRange)
  },${
    selectChoicesSubFormula(SELECT_MULTIPLE_PREFIX, cell, choicesListNameRange)
  })))`
);

const getChoicesListNameRange = (workbook: ExcelJS.Workbook) => pipe(
  getWorksheetWithName(workbook)('choices'),
  Option.flatMap(choices => pipe(
    getColumnLetter('list_name', choices),
    Option.map(letter => `choices!$${letter}:$${letter}`),
  )),
);

const formatSurveyType = (workbook: ExcelJS.Workbook) => (surveySheet: Worksheet) => pipe(
  getColumnLetter('type', surveySheet),
  Option.getOrThrowWith(() => new Error('No "type" column found in survey sheet.')),
  column => pipe(
    getChoicesListNameRange(workbook),
    choicesListNameRange => buildIsInvalidTypeFormula(`${column}2`, choicesListNameRange),
    formula => surveySheet.addConditionalFormatting({
      ref: getTypeValidationRange(column, surveySheet.rowCount),
      rules: [{
        type: 'expression',
        formulae: [formula],
        style: { fill: FILL_RED },
        priority: 1,
      }]
    })
  ),
  () => []
);

const validateSurveyType = (surveySheet: Worksheet) => pipe(
  getColumnLetter('type', surveySheet),
  Option.getOrThrowWith(() => new Error('No "type" column found in survey sheet.')),
  column => surveySheet.dataValidations.add(getTypeValidationRange(column, surveySheet.rowCount), {
    type: 'list',
    allowBlank: true,
    formulae: [`"${SURVEY_FIELD_TYPES.join(',')}"`],
    // LibreOffice silently blocks off-list entries when showErrorMessage is false (ignoring the xlsx
    // spec). Keep it true with errorStyle 'information' so the user can override with a single OK.
    showErrorMessage: true,
    errorStyle: 'information',
    errorTitle: 'Type warning',
    error: 'If configuring a select, ensure your list name matches a list from the choices sheet.',
  }),
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
    formatSurveyType(workbook)(surveyWorksheet),
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
