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
      const [, worksheet] = newSheet('survey', ['type', 42 as unknown as string, 'name']);

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
