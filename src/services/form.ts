import { Effect, pipe, Array, Option, Predicate, Tuple, Order, Record } from 'effect';
import ExcelJS from 'exceljs';

type Worksheet = ExcelJS.Worksheet & {
  // worksheet.dataValidations exists at runtime but isn't in the public TS types.
  dataValidations: {
    model: object;
    add: (range: string, validation: ExcelJS.DataValidation) => void;
  };
};

const BUFFER_COL_COUNT = 50;
const BUFFER_ROW_COUNT = 1000;

const SURVEY_COLUMNS: Record<string, {
  /** Multiple versions of this column can be added for different languages */
  translatable?: boolean,
  /** Values in the column can be XPath expressions */
  expression?: boolean,
  /** Values in this column can only be `true` or empty */
  trueOnly?: boolean,
}> = {
  appearance: {},
  audio: { translatable: true },
  calculation: { expression: true },
  choice_filter: { expression: true },
  constraint: { expression: true },
  constraint_message: { translatable: true },
  default: { expression: true },
  hint: { translatable: true },
  image: { translatable: true },
  'instance::cht:duration': {},
  'instance::cht:unique_tel': { trueOnly: true },
  'instance::db-doc': { trueOnly: true },
  'instance::db-doc-ref': {},
  'instance::type': {},
  label: { translatable: true },
  name: {},
  note: {},
  parameters: {},
  read_only: { trueOnly: true },
  relevant: { expression: true },
  repeat_count: { expression: true },
  required: { expression: true },
  required_message: { translatable: true },
  type: {},
  video: { translatable: true },
};
const SURVEY_COLUMN_NAMES_TRANSLATABLE = pipe(
  Record.toEntries(SURVEY_COLUMNS),
  Array.filter(([, { translatable }]) => !!translatable),
  Array.map(Tuple.getFirst),
);
const SURVEY_COLUMN_NAMES_EXPRESSION = pipe(
  Record.toEntries(SURVEY_COLUMNS),
  Array.filter(([, { expression }]) => !!expression),
  Array.map(Tuple.getFirst),
);
const SURVEY_COLUMN_NAMES_BASIC = pipe(
  Record.toEntries(SURVEY_COLUMNS),
  Array.filter(([, { translatable, expression }]) => !translatable && !expression),
  Array.map(Tuple.getFirst),
);
const SURVEY_COLUMN_NAMES_TRUE_ONLY = pipe(
  Record.toEntries(SURVEY_COLUMNS),
  Array.filter(([, { trueOnly }]) => !!trueOnly),
  Array.map(Tuple.getFirst),
);
const LABEL_TRANSLATABLE_PREFIX = 'label::';

const SURVEY_FIELDS: Record<string, { labeled? : boolean }> = {
  acknowledge: { labeled: true },
  audio: { labeled: true },
  begin_group: {},
  begin_repeat: {},
  calculate: {},
  date: { labeled: true },
  datetime: { labeled: true },
  decimal: { labeled: true },
  end: {},
  end_group: {},
  end_repeat: {},
  file: { labeled: true },
  geopoint: { labeled: true },
  geoshape: { labeled: true },
  geotrace: { labeled: true },
  hidden: {},
  image: { labeled: true },
  integer: { labeled: true },
  note: { labeled: true },
  range: { labeled: true },
  rank: { labeled: true },
  'select_multiple list_name': { labeled: true },
  'select_one list_name': { labeled: true },
  start: {},
  text: { labeled: true },
  time: { labeled: true },
  today: {},
  video: { labeled: true },
};
const SURVEY_FIELD_TYPES = Record.keys(SURVEY_FIELDS);
const SURVEY_FIELD_TYPES_LABELED = pipe(
  Record.toEntries(SURVEY_FIELDS),
  Array.filter(([, { labeled }]) => !!labeled),
  Array.map(Tuple.getFirst),
);

const SHEET_NAME_SURVEY = 'survey';
const SHEET_NAME_CHOICES = 'choices';
const SHEET_NAME_SETTINGS = 'settings';
const SHEET_NAME_CHTX = 'chtx';
const SHEET_NAMES = [SHEET_NAME_SURVEY, SHEET_NAME_CHOICES, SHEET_NAME_SETTINGS];

const BASE_FONT: Partial<ExcelJS.Font> = { name: 'Liberation Sans', size: 10 };
const BASE_ALIGNMENT: Partial<ExcelJS.Alignment> = { vertical: 'bottom' };
const STYLE_DEFAULT: Partial<ExcelJS.Style> = { font: { ...BASE_FONT }, alignment: { ...BASE_ALIGNMENT } };
const FILL_GREY: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
const FILL_BLUE_GREY: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCF0' } };
const FILL_GREEN: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFAFD095' } };
const BORDER_DARK_GREY: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF808080' } };
const BORDER_BLUE: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: 'FF0070C0' } };
const BORDER_PURPLE: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: 'FF7030A0' } };
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
const STYLE_HEADER_EXPRESSION: Partial<ExcelJS.Style> = {
  font: { ...BASE_FONT, bold: true },
  fill: FILL_BLUE_GREY,
  border: BORDER_HEADER_SIDES,
};
const STYLE_ERROR: Partial<ExcelJS.Style> = {
  fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } }
};
const STYLE_BEGIN_GROUP: Partial<ExcelJS.Style> = {
  border: { top: BORDER_BLUE }
};
const STYLE_END_GROUP: Partial<ExcelJS.Style> = {
  border: { bottom: BORDER_BLUE }
};
const STYLE_BEGIN_REPEAT: Partial<ExcelJS.Style> = {
  border: { top: BORDER_PURPLE }
};
const STYLE_END_REPEAT: Partial<ExcelJS.Style> = {
  border: { bottom: BORDER_PURPLE }
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
// TODO Ultimately we may not want hard-coded comments at all (goal is to have config be as guided as possible).
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
const clearChtxSheet = (workbook: ExcelJS.Workbook) => pipe(
  workbook.getWorksheet(SHEET_NAME_CHTX),
  Option.fromNullable,
  Option.map(sheet => sheet.spliceRows(1, sheet.rowCount)),
);
const clearWorkbookFormatting = (workbook: ExcelJS.Workbook) => pipe(
  SHEET_NAMES,
  Array.map(getWorksheetWithName(workbook)),
  Array.filter(Option.isSome),
  Array.map(Option.getOrThrow),
  Array.forEach(clearSheetFormatting),
  () => clearChtxSheet(workbook)
);

const getHeaderNames = (worksheet: Worksheet) => pipe(
  worksheet.getRow(1).values,
  values => Array.isArray(values) ? values : Object.values(values),
  Array.map(val => typeof val === 'string' ? val : ''),
);

const getColumnLetterMatching = (predicate: (val?: string) => boolean, worksheet: Worksheet) => pipe(
  getHeaderNames(worksheet),
  Array.findFirstIndex(predicate),
  Option.map(colIndex => String.fromCodePoint(64 + colIndex))
);
const getColumnLetter = (colName: string, worksheet: Worksheet) =>
  getColumnLetterMatching(val => val === colName, worksheet);
const getTypeColumnLetter = (worksheet: Worksheet) => Option.getOrThrowWith(
  getColumnLetter('type', worksheet),
  () => new Error('No "type" column found in worksheet.')
);

const SELECT_ONE_PREFIX = 'select_one ';
const SELECT_MULTIPLE_PREFIX = 'select_multiple ';
const getTypeValidationRange = (column: string, rowCount: number) =>
  `${column}2:${column}${String(rowCount + BUFFER_ROW_COUNT)}`;
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

const buildIsLabeledTypeFormula = (cell: string) => pipe(
  SURVEY_FIELD_TYPES_LABELED,
  Array.filter(Predicate.not(startsWithSelectPrefix)),
  Array.map(t => `"${t}"`),
  Array.join(','),
  fixedListLiteral => [
    `NOT(ISERROR(MATCH(${cell},{${fixedListLiteral}},0)))`,
    `LEFT(${cell},${SELECT_ONE_PREFIX.length.toString()})="${SELECT_ONE_PREFIX}"`,
    `LEFT(${cell},${SELECT_MULTIPLE_PREFIX.length.toString()})="${SELECT_MULTIPLE_PREFIX}"`,
  ],
  parts => `OR(${parts.join(',')})`,
);

const getChoicesListNameRange = (workbook: ExcelJS.Workbook) => pipe(
  getWorksheetWithName(workbook)(SHEET_NAME_CHOICES),
  Option.flatMap(choices => pipe(
    getColumnLetter('list_name', choices),
    Option.map(letter => `choices!$${letter}:$${letter}`),
  )),
);

const setSurveyTypeFormatting = (workbook: ExcelJS.Workbook) => (surveySheet: Worksheet) => pipe(
  getTypeColumnLetter(surveySheet),
  column => pipe(
    getChoicesListNameRange(workbook),
    choicesListNameRange => buildIsInvalidTypeFormula(`${column}2`, choicesListNameRange),
    formula => surveySheet.addConditionalFormatting({
      ref: getTypeValidationRange(column, surveySheet.rowCount),
      rules: [{
        type: 'expression',
        formulae: [formula],
        style: { ...STYLE_ERROR },
        priority: 1,
      }]
    })
  )
);

const setSurveyNameFormatting = (surveySheet: Worksheet) => pipe(
  getColumnLetter('name', surveySheet),
  Option.map(nameCol => Tuple.make(
    nameCol,
    getTypeColumnLetter(surveySheet),
  )),
  Option.map(([nameCol, typeCol]) => surveySheet.addConditionalFormatting({
    ref: getTypeValidationRange(nameCol, surveySheet.rowCount),
    rules: [{
      type: 'expression',
      formulae: [`AND(${typeCol}2<>"",${nameCol}2="")`],
      style: { ...STYLE_ERROR },
      priority: 1,
    }]
  }))
);

const setSurveyLabelFormatting = (surveySheet: Worksheet) => pipe(
  getColumnLetterMatching(val => !!val?.startsWith(LABEL_TRANSLATABLE_PREFIX), surveySheet),
  Option.map(labelCol => Tuple.make(
    labelCol,
    getTypeColumnLetter(surveySheet),
  )),
  Option.map(([labelCol, typeCol]) => surveySheet.addConditionalFormatting({
    ref: getTypeValidationRange(labelCol, surveySheet.rowCount),
    rules: [{
      type: 'expression',
      formulae: [`AND(${buildIsLabeledTypeFormula(typeCol + '2')},${labelCol}2="")`],
      style: { ...STYLE_ERROR },
      priority: 1,
    }]
  }))
);

const surveyFieldTypesFormulae = pipe(
  SURVEY_FIELD_TYPES,
  Array.sort(Order.string),
  Array.join(',')
);

const setSurveyTypeValidation = (surveySheet: Worksheet) => pipe(
  getTypeColumnLetter(surveySheet),
  column => surveySheet.dataValidations.add(getTypeValidationRange(column, surveySheet.rowCount), {
    type: 'list',
    allowBlank: true,
    formulae: [`"${surveyFieldTypesFormulae}"`],
    // LibreOffice silently blocks off-list entries when showErrorMessage is false (ignoring the xlsx
    // spec). Keep it true with errorStyle 'information' so the user can override with a single OK.
    showErrorMessage: true,
    errorStyle: 'information',
    errorTitle: 'Type warning',
    error: 'If configuring a select, ensure your list name matches a list from the choices sheet.',
  })
);

const trueOnlyColumnLetters = (surveySheet: Worksheet) => pipe(
  SURVEY_COLUMN_NAMES_TRUE_ONLY,
  Array.filterMap(name => getColumnLetter(name, surveySheet)),
);

const validateColumnAcceptOnlyTrue = (surveySheet: Worksheet) => (column: string) =>
  // The leading comma yields an empty option ahead of "true" in the dropdown.
  surveySheet.dataValidations.add(getTypeValidationRange(column, surveySheet.rowCount), {
    type: 'list',
    allowBlank: true,
    formulae: ['",true"'],
    showErrorMessage: true,
    errorStyle: 'information',
    errorTitle: 'Value warning',
    error: 'This column only accepts "true" or an empty value.',
  });
const setSurveyTrueOnlyValidation = (surveySheet: Worksheet) => pipe(
  trueOnlyColumnLetters(surveySheet),
  Array.forEach(validateColumnAcceptOnlyTrue(surveySheet))
);

const formatColumnAcceptOnlyTrue = (surveySheet: Worksheet) => (column: string) => {
  surveySheet.getColumn(column).numFmt = '@';
  surveySheet.addConditionalFormatting({
    ref: getTypeValidationRange(column, surveySheet.rowCount),
    rules: [{
      type: 'expression',
      formulae: [`AND(${column}2<>"",${column}2<>"true")`],
      style: { ...STYLE_ERROR },
      priority: 1,
    }]
  });
};
const setSurveyTrueOnlyFormatting = (surveySheet: Worksheet) => pipe(
  trueOnlyColumnLetters(surveySheet),
  Array.forEach(formatColumnAcceptOnlyTrue(surveySheet))
);

const buildTranslatableHeaderFormula = (cell: string) => pipe(
  SURVEY_COLUMN_NAMES_TRANSLATABLE,
  Array.flatMap(name => [
    `${cell}="${name}"`,
    `LEFT(${cell},${String(name.length + 2)})="${name}::"`,
  ]),
  parts => `OR(${parts.join(',')})`,
);
const buildSurveyHeaderFormula = (cell: string) => pipe(
  SURVEY_COLUMN_NAMES_BASIC,
  Array.map(name => `"${name}"`),
  names => `NOT(ISERROR(MATCH(${cell},{${names.join(',')}},0)))`,
);
const buildExpressionHeaderFormula = (cell: string) => pipe(
  SURVEY_COLUMN_NAMES_EXPRESSION,
  Array.map(name => `"${name}"`),
  names => `NOT(ISERROR(MATCH(${cell},{${names.join(',')}},0)))`,
);

const getChtxWorksheet = (workbook: ExcelJS.Workbook): Worksheet => pipe(
  getWorksheetWithName(workbook)(SHEET_NAME_CHTX),
  Option.getOrElse(() => workbook.addWorksheet(SHEET_NAME_CHTX) as Worksheet),
  worksheet => Object.assign(worksheet, { state: 'veryHidden' })
);

const findFirstEmptyColumnIndex = (sheet: Worksheet) => pipe(
  getHeaderNames(sheet),
  names => names.length + 1
);

const setHeaderValue = (label: string) => (
  [sheet, columnIndex]: [Worksheet, number]
) => sheet.getCell(1, columnIndex).value = label;
const setColumnValues = (values: readonly string[]) => (
  [sheet, columnIndex]: [Worksheet, number]
) => values.forEach((value, idx) => sheet.getCell(idx + 2, columnIndex).value = value);

const writeChtxColumn = (
  workbook: ExcelJS.Workbook,
  label: string
) => (
  values: readonly string[],
) => pipe(
  getChtxWorksheet(workbook),
  sheet => Tuple.make(sheet, findFirstEmptyColumnIndex(sheet)),
  Effect.succeed,
  Effect.tap(setHeaderValue(label)),
  Effect.tap(setColumnValues(values)),
  Effect.map(([sheet, columnIndex]) => pipe(
    sheet.getColumn(columnIndex).letter,
    colLetter => `'${SHEET_NAME_CHTX}'!$${colLetter}$2:$${colLetter}$${String(values.length + 1)}`
  ))
);

const setSurveyHeaderValidation = (workbook: ExcelJS.Workbook) => (
  worksheet: Worksheet
) => pipe(
  Record.keys(SURVEY_COLUMNS),
  writeChtxColumn(workbook, 'survey_header_names'),
  Effect.map(formula => pipe(
    worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter,
    lastCol => `A1:${lastCol}1`,
    range => worksheet.dataValidations.add(range, {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: 'information',
      errorTitle: 'Column warning',
      error: 'For translatable columns, you can append "::<lang>" to the column name (e.g., label::en).',
    }),
  )),
);

const setSurveyHeaderFormatting = (worksheet: Worksheet) => pipe(
  Tuple.make(
    buildTranslatableHeaderFormula('A1'),
    buildSurveyHeaderFormula('A1'),
    buildExpressionHeaderFormula('A1'),
    worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter
  ),
  ([translatable, valid, expression, lastCol]): ExcelJS.ConditionalFormattingOptions => ({
    ref: `A1:${lastCol}1`,
    rules: [
      {
        type: 'expression',
        formulae: [`AND(A1<>"",COUNTIF($A$1:$${lastCol}$1,A1)>1)`],
        style: { ...STYLE_ERROR },
        priority: 1,
      },
      {
        type: 'expression',
        formulae: [translatable],
        style: { ...STYLE_HEADER_TRANSLATABLE },
        priority: 2,
      },
      {
        type: 'expression',
        formulae: [valid],
        style: { ...STYLE_HEADER },
        priority: 3,
      },
      {
        type: 'expression',
        formulae: [expression],
        style: { ...STYLE_HEADER_EXPRESSION },
        priority: 4,
      },
      {
        type: 'expression',
        formulae: [`AND(A1<>"",NOT(${translatable}),NOT(${valid}),NOT(${expression}))`],
        style: { ...STYLE_ERROR },
        priority: 5,
      },
    ],
  }),
  formatting => worksheet.addConditionalFormatting(formatting)
);

const setSurveyHeaderlessCellFormatting = (worksheet: Worksheet) => pipe(
  worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter,
  lastCol => worksheet.addConditionalFormatting({
    ref: `A2:${lastCol}${String(worksheet.rowCount + BUFFER_ROW_COUNT)}`,
    rules: [{
      type: 'expression',
      formulae: ['AND(A2<>"",A$1="")'],
      style: { ...STYLE_ERROR },
      priority: 1,
    }]
  })
);

const setSurveyGroupBoundaryFormatting = (type: string, style: Partial<ExcelJS.Style>) => (
  worksheet: Worksheet
) => pipe(
  Tuple.make(
    getTypeColumnLetter(worksheet),
    worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter,
  ),
  ([typeCol, lastCol]) => worksheet.addConditionalFormatting({
    ref: `A2:${lastCol}${String(worksheet.rowCount + BUFFER_ROW_COUNT)}`,
    rules: [{
      type: 'expression',
      formulae: [`$${typeCol}2="${type}"`],
      style: { ...style },
      priority: 1,
    }]
  })
);
const setSurveyBeginGroupFormatting = setSurveyGroupBoundaryFormatting('begin_group', STYLE_BEGIN_GROUP);
const setSurveyEndGroupFormatting = setSurveyGroupBoundaryFormatting('end_group', STYLE_END_GROUP);
const setSurveyBeginRepeatFormatting = setSurveyGroupBoundaryFormatting('begin_repeat', STYLE_BEGIN_REPEAT);
const setSurveyEndRepeatFormatting = setSurveyGroupBoundaryFormatting('end_repeat', STYLE_END_REPEAT);

const formatSurveyWorksheet = (workbook: ExcelJS.Workbook) => pipe(
  getWorksheetWithName(workbook)(SHEET_NAME_SURVEY),
  Option.map(surveySheet => pipe(
    surveySheet,
    Effect.succeed,
    Effect.tap(setSurveyHeaderFormatting),
    Effect.tap(setSurveyHeaderValidation(workbook)),
    Effect.tap(setSurveyTypeFormatting(workbook)),
    Effect.tap(setSurveyTypeValidation),
    Effect.tap(setSurveyTrueOnlyValidation),
    Effect.tap(setSurveyTrueOnlyFormatting),
    Effect.tap(setSurveyNameFormatting),
    Effect.tap(setSurveyLabelFormatting),
    Effect.tap(setSurveyBeginGroupFormatting),
    Effect.tap(setSurveyEndGroupFormatting),
    Effect.tap(setSurveyBeginRepeatFormatting),
    Effect.tap(setSurveyEndRepeatFormatting),
    Effect.tap(setSurveyHeaderlessCellFormatting),
  )),
  Option.getOrElse(() => Effect.void)
);

const formatWorkbook = (workbook: ExcelJS.Workbook) => pipe(
  Effect.succeed(workbook),
  Effect.tap(clearWorkbookFormatting),
  Effect.tap(formatSurveyWorksheet),
  Effect.asVoid
);

const formatFile = Effect.fn((filePath: string): Effect.Effect<void, Error> => Effect.acquireUseRelease(
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
