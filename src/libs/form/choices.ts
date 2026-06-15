import { Array, Effect, Option, pipe, Record, Tuple } from 'effect';
import ExcelJS from 'exceljs';
import { getColumnLetter, getHeaderNames, getWorksheetWithName, setHeaderComments, type Worksheet } from '../xlsx.ts';
import {
  BUFFER_COL_COUNT,
  buildEmptyBodyFormula,
  buildEmptyColumnFormula,
  buildTranslatableHeaderFormula,
  FORM_STYLE, SHEET_NAME_CHOICES, writeChtxColumn
} from './index.ts';

const CHOICES_COLUMNS: Record<string, {
  /** Description of the column */
  comment: string,
  /** Multiple versions of this column can be added for different languages */
  translatable?: boolean,
}> = {
  audio: {
    comment: 'The filename of an audio file for the choice.\n\nCan be translated.',
    translatable: true
  },
  image: {
    comment: 'The filename of an image file for the choice.\n\nCan be translated.',
    translatable: true
  },
  label: {
    comment: 'The user-visible text for the choice. This text can have translations or be styled using subsets of '
      + 'Markdown and HTML.',
    translatable: true
  },
  list_name: {
    comment: 'The name of a list. To group choices in a list, give them all the same list_name.\n\nYou can use '
      + 'the list_name with select types and as part of instance statements for looking values in lists.'
  },
  name: {
    comment: 'The value that will be saved when this choice is selected. This is the value you will use in analysis.'
      + '\n\nLike field names, choice names should be short and descriptive (e.g., y for Yes and n for No).'
  },
  video: {
    comment: 'The filename of a video file for the choice.\n\nCan be translated.',
    translatable: true
  },
};
const CHOICES_COLUMN_NAMES_TRANSLATABLE = pipe(
  Record.toEntries(CHOICES_COLUMNS),
  Array.filter(([, { translatable }]) => !!translatable),
  Array.map(Tuple.getFirst),
);

export const getChoicesListNameRange = (workbook: ExcelJS.Workbook): Option.Option<string> => pipe(
  getWorksheetWithName(workbook)(SHEET_NAME_CHOICES),
  Option.flatMap(choices => pipe(
    getColumnLetter('list_name', choices),
    Option.map(letter => `choices!$${letter}:$${letter}`),
  )),
);

export const setChoicesHeaderComments = setHeaderComments(CHOICES_COLUMNS);

export const setChoicesHeaderFormatting = (worksheet: Worksheet): void => pipe(
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
        style: { ...FORM_STYLE.ERROR },
        priority: 1,
      },
      {
        type: 'expression',
        formulae: [`AND(${translatable},${buildEmptyBodyFormula(worksheet)})`],
        style: { ...FORM_STYLE.HEADER.TRANSLATABLE_EMPTY },
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
        formulae: [translatable],
        style: { ...FORM_STYLE.HEADER.TRANSLATABLE },
        priority: 4,
      },
      {
        type: 'expression',
        formulae: ['A1<>""'],
        style: { ...FORM_STYLE.HEADER.BASE },
        priority: 5,
      },
    ],
  }),
  formatting => worksheet.addConditionalFormatting(formatting)
);

export const setChoicesHeaderValidation = (workbook: ExcelJS.Workbook) => (
  worksheet: Worksheet
): Effect.Effect<void> => pipe(
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
