import { DateTime, Effect, Option, pipe, Record, Tuple } from 'effect';
import { getColumnLetter, getHeaderNames, setHeaderComments, type Worksheet } from '../xlsx.ts';
import {
  BUFFER_COL_COUNT,
  buildEmptyColumnFormula,
  buildKnownHeaderFormula,
  FORM_STYLE,
  setSupportedValuesFormatting,
  setSupportedValuesValidation,
  writeChtxColumn
} from './index.ts';
import ExcelJS from 'exceljs';

const SETTINGS_COLUMNS: Record<string, {
  /** Description of the column */
  comment: string,
  /** The complete set of values allowed in this column (offered as a dropdown; e.g. ['', 'true']) */
  supportedValues?: readonly string[],
}> = {
  allow_choice_duplicates: {
    comment: 'Add with `yes` value if you want a single list on the choices sheet to have multiple choices with '
      + 'the same name',
    supportedValues: ['', 'yes']
  },
  form_title: {
    comment: 'The title that will be displayed to anyone who uses this form.\n\n'
      + 'https://docs.getodk.org/xlsform/#the-settings-sheet'
  },
  namespaces: {
    comment: 'Specify the custom namespaces used in the form. For example: `cht=https://communityhealthtoolkit.org`.'
  },
  style: {
    comment: 'Specify different ways of displaying questions. \n\npages: show each question or field list on its '
      + 'own page.\n\nBy default, all questions are shown on a single page.',
    supportedValues: ['', 'pages']
  },
  version: {
    comment: 'The unique version code that identifies the current state of the form. A common convention is to '
      + 'use a format like yyyymmddrr. For example, 2017021501 is the 1st revision from Feb 15th, 2017.\n\n'
      + 'A formula can be used to update the version automatically: `=TEXT(NOW(), "yyyymmddhhmmss")`\n\n'
      + 'This `version` is recorded in the form xml and is primarily useful for determining which version '
      + 'of the xlsform was used to produce the xml. A separate `form_version` property is generated for each '
      + 'form when it is uploaded to the CHT server. This is the version set on report docs produced by the form.'
      + '\n\nhttps://docs.communityhealthtoolkit.org/building/forms/versioning/'
  },
};

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');
const toVersionStamp = (dateTime: DateTime.DateTime): string => pipe(
  DateTime.toPartsUtc(dateTime),
  ({ year, month, day, hours, minutes, seconds }) =>
    `${pad(year, 4)}${pad(month)}${pad(day)}${pad(hours)}${pad(minutes)}${pad(seconds)}`,
);

/**
 * ExcelJS does not always play nicely with the `version` formulas (it does not auto-box from date to number as
 * forgivingly as other editors). So, just manually cache the value instead.
 * @param worksheet
 */
export const setSettingsVersionCachedValue = (worksheet: Worksheet): Effect.Effect<void> => pipe(
  getColumnLetter('version', worksheet),
  Option.map(column => worksheet.getCell(`${column}2`)),
  Option.filter(cell => cell.type === ExcelJS.ValueType.Formula),
  Option.match({
    onNone: () => Effect.void,
    onSome: cell => pipe(
      DateTime.now,
      Effect.map(toVersionStamp),
      Effect.map(stamp => Object.assign(cell, { value: { formula: cell.formula, result: stamp } })),
      Effect.asVoid,
    ),
  }),
);

export const setSettingsHeaderComments = setHeaderComments(SETTINGS_COLUMNS);
export const setSettingsSupportedValuesValidation = setSupportedValuesValidation(SETTINGS_COLUMNS);
export const setSettingsSupportedValuesFormatting = setSupportedValuesFormatting(SETTINGS_COLUMNS);

export const setSettingsHeaderFormatting = (worksheet: Worksheet): void => pipe(
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
        style: { ...FORM_STYLE.ERROR },
        priority: 1,
      },
      {
        type: 'expression',
        formulae: [`AND(A1<>"",NOT(${valid}))`],
        style: { ...FORM_STYLE.ERROR },
        priority: 2,
      },
      {
        type: 'expression',
        formulae: [buildEmptyColumnFormula(worksheet)],
        style: { ...FORM_STYLE.HEADER.EMPTY },
        priority: 3,
      },
      {
        type: 'expression',
        formulae: [valid],
        style: { ...FORM_STYLE.HEADER.BASE },
        priority: 4,
      },
    ],
  }),
  formatting => worksheet.addConditionalFormatting(formatting)
);

export const setSettingsHeaderValidation = (workbook: ExcelJS.Workbook) => (
  worksheet: Worksheet
): Effect.Effect<void> => pipe(
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
