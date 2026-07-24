import { Array, Effect, Option, Order, pipe, Predicate, Record, Tuple } from 'effect';
import ExcelJS from 'exceljs';
import {
  getColumnLetter,
  getColumnLettersMatching,
  getHeaderNames,
  setHeaderComments,
  STYLE,
  type Worksheet
} from '../xlsx.ts';
import {
  BUFFER_COL_COUNT,
  BUFFER_ROW_COUNT,
  buildEmptyBodyFormula,
  buildKnownHeaderFormula,
  buildTranslatableHeaderFormula,
  FORM_STYLE,
  getTypeColumnLetter,
  getTypeValidationRange,
  setSupportedValuesFormatting,
  setSupportedValuesValidation,
  writeChtxColumn
} from './index.ts';
import { getChoicesListNameRange } from './choices.ts';

const SURVEY_COLUMNS: Record<string, {
  /** Description of the column */
  comment: string,
  /** Multiple versions of this column can be added for different languages */
  translatable?: boolean,
  /** Values in the column can be XPath expressions */
  expression?: boolean,
  /** The complete set of values allowed in this column (offered as a dropdown; e.g. ['', 'true']) */
  supportedValues?: readonly string[],
}> = {
  appearance: {
    comment: 'One or more modifiers that determine how the question will be displayed.\n\nThese can be specific to '
      + 'the field type.',
  },
  audio: {
    comment: 'Specify the filename of an audio file. This will display a button to play the audio next to the '
      + 'question label.\n\nCan be translated.',
    translatable: true
  },
  calculation: {
    comment: 'An expression that will be evaluated to determine the value of the field.\n\nExpressions may be '
      + 're-evaluated at any time. Question types with calculations should be marked as read-only. Otherwise, a '
      + 'user-provided value may be replaced by a calculated one.\n\nTo limit when expressions are evaluated, '
      + 'for example to specify dynamic defaults, use the trigger column or the once() function. \n\n'
      + 'https://docs.getodk.org/form-logic/#when-expressions-are-evaluated',
    expression: true
  },
  choice_filter: {
    comment: 'Used with select questions to filter the choices shown to the user. The expression will be evaluated '
      + 'against each choice. If it evaluates to true, the choice is included.\n\nFor example, the expression '
      + '"country = ${country}" includes choices for which the country column\'s value matches the value of the '
      + '${country} field in the form.\n\nhttps://docs.getodk.org/form-logic/#filtering-options-in-select-questions',
    expression: true
  },
  constraint: {
    comment: 'An expression that determines whether a user-provided answer will be allowed or not. Constraint '
      + 'expressions use . to mean the value of the current field.',
    expression: true
  },
  constraint_message: {
    comment: 'A message shown when the constraint expression evaluates to false.\n\nCan be translated.',
    translatable: true
  },
  default: {
    comment: 'A fixed value or an expression that will be evaluated once on form load. The value can then be modified '
      + 'by the user.\n\nhttps://docs.getodk.org/form-logic/#setting-default-responses',
    expression: true
  },
  hint: {
    comment: 'A hint that will be shown to the user below the question\'s label in smaller text.\n\nCan be translated.',
    translatable: true
  },
  image: {
    comment: 'Specify the filename of an image to display in addition to or instead of a text label.\n\nCan be '
      + 'translated.',
    translatable: true
  },
  'instance::cht:duration': {
    comment: 'The custom duration to use for a countdown timer. Requires `cht=https://communityhealthtoolkit.org`'
      + 'to be set in the `namespaces` column on the settings sheet.\n\n'
      + 'https://docs.communityhealthtoolkit.org/apps/reference/forms/app/#countdo'
  },
  'instance::cht:unique_tel': {
    comment: 'Indicates that input for a telephone field should be rejected if the given number is already '
      + 'associated with an existing contact. Requires `cht=https://communityhealthtoolkit.org` to be'
      + ' set in the `namespaces` column on the settings sheet.\n\n'
      + 'https://docs.communityhealthtoolkit.org/apps/reference/forms/app/#phone-number-input',
    supportedValues: ['', 'true']
  },
  'instance::db-doc': {
    comment: 'Indicates the data for a group should be written to the database as a new document.\n\n'
      + 'https://docs.communityhealthtoolkit.org/apps/guides/forms/additional-docs/',
    supportedValues: ['', 'true']
  },
  'instance::db-doc-ref': {
    comment: 'Indicates that a calculate should be populated as part of the db-data workflow.\n\nSet the `/form_id` '
      + 'value to populate the field with the id of the report when it is submitted. Set `${group_name}` to '
      + 'populate the field with the id of the document written for the group_name group (assuming that group_name '
      + 'has been marked with instance::db-doc = true).\n\n'
      + 'https://docs.communityhealthtoolkit.org/apps/guides/forms/additional-docs/'
  },
  'instance::tag': {
    comment: 'Set `hidden` to hide the field on the Reports tab. Can alternatively use the `hidden_fields` array'
      + 'in the form properties file.\n\n'
      + 'https://docs.communityhealthtoolkit.org/building/translations/overview/#hiding-report-fields',
    supportedValues: ['', 'hidden']
  },
  'instance::type': {
    comment: 'Set `binary` to mark an element as having binary data data which should be saved at a file attachment'
      + 'on the report\n\nhttps://docs.communityhealthtoolkit.org/building/forms/app/#uploading-binary-attachments',
    supportedValues: ['', 'binary']
  },
  label: {
    comment: 'The user-visible question text for the field. For example: "When was ${first_name} born?" This text can '
      + 'optionally reference other fields or be styled using subsets of Markdown and HTML.\n\nCan be translated.',
    translatable: true
  },
  name: {
    comment: 'Variable name. It may not contain spaces and must start with a letter or underscore. You should use a '
      + 'short, descriptive name and can use underscores to separate words. For example: date_of_birth.'
  },
  note: {
    comment: 'Can include a human-friendly note to describe the row. This will be ignored by all ODK tools.'
  },
  parameters: {
    comment: 'One or more pairs of keys and values that configure aspects of a question type that are not '
      + 'appearance-related.\n\nFor example, an image question might have: max-pixels=1024',
  },
  read_only: {
    comment: 'An expression used to determine whether the question\'s value can be edited or not',
    supportedValues: ['', 'true']
  },
  relevant: {
    comment: 'An expression that determines whether a question will be displayed to a user or not. Lets you define '
      + 'branching or skip logic. \n\nSee the Relevance tab for examples.',
    expression: true
  },
  repeat_count: {
    comment: 'The number of instances of a repeat to create. Can be a fixed value or a \ndynamic expression.\n\n'
      + 'https://docs.getodk.org/form-logic/#fixed-repeat-count',
    expression: true
  },
  required: {
    comment: 'Leave blank for questions that aren\'t required. Write yes for questions that are required. You can also '
      + 'use an expression to make a question conditionally required.\n\n'
      + 'https://docs.getodk.org/form-logic/#requiring-responses',
    expression: true
  },
  required_message: {
    comment: 'A custom message to replace the generic message when a required value is not filled in',
    translatable: true
  },
  trigger: {
    comment: 'Reference to a question that triggers the specified calculation when its value changes only. Useful for '
      + 'dynamic defaults.\n\nhttps://docs.getodk.org/form-logic/#dynamic-defaults-from-form-data'
  },
  type: {
    comment: 'Determines what kinds of values are allowed and how the field is displayed. For certain types, further '
      + 'customization is possible using the appearance and parameters columns.\n\nhttps://docs.getodk.org/form-question-types/'
  },
  video: {
    comment: 'Specify the filename of a video file. This will display a button to play the video next to the question '
      + 'label.\n\nCan be translated.',
    translatable: true
  },
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

const SURVEY_FIELDS: Record<string, {
  /** Alternative names for the type */
  altTypes?: string[]
  /** Indicates the field should have a label */
  label?: 'optional' | 'required'
}> = {
  acknowledge: { label: 'required' },
  audio: { label: 'required' },
  begin_group: {
    altTypes: ['begin group'],
    label: 'optional'
  },
  begin_repeat: {
    altTypes: ['begin repeat'],
    label: 'optional'
  },
  calculate: {},
  date: { label: 'required' },
  datetime: { label: 'required' },
  decimal: { label: 'required' },
  end: {},
  end_group: {
    altTypes: ['end group']
  },
  end_repeat: {
    altTypes: ['end repeat']
  },
  file: { label: 'required' },
  geopoint: { label: 'required' },
  geoshape: { label: 'required' },
  geotrace: { label: 'required' },
  hidden: {},
  image: { label: 'required' },
  integer: { label: 'required' },
  note: { label: 'required' },
  range: { label: 'required' },
  rank: { label: 'required' },
  'select_multiple list_name': { label: 'required' },
  'select_one list_name': { label: 'required' },
  start: {},
  text: {
    altTypes: ['string'],
    label: 'required'
  },
  time: { label: 'required' },
  today: {},
  video: { label: 'required' },
};
const SURVEY_FIELD_TYPES = Record.keys(SURVEY_FIELDS);
const SURVEY_FIELD_TYPES_LABELED = pipe(
  Record.toEntries(SURVEY_FIELDS),
  Array.filter(([, { label }]) => label === 'required'),
  Array.map(Tuple.getFirst),
);
const SURVEY_FIELD_TYPES_UNLABELED = pipe(
  Record.toEntries(SURVEY_FIELDS),
  Array.filter(([, { label }]) => !label),
  Array.map(Tuple.getFirst),
);
const SURVEY_FIELD_TYPES_BY_ALT_TYPE = pipe(
  Record.toEntries(SURVEY_FIELDS),
  Array.flatMap(([type, { altTypes = [] }]) => Array.map(altTypes, altType => Tuple.make(altType, type))),
  Record.fromEntries,
);
const SELECT_ONE_PREFIX = 'select_one ';
const SELECT_MULTIPLE_PREFIX = 'select_multiple ';

const LABEL_PREFIX = 'label';
const INVALID_LABELS = [
  'NO_LABEL',
  'DELETE_THIS_LINE'
];

const STYLE_BEGIN_GROUP: Partial<ExcelJS.Style> = {
  border: { top: STYLE.BORDER.BLUE }
};
const STYLE_END_GROUP: Partial<ExcelJS.Style> = {
  border: { bottom: STYLE.BORDER.BLUE }
};
const STYLE_BEGIN_REPEAT: Partial<ExcelJS.Style> = {
  border: { top: STYLE.BORDER.PURPLE }
};
const STYLE_END_REPEAT: Partial<ExcelJS.Style> = {
  border: { bottom: STYLE.BORDER.PURPLE }
};

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

export const setSurveyTypeFormatting = (workbook: ExcelJS.Workbook) => (surveySheet: Worksheet): void => pipe(
  getTypeColumnLetter(surveySheet),
  column => pipe(
    getChoicesListNameRange(workbook),
    choicesListNameRange => buildIsInvalidTypeFormula(`${column}2`, choicesListNameRange),
    formula => surveySheet.addConditionalFormatting({
      ref: getTypeValidationRange(column, surveySheet.rowCount),
      rules: [
        {
          type: 'expression',
          formulae: [formula],
          style: { ...FORM_STYLE.ERROR },
          priority: 1,
        }
      ]
    })
  )
);

export const normalizeSurveyTypeValues = (surveySheet: Worksheet): void => surveySheet
  .getColumn(getTypeColumnLetter(surveySheet))
  .eachCell({ includeEmpty: false }, (cell, rowNumber) => pipe(
    rowNumber === 1 || typeof cell.value !== 'string'
      ? Option.none()
      : Record.get(SURVEY_FIELD_TYPES_BY_ALT_TYPE, cell.value),
    Option.map(canonicalType => cell.value = canonicalType),
  ));

export const setSurveyHeaderFormatting = (worksheet: Worksheet): void => pipe(
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
        style: { ...FORM_STYLE.ERROR },
        priority: 1,
      },
      {
        type: 'expression',
        formulae: [`AND(A1<>"",NOT(${translatable}),NOT(${valid}),NOT(${expression}))`],
        style: { ...FORM_STYLE.ERROR },
        priority: 2,
      },
      {
        type: 'expression',
        formulae: [`AND(${translatable},${buildEmptyBodyFormula(worksheet)})`],
        style: { ...FORM_STYLE.HEADER.TRANSLATABLE_EMPTY },
        priority: 3,
      },
      {
        type: 'expression',
        formulae: [`AND(${valid},${buildEmptyBodyFormula(worksheet)})`],
        style: { ...FORM_STYLE.HEADER.EMPTY },
        priority: 4,
      },
      {
        type: 'expression',
        formulae: [`AND(${expression},${buildEmptyBodyFormula(worksheet)})`],
        style: { ...FORM_STYLE.HEADER.EXPRESSION_EMPTY },
        priority: 5,
      },
      {
        type: 'expression',
        formulae: [translatable],
        style: { ...FORM_STYLE.HEADER.TRANSLATABLE },
        priority: 6,
      },
      {
        type: 'expression',
        formulae: [valid],
        style: { ...FORM_STYLE.HEADER.BASE },
        priority: 7,
      },
      {
        type: 'expression',
        formulae: [expression],
        style: { ...FORM_STYLE.HEADER.EXPRESSION },
        priority: 8,
      },
    ],
  }),
  formatting => worksheet.addConditionalFormatting(formatting)
);

export const setSurveyHeaderComments = setHeaderComments(SURVEY_COLUMNS);

export const setSurveyHeaderValidation = (workbook: ExcelJS.Workbook) => (
  worksheet: Worksheet
): Effect.Effect<void> => pipe(
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

const surveyFieldTypesFormulae = pipe(
  SURVEY_FIELD_TYPES,
  Array.sort(Order.string),
  Array.join(',')
);
export const setSurveyTypeValidation = (surveySheet: Worksheet): void => pipe(
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

export const setSurveySupportedValuesValidation = setSupportedValuesValidation(SURVEY_COLUMNS);
export const setSurveySupportedValuesFormatting = setSupportedValuesFormatting(SURVEY_COLUMNS);

export const setSurveyNameFormatting = (surveySheet: Worksheet): void => pipe(
  getColumnLetter('name', surveySheet),
  Option.map(nameCol => Tuple.make(
    nameCol,
    getTypeColumnLetter(surveySheet),
  )),
  Option.map(([nameCol, typeCol]) => surveySheet.addConditionalFormatting({
    ref: getTypeValidationRange(nameCol, surveySheet.rowCount),
    rules: [
      {
        type: 'expression',
        formulae: [`AND(${typeCol}2<>"",${nameCol}2="")`],
        style: { ...FORM_STYLE.ERROR },
        priority: 1,
      }
    ]
  })),
  Option.getOrElse(() => undefined)
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
const buildIsUnlabeledTypeFormula = (cell: string) => pipe(
  SURVEY_FIELD_TYPES_UNLABELED,
  Array.map(t => `"${t}"`),
  Array.join(','),
  fixedListLiteral => `NOT(ISERROR(MATCH(${cell},{${fixedListLiteral}},0)))`,
);
export const setSurveyLabelFormatting = (surveySheet: Worksheet): void => pipe(
  getColumnLettersMatching(val => !!val?.startsWith(LABEL_PREFIX), surveySheet),
  labelCols => Tuple.make(labelCols, getTypeColumnLetter(surveySheet)),
  ([labelCols, typeCol]) => Tuple.make(
    labelCols,
    typeCol,
    // Only flag missing labels when none of the label columns have a value.
    labelCols.map(col => `${col}2=""`).join(','),
  ),
  ([labelCols, typeCol, allLabelsEmpty]) => Array.forEach(labelCols, labelCol => surveySheet.addConditionalFormatting({
    ref: getTypeValidationRange(labelCol, surveySheet.rowCount),
    rules: [
      {
        type: 'expression',
        formulae: [`AND(${buildIsLabeledTypeFormula(typeCol + '2')},${allLabelsEmpty})`],
        style: { ...FORM_STYLE.ERROR },
        priority: 1,
      },
      {
        type: 'expression',
        formulae: [`AND(${labelCol}2<>"",${buildIsUnlabeledTypeFormula(typeCol + '2')})`],
        style: { ...FORM_STYLE.ERROR },
        priority: 2,
      },
      {
        type: 'expression',
        formulae: [
          `OR(${INVALID_LABELS.map(label => `${labelCol}2="${label}"`).join(',')})`
        ],
        style: { ...FORM_STYLE.ERROR },
        priority: 3,
      },
    ]
  }))
);

export const setSurveyCalculationFormatting = (surveySheet: Worksheet): void => pipe(
  getColumnLetter('calculation', surveySheet),
  Option.map(calcCol => Tuple.make(
    calcCol,
    getTypeColumnLetter(surveySheet),
  )),
  Option.map(([calcCol, typeCol]) => surveySheet.addConditionalFormatting({
    ref: getTypeValidationRange(calcCol, surveySheet.rowCount),
    rules: [
      {
        type: 'expression',
        formulae: [`AND(${typeCol}2="calculate",${calcCol}2="")`],
        style: { ...FORM_STYLE.ERROR },
        priority: 1,
      }
    ]
  })),
  Option.getOrElse(() => undefined)
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
    rules: [
      {
        type: 'expression',
        formulae: [`AND($${typeCol}2="${type}",A$1<>"")`],
        style: { ...style },
        priority: 1,
      }
    ]
  })
);
export const setSurveyBeginGroupFormatting = setSurveyGroupBoundaryFormatting('begin_group', STYLE_BEGIN_GROUP);
export const setSurveyEndGroupFormatting = setSurveyGroupBoundaryFormatting('end_group', STYLE_END_GROUP);
export const setSurveyBeginRepeatFormatting = setSurveyGroupBoundaryFormatting('begin_repeat', STYLE_BEGIN_REPEAT);
export const setSurveyEndRepeatFormatting = setSurveyGroupBoundaryFormatting('end_repeat', STYLE_END_REPEAT);
