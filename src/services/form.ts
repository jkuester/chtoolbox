import { Effect } from 'effect';
import ExcelJS from 'exceljs';

const formatFile = Effect.fn((filePath: string): Effect.Effect<void, Error> => Effect.tryPromise({
  try: async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
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
