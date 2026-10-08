import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Option } from 'effect';
import ExcelJS from 'exceljs';
import {
  clearSheetFormatting,
  findFirstEmptyColumnIndex,
  getColumnLetter,
  getColumnLettersMatching,
  getHeaderNames,
  getWorksheetWithName,
  removeColumnsPastSheetEnd,
  setColumnValues,
  setHeaderComments,
  setHeaderValue,
  STYLE,
  type Worksheet,
} from '../../src/libs/xlsx.ts';
import { getConditionalFormattings } from '../utils/xlsx.ts';

const newSheet = (
  name: string,
  headers: readonly (string | number)[] = [],
  rows: readonly (readonly string[])[] = []
): [ExcelJS.Workbook, Worksheet] => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(name);
  if (headers.length) {
    worksheet.getRow(1).values = [...headers];
  }
  rows.forEach((row, idx) => {
    worksheet.getRow(idx + 2).values = [...row];
  });
  return [workbook, worksheet as unknown as Worksheet];
};

describe('xlsx libs', () => {
  it('exposes the base style constants', () => {
    expect(STYLE.FONT.BASE).to.deep.equal({ name: 'Liberation Sans', size: 10 });
    expect(STYLE.FILL.GREY.pattern).to.equal('solid');
    expect(STYLE.BORDER.BLUE.style).to.equal('medium');
  });

  describe('getWorksheetWithName', () => {
    it('returns Some with the matching worksheet', () => {
      const [workbook, worksheet] = newSheet('survey');

      const result = getWorksheetWithName(workbook)('survey');

      expect(Option.isSome(result)).to.be.true;
      expect(Option.getOrThrow(result)).to.equal(worksheet);
    });

    it('returns None when no worksheet matches', () => {
      const [workbook] = newSheet('survey');

      const result = getWorksheetWithName(workbook)('choices');

      expect(Option.isNone(result)).to.be.true;
    });
  });

  describe('getHeaderNames', () => {
    it('returns the header values, replacing non-string cells with empty strings', () => {
      const [, worksheet] = newSheet('survey', ['type', 42, 'name']);

      // ExcelJS row.values is 1-based, so index 0 is an unset hole.
      expect(getHeaderNames(worksheet)).to.deep.equal([undefined, 'type', '', 'name']);
    });

    it('handles a values object that is not an array', () => {
      const fakeWorksheet = {
        getRow: () => ({ values: { 1: 'type', 2: 'name' } }),
      } as unknown as Worksheet;

      expect(getHeaderNames(fakeWorksheet)).to.deep.equal(['type', 'name']);
    });
  });

  describe('getColumnLettersMatching', () => {
    it('returns the letters of every column matching the predicate', () => {
      const [, worksheet] = newSheet('survey', ['label', 'label::en', 'name']);

      const result = getColumnLettersMatching(val => !!val?.startsWith('label'), worksheet);

      expect(result).to.deep.equal(['A', 'B']);
    });

    it('returns an empty array when nothing matches', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name']);

      expect(getColumnLettersMatching(val => val === 'missing', worksheet)).to.deep.equal([]);
    });
  });

  describe('getColumnLetter', () => {
    it('returns Some with the letter of the matching column', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name', 'label']);

      expect(getColumnLetter('name', worksheet)).to.deep.equal(Option.some('B'));
    });

    it('returns None when the column is not found', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name']);

      expect(getColumnLetter('missing', worksheet)).to.deep.equal(Option.none());
    });
  });

  describe('clearSheetFormatting', () => {
    it('clears conditional formatting, validations, comments, styles, and frozen panes', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name'], [['calculate', 'x']]);
      worksheet.getCell('A1').note = 'a note';
      worksheet.addConditionalFormatting({
        ref: 'A1:B1',
        rules: [{ type: 'expression', formulae: ['A1<>""'], style: {}, priority: 1 }],
      });
      worksheet.dataValidations.add('A2', { type: 'list', allowBlank: true, formulae: ['"a,b"'] });
      worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];

      clearSheetFormatting(worksheet);

      expect(getConditionalFormattings(worksheet)).to.deep.equal([]);
      expect(worksheet.dataValidations.model).to.deep.equal({});
      expect((worksheet.getCell('A1') as unknown as { _comment?: unknown })._comment).to.be.undefined;
      expect(worksheet.views.some(view => view.state === 'frozen')).to.be.false;
      expect(worksheet.getCell('A1').style.font?.name).to.equal('Liberation Sans');
    });

    it('removes empty rows trailing the end of the data', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name'], [['calculate', 'x']]);
      worksheet.getRow(4).height = 12.75;
      worksheet.getRow(1048576).height = 12.75;
      expect(worksheet.rowCount).to.equal(1048576);

      clearSheetFormatting(worksheet);

      expect(worksheet.rowCount).to.equal(2);
      expect(worksheet.getCell('A2').value).to.equal('calculate');
    });

    it('keeps empty rows that fall within the data', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name'], [['calculate', 'x'], [], ['note', 'y']]);
      worksheet.getRow(1000).height = 12.75;

      clearSheetFormatting(worksheet);

      expect(worksheet.rowCount).to.equal(4);
      expect(worksheet.getCell('A4').value).to.equal('note');
    });

    it('handles a worksheet with no frozen panes and comment-less cells', () => {
      const clearedModel = { A1: {} };
      const fakeCell = { _value: undefined };
      const fakeWorksheet = {
        removeConditionalFormatting: () => undefined,
        dataValidations: { model: clearedModel },
        _rows: [],
        rowCount: 0,
        findRow: () => undefined,
        eachRow: () => undefined,
        getRow: () => ({ eachCell: (_opts: unknown, cb: (cell: unknown) => void) => cb(fakeCell) }),
        columns: [],
        views: undefined,
      } as unknown as Worksheet;

      clearSheetFormatting(fakeWorksheet);

      expect(fakeWorksheet.dataValidations.model).to.deep.equal({});
      expect((fakeCell as { _comment?: unknown })._comment).to.be.undefined;
      expect(fakeWorksheet.views).to.be.undefined;
    });

    it('converts shared formulas into standalone formulas so they survive a column splice', async () => {
      const [workbook, worksheet] = newSheet('survey', ['type', 'constraint'], [['integer', 'x']]);
      const sharedMaster = { formula: 'A3+1', result: 1, shareType: 'shared', ref: 'B3:B4' };
      worksheet.getCell('B3').value = sharedMaster;
      worksheet.getCell('B4').value = { sharedFormula: 'B3', result: 1 };
      worksheet.getCell('C3').value = { formula: 'NOW()', result: 1 };

      clearSheetFormatting(worksheet);
      worksheet.spliceColumns(1, 0, []);

      expect(worksheet.getCell('C3').value).to.deep.equal({ formula: 'A3+1', result: 1 });
      expect(worksheet.getCell('C4').value).to.deep.equal({ formula: 'A4+1', result: 1 });
      expect(worksheet.getCell('D3').value).to.deep.equal({ formula: 'NOW()', result: 1 });
      await workbook.xlsx.writeBuffer();
    });

    it('gives columns without a width the default width, so adjacent columns merge into one <col>', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name'], [['calculate', 'x']]);
      worksheet.getColumn(1).width = 20;
      worksheet.getColumn(5).width = undefined as unknown as number;

      clearSheetFormatting(worksheet);

      expect(worksheet.columns.map(({ width }) => width)).to.deep.equal([20, 9, 9, 9, 9]);
      const { cols } = worksheet.model as unknown as { cols: { min: number, max: number }[] };
      expect(cols.map(({ min, max }) => [min, max])).to.deep.equal([[1, 1], [2, 5]]);
    });

    it('drops column definitions already past the last sheet column', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name'], [['calculate', 'x']]);
      worksheet.getColumn(16385).width = 12;

      clearSheetFormatting(worksheet);

      expect(worksheet.columns).to.have.length(16384);
    });

    it('resets existing cells and the row style without filling in the missing cells', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name'], [['calculate', 'x']]);
      worksheet.getCell('E2').numFmt = '@';
      const rowWithStyle = worksheet.getRow(2) as unknown as { style: Partial<ExcelJS.Style> };
      rowWithStyle.style = { font: { bold: true } };

      clearSheetFormatting(worksheet);

      const row = worksheet.getRow(2) as unknown as { _cells: unknown[] };
      expect(row._cells.filter(Boolean)).to.have.length(3);
      expect(worksheet.getCell('E2').numFmt).to.be.undefined;
      expect(rowWithStyle.style).to.deep.equal({
        font: { name: 'Liberation Sans', size: 10 },
        alignment: { vertical: 'bottom' },
      });
    });

    it('drops comment insets that ExcelJS read as NaN, keeping valid ones', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name', 'hint'], [['calculate', 'x', 'y']]);
      const note = (inset: number[]) => ({ texts: [{ text: 'a note' }], margins: { insetmode: 'auto', inset } });
      worksheet.getCell('A2').note = note([NaN]) as unknown as ExcelJS.Comment;
      worksheet.getCell('B2').note = note([0.13, 0.13, 0.25, 0.25]) as unknown as ExcelJS.Comment;
      worksheet.getCell('C2').note = 'a plain note';
      worksheet.getCell('C3').value = 'no note';

      clearSheetFormatting(worksheet);

      const getInset = (address: string) => (worksheet.getCell(address).note as unknown as {
        margins: { inset?: number[] | null }
      }).margins.inset;
      expect(getInset('A2')).to.be.null;
      expect(getInset('B2')).to.deep.equal([0.13, 0.13, 0.25, 0.25]);
      expect(worksheet.getCell('C2').note).to.equal('a plain note');
    });

    it('handles merged cells whose master is empty', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name'], [['calculate', 'x']]);
      worksheet.mergeCells('C2:D2');

      clearSheetFormatting(worksheet);

      expect(worksheet.getCell('D2').value).to.be.null;
      expect(worksheet.getCell('A2').value).to.equal('calculate');
    });
  });

  describe('removeColumnsPastSheetEnd', () => {
    it('drops column definitions pushed past the last sheet column', () => {
      const [, worksheet] = newSheet('survey', ['type']);
      worksheet.getColumn(16384).width = 12;
      worksheet.spliceColumns(1, 0, []);
      expect(worksheet.columns).to.have.length(16385);

      removeColumnsPastSheetEnd(worksheet);

      expect(worksheet.columns).to.have.length(16384);
      expect(worksheet.getColumn(2).letter).to.equal('B');
    });

    it('leaves a sheet within the column limit unchanged', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name']);
      worksheet.getColumn(3).width = 12;

      removeColumnsPastSheetEnd(worksheet);

      expect(worksheet.columns).to.have.length(3);
      expect(worksheet.getColumn(3).width).to.equal(12);
    });
  });

  describe('setHeaderComments', () => {
    it('sets comments on matching columns and skips columns without a comment', () => {
      const [, worksheet] = newSheet('survey', ['label', 'label::en', 'name']);

      setHeaderComments({
        label: { comment: 'Label comment', translatable: true },
        name: { comment: 'Name comment' },
        missing: { comment: 'Missing comment' },
        type: {},
      })(worksheet);

      expect(worksheet.getCell('A1').note).to.equal('Label comment');
      expect(worksheet.getCell('B1').note).to.equal('Label comment');
      expect(worksheet.getCell('C1').note).to.equal('Name comment');
    });
  });

  describe('findFirstEmptyColumnIndex', () => {
    it('returns the index just past the last header', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name', 'label']);

      // getHeaderNames includes the leading 1-based hole, so length is 4 here.
      expect(findFirstEmptyColumnIndex(worksheet)).to.equal(5);
    });
  });

  describe('setHeaderValue', () => {
    it('sets and returns the header label for the given column index', () => {
      const [, worksheet] = newSheet('survey');

      const result = setHeaderValue('my_header')([worksheet, 2]);

      expect(result).to.equal('my_header');
      expect(worksheet.getCell('B1').value).to.equal('my_header');
    });
  });

  describe('setColumnValues', () => {
    it('writes the values down the column starting from the second row', () => {
      const [, worksheet] = newSheet('survey');

      setColumnValues(['one', 'two', 'three'])([worksheet, 1]);

      expect(worksheet.getCell('A2').value).to.equal('one');
      expect(worksheet.getCell('A3').value).to.equal('two');
      expect(worksheet.getCell('A4').value).to.equal('three');
    });
  });
});
