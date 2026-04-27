import { Effect, pipe, Array, Option, } from 'effect';
import ExcelJS from 'exceljs';

const SUPPORTED_SHEETS = ['survey', 'settings', 'choices'];
const BASE_FONT: Partial<ExcelJS.Font> = { name: 'Liberation Sans', size: 10 };
const DEFAULT_STYLE = { font: { ...BASE_FONT } };

const setDefaultStyle = (obj: object) => Object.assign(obj, { style: DEFAULT_STYLE });
const clearRowFormatting = (row: ExcelJS.Row) => row.eachCell({ includeEmpty: true }, setDefaultStyle);
const clearSheetFormatting = (ws: ExcelJS.Worksheet): void => {
  ws.removeConditionalFormatting(null);
  ws.eachRow({ includeEmpty: true }, clearRowFormatting);
  ws.columns.forEach(setDefaultStyle);
};

const loadWorkbook = (filePath: string) => pipe(
  new ExcelJS.Workbook(),
  workbook => Effect.tryPromise(() => workbook.xlsx.readFile(filePath)),
);

const worksheetHasName = (targetName: string) => ({ name }: ExcelJS.Worksheet) => name === targetName;
const getWorksheetWithName = (
  workbook: ExcelJS.Workbook
) => (name: string) => Array.findFirst(workbook.worksheets, worksheetHasName(name));
const clearWorkbookFormatting = (workbook: ExcelJS.Workbook) => pipe(
  SUPPORTED_SHEETS,
  Array.map(getWorksheetWithName(workbook)),
  Array.filter(Option.isSome),
  Array.map(Option.getOrThrow),
  Array.forEach(clearSheetFormatting),
);

const getColumnIndex = (colName: string) => (worksheet: ExcelJS.Worksheet) => pipe(
  worksheet.getRow(1).values,
  values => Array.isArray(values) ? values : Object.values(values),
  Array.findFirstIndex(val => val === colName),
  Option.map(index => index + 1), // ExcelJS columns are 1-indexed
);

const getColumnLetter = (colName: string, worksheet: ExcelJS.Worksheet) => pipe(
  getColumnIndex(colName)(worksheet),
  Option.map(colIndex => String.fromCharCode(64 + colIndex))
);

const formatSurveyType = (surveySheet: ExcelJS.Worksheet) => pipe(
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
);

const formatSurveyWorksheet = (workbook: ExcelJS.Workbook) => pipe(
  getWorksheetWithName(workbook)('survey'),
  Option.getOrThrowWith(() => new Error('No "survey" sheet found in workbook.')),
  Effect.succeed,
  Effect.tap(formatSurveyType),
);

const saveWorkbook = (
  filePath: string
) => (workbook: ExcelJS.Workbook) => Effect.tryPromise(() => workbook.xlsx.writeFile(filePath));

const formatFile = Effect.fn((filePath: string): Effect.Effect<void, Error> => pipe(
  loadWorkbook(filePath),
  Effect.tap(clearWorkbookFormatting),
  Effect.tap(formatSurveyWorksheet),
  Effect.flatMap(saveWorkbook(filePath)),
));

export class FormService extends Effect.Service<FormService>()('chtoolbox/FormService', {
  effect: Effect.succeed({
    formatFile,
  }),
  accessors: true,
}) {}
