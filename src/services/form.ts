import { Effect } from 'effect';
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

const formatFile = Effect.fn((filePath: string): Effect.Effect<void, Error> => Effect.tryPromise({
  try: async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    SUPPORTED_SHEETS
      .map(name => workbook.worksheets.find(ws => ws.name === name))
      .filter((ws) => !!ws)
      .forEach(clearSheetFormatting);

    const survey = workbook.worksheets.find(ws => ws.name === 'survey');
    if (!survey) {
      throw new Error('No "survey" sheet found in workbook.');
    }
    const headerRow = survey.getRow(1);
    let typeCol: number | undefined;
    headerRow.eachCell((cell, colNumber) => {
      if (cell.value === 'type') {
        typeCol = colNumber;
      }
    });
    if (!typeCol) {
      throw new Error('No "type" column found in survey sheet.');
    }
    const colLetter = String.fromCharCode(64 + typeCol);
    const rowCount = survey.rowCount;
    survey.addConditionalFormatting({
      ref: `${colLetter}2:${colLetter}${String(rowCount)}`,
      rules: [{
        type: 'containsText',
        operator: 'containsText',
        text: 'text',
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFF0000' } } },
        priority: 1,
      }]
    });
    await workbook.xlsx.writeFile(filePath);
  },
  catch: (e) => new Error(String(e)),
}));

export class FormService extends Effect.Service<FormService>()('chtoolbox/FormService', {
  effect: Effect.succeed({
    formatFile,
  }),
  accessors: true,
}) {}
