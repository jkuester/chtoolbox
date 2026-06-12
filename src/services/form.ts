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

const SETTINGS_COLUMNS: Record<string, {
  /** The complete set of values allowed in this column (offered as a dropdown; e.g. ['', 'true']) */
  supportedValues?: readonly string[],
}> = {
  allow_choice_duplicates: { supportedValues: ['', 'yes']},
  form_title: {},
  namespaces: {},
  style: { supportedValues: ['', 'pages']},
  version: {},
};

const CHOICES_COLUMNS: Record<string, {
  /** Multiple versions of this column can be added for different languages */
  translatable?: boolean,
}> = {
  audio: { translatable: true },
  image: { translatable: true },
  label: { translatable: true },
  list_name: {},
  name: {},
  video: { translatable: true },
};
const CHOICES_COLUMN_NAMES_TRANSLATABLE = pipe(
  Record.toEntries(CHOICES_COLUMNS),
  Array.filter(([, { translatable }]) => !!translatable),
  Array.map(Tuple.getFirst),
);

const SURVEY_COLUMNS: Record<string, {
  /** Multiple versions of this column can be added for different languages */
  translatable?: boolean,
  /** Values in the column can be XPath expressions */
  expression?: boolean,
  /** The complete set of values allowed in this column (offered as a dropdown; e.g. ['', 'true']) */
  supportedValues?: readonly string[],
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
  'instance::cht:unique_tel': { supportedValues: ['', 'true'] },
  'instance::db-doc': { supportedValues: ['', 'true'] },
  'instance::db-doc-ref': {},
  'instance::type': { supportedValues: ['', 'binary'] },
  label: { translatable: true },
  name: {},
  note: {},
  parameters: {},
  read_only: { supportedValues: ['', 'true'] },
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
const STYLE_HEADER_EMPTY: Partial<ExcelJS.Style> = {
  font: { ...BASE_FONT, bold: true, italic: true },
  fill: FILL_GREY,
  border: BORDER_HEADER_SIDES,
};
const STYLE_HEADER_TRANSLATABLE_EMPTY: Partial<ExcelJS.Style> = {
  font: { ...BASE_FONT, bold: true, italic: true },
  fill: FILL_GREEN,
  border: BORDER_HEADER_SIDES,
};
const STYLE_HEADER_EXPRESSION_EMPTY: Partial<ExcelJS.Style> = {
  font: { ...BASE_FONT, bold: true, italic: true },
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

const clearFrozenPanes = (ws: Worksheet): void => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  ws.views = ws.views?.filter(view => view.state !== 'frozen');
};
const clearSheetFormatting = (ws: Worksheet): void => {
  ws.removeConditionalFormatting(null);
  ws.dataValidations.model = {};
  ws.eachRow({ includeEmpty: true }, clearRowFormatting);
  clearHeaderComments(ws);
  ws.columns.forEach(setDefaultStyle);
  clearFrozenPanes(ws);
};
const clearChtxSheet = (workbook: ExcelJS.Workbook) => workbook.removeWorksheet(SHEET_NAME_CHTX);
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
  Option.map(colIndex => worksheet.getColumn(colIndex).letter)
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
const nonEmptyValues = (values: readonly string[]) => Array.filter(values, value => value !== '');

const validateColumnSupportedValues = (sheet: Worksheet) => (
  [column, values]: [string, readonly string[]]
) => sheet.dataValidations.add(getTypeValidationRange(column, sheet.rowCount), {
  type: 'list',
  allowBlank: true,
  formulae: [`"${values.join(',')}"`],
  showErrorMessage: true,
  errorStyle: 'stop',
  errorTitle: 'Invalid value',
  error: `This column only accepts ${nonEmptyValues(values).map(v => `"${v}"`).join(', ')} or an empty value.`,
});
const setSupportedValuesValidation = (columns: ColumnsWithSupportedValues) => (sheet: Worksheet) => pipe(
  supportedValueColumns(columns, sheet),
  Array.forEach(validateColumnSupportedValues(sheet))
);

const formatColumnSupportedValues = (sheet: Worksheet) => (
  [column, values]: [string, readonly string[]]
) => {
  sheet.getColumn(column).numFmt = '@';
  sheet.addConditionalFormatting({
    ref: getTypeValidationRange(column, sheet.rowCount),
    rules: [{
      type: 'expression',
      formulae: [`AND(${column}2<>"",${nonEmptyValues(values).map(v => `${column}2<>"${v}"`).join(',')})`],
      style: { ...STYLE_ERROR },
      priority: 1,
    }]
  });
};
const setSupportedValuesFormatting = (columns: ColumnsWithSupportedValues) => (sheet: Worksheet) => pipe(
  supportedValueColumns(columns, sheet),
  Array.forEach(formatColumnSupportedValues(sheet))
);

const setSurveySupportedValuesValidation = setSupportedValuesValidation(SURVEY_COLUMNS);
const setSurveySupportedValuesFormatting = setSupportedValuesFormatting(SURVEY_COLUMNS);
const setSettingsSupportedValuesValidation = setSupportedValuesValidation(SETTINGS_COLUMNS);
const setSettingsSupportedValuesFormatting = setSupportedValuesFormatting(SETTINGS_COLUMNS);

const buildTranslatableHeaderFormula = (cell: string, names: readonly string[]) => pipe(
  names,
  Array.flatMap(name => [
    `${cell}="${name}"`,
    `LEFT(${cell},${String(name.length + 2)})="${name}::"`,
  ]),
  parts => `OR(${parts.join(',')})`,
);
const buildKnownHeaderFormula = (cell: string, names: readonly string[]) => pipe(
  names,
  Array.map(name => `"${name}"`),
  quoted => `NOT(ISERROR(MATCH(${cell},{${quoted.join(',')}},0)))`,
);
const buildEmptyBodyFormula = (worksheet: Worksheet) =>
  `COUNTA(A$2:A$${String(worksheet.rowCount + BUFFER_ROW_COUNT)})=0`;
const buildEmptyColumnFormula = (worksheet: Worksheet) => `AND(A1<>"",${buildEmptyBodyFormula(worksheet)})`;

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

// The choices sheet permits arbitrary columns, so this only offers the known names as a dropdown; any other
// value is allowed. errorStyle 'information' lets the user keep an off-list value with a single OK (a fully
// silent free-entry dropdown isn't possible since LibreOffice blocks off-list entries when the error is off).
const setChoicesHeaderValidation = (workbook: ExcelJS.Workbook) => (
  worksheet: Worksheet
) => pipe(
  Record.keys(CHOICES_COLUMNS),
  writeChtxColumn(workbook, 'choices_header_names'),
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

const setSettingsHeaderValidation = (workbook: ExcelJS.Workbook) => (
  worksheet: Worksheet
) => pipe(
  Record.keys(SETTINGS_COLUMNS),
  writeChtxColumn(workbook, 'settings_header_names'),
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
      error: 'Unexpected column name.',
    }),
  )),
);

const setSurveyHeaderFormatting = (worksheet: Worksheet) => pipe(
  Tuple.make(
    buildTranslatableHeaderFormula('A1', SURVEY_COLUMN_NAMES_TRANSLATABLE),
    buildKnownHeaderFormula('A1', SURVEY_COLUMN_NAMES_BASIC),
    buildKnownHeaderFormula('A1', SURVEY_COLUMN_NAMES_EXPRESSION),
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
        formulae: [`AND(A1<>"",NOT(${translatable}),NOT(${valid}),NOT(${expression}))`],
        style: { ...STYLE_ERROR },
        priority: 2,
      },
      {
        type: 'expression',
        formulae: [`AND(${translatable},${buildEmptyBodyFormula(worksheet)})`],
        style: { ...STYLE_HEADER_TRANSLATABLE_EMPTY },
        priority: 3,
      },
      {
        type: 'expression',
        formulae: [`AND(${valid},${buildEmptyBodyFormula(worksheet)})`],
        style: { ...STYLE_HEADER_EMPTY },
        priority: 4,
      },
      {
        type: 'expression',
        formulae: [`AND(${expression},${buildEmptyBodyFormula(worksheet)})`],
        style: { ...STYLE_HEADER_EXPRESSION_EMPTY },
        priority: 5,
      },
      {
        type: 'expression',
        formulae: [translatable],
        style: { ...STYLE_HEADER_TRANSLATABLE },
        priority: 6,
      },
      {
        type: 'expression',
        formulae: [valid],
        style: { ...STYLE_HEADER },
        priority: 7,
      },
      {
        type: 'expression',
        formulae: [expression],
        style: { ...STYLE_HEADER_EXPRESSION },
        priority: 8,
      },
    ],
  }),
  formatting => worksheet.addConditionalFormatting(formatting)
);

const setChoicesHeaderFormatting = (worksheet: Worksheet) => pipe(
  Tuple.make(
    buildTranslatableHeaderFormula('A1', CHOICES_COLUMN_NAMES_TRANSLATABLE),
    worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter
  ),
  ([translatable, lastCol]): ExcelJS.ConditionalFormattingOptions => ({
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
        formulae: [`AND(${translatable},${buildEmptyBodyFormula(worksheet)})`],
        style: { ...STYLE_HEADER_TRANSLATABLE_EMPTY },
        priority: 2,
      },
      {
        type: 'expression',
        formulae: [buildEmptyColumnFormula(worksheet)],
        style: { ...STYLE_HEADER_EMPTY },
        priority: 3,
      },
      {
        type: 'expression',
        formulae: [translatable],
        style: { ...STYLE_HEADER_TRANSLATABLE },
        priority: 4,
      },
      {
        type: 'expression',
        formulae: ['A1<>""'],
        style: { ...STYLE_HEADER },
        priority: 5,
      },
    ],
  }),
  formatting => worksheet.addConditionalFormatting(formatting)
);

const setSettingsHeaderFormatting = (worksheet: Worksheet) => pipe(
  Tuple.make(
    buildKnownHeaderFormula('A1', Record.keys(SETTINGS_COLUMNS)),
    worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter
  ),
  ([valid, lastCol]): ExcelJS.ConditionalFormattingOptions => ({
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
        formulae: [`AND(A1<>"",NOT(${valid}))`],
        style: { ...STYLE_ERROR },
        priority: 2,
      },
      {
        type: 'expression',
        formulae: [buildEmptyColumnFormula(worksheet)],
        style: { ...STYLE_HEADER_EMPTY },
        priority: 3,
      },
      {
        type: 'expression',
        formulae: [valid],
        style: { ...STYLE_HEADER },
        priority: 4,
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
      formulae: [`AND($${typeCol}2="${type}",A$1<>"")`],
      style: { ...style },
      priority: 1,
    }]
  })
);
const setSurveyBeginGroupFormatting = setSurveyGroupBoundaryFormatting('begin_group', STYLE_BEGIN_GROUP);
const setSurveyEndGroupFormatting = setSurveyGroupBoundaryFormatting('end_group', STYLE_END_GROUP);
const setSurveyBeginRepeatFormatting = setSurveyGroupBoundaryFormatting('begin_repeat', STYLE_BEGIN_REPEAT);
const setSurveyEndRepeatFormatting = setSurveyGroupBoundaryFormatting('end_repeat', STYLE_END_REPEAT);

// Freeze the header row and the first two columns so they stay visible while scrolling.
const freezeHeaderAndKeyColumns = (worksheet: Worksheet): void => {
  worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
};

const formatSurveyWorksheet = (workbook: ExcelJS.Workbook) => pipe(
  getWorksheetWithName(workbook)(SHEET_NAME_SURVEY),
  Option.map(surveySheet => pipe(
    surveySheet,
    Effect.succeed,
    Effect.tap(freezeHeaderAndKeyColumns),
    Effect.tap(setSurveyHeaderFormatting),
    Effect.tap(setSurveyHeaderValidation(workbook)),
    Effect.tap(setSurveyTypeFormatting(workbook)),
    Effect.tap(setSurveyTypeValidation),
    Effect.tap(setSurveySupportedValuesValidation),
    Effect.tap(setSurveySupportedValuesFormatting),
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

const formatChoicesWorksheet = (workbook: ExcelJS.Workbook) => pipe(
  getWorksheetWithName(workbook)(SHEET_NAME_CHOICES),
  Option.map(choicesSheet => pipe(
    choicesSheet,
    Effect.succeed,
    Effect.tap(freezeHeaderAndKeyColumns),
    Effect.tap(setChoicesHeaderFormatting),
    Effect.tap(setChoicesHeaderValidation(workbook)),
  )),
  Option.getOrElse(() => Effect.void)
);

const formatSettingsWorksheet = (workbook: ExcelJS.Workbook) => pipe(
  getWorksheetWithName(workbook)(SHEET_NAME_SETTINGS),
  Option.map(settingsSheet => pipe(
    settingsSheet,
    Effect.succeed,
    Effect.tap(setSettingsHeaderFormatting),
    Effect.tap(setSettingsHeaderValidation(workbook)),
    Effect.tap(setSettingsSupportedValuesValidation),
    Effect.tap(setSettingsSupportedValuesFormatting),
  )),
  Option.getOrElse(() => Effect.void)
);

const formatWorkbook = (workbook: ExcelJS.Workbook) => pipe(
  Effect.succeed(workbook),
  Effect.tap(clearWorkbookFormatting),
  Effect.tap(formatSurveyWorksheet),
  Effect.tap(formatChoicesWorksheet),
  Effect.tap(formatSettingsWorksheet),
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
