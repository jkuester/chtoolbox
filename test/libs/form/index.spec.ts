import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Effect } from 'effect';
import ExcelJS from 'exceljs';
import { getHeaderNames, type Worksheet } from '../../../src/libs/xlsx.ts';
import {
  getConditionalFormatting,
  getConditionalFormattingRule,
  getConditionalFormattings,
  getDataValidation,
} from '../../utils/xlsx.ts';
import {
  buildEmptyBodyFormula,
  buildEmptyColumnFormula,
  buildKnownHeaderFormula,
  buildTranslatableHeaderFormula,
  BUFFER_COL_COUNT,
  clearWorkbookFormatting,
  FORM_STYLE,
  freezeHeaderAndKeyColumns,
  getTypeColumnLetter,
  getTypeValidationRange,
  setHeaderlessCellFormatting,
  setSupportedValuesFormatting,
  setSupportedValuesValidation,
  writeChtxColumn,
} from '../../../src/libs/form/index.ts';

const newSheet = (
  name: string,
  headers: readonly string[] = [],
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

describe('form libs', () => {
  describe('getTypeColumnLetter', () => {
    it('returns the letter of the type column', () => {
      const [, worksheet] = newSheet('survey', ['name', 'type', 'label']);

      expect(getTypeColumnLetter(worksheet)).to.equal('B');
    });

    it('throws when there is no type column', () => {
      const [, worksheet] = newSheet('survey', ['name', 'label']);

      expect(() => getTypeColumnLetter(worksheet)).to.throw('No "type" column found in worksheet.');
    });
  });

  describe('getTypeValidationRange', () => {
    it('builds a range covering the buffer rows', () => {
      expect(getTypeValidationRange('C', 5)).to.equal('C2:C1005');
    });
  });

  describe('freezeHeaderAndKeyColumns', () => {
    it('freezes the header row and the first two columns', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name']);

      freezeHeaderAndKeyColumns(worksheet);

      expect(worksheet.views).to.deep.equal([{ state: 'frozen', xSplit: 2, ySplit: 1 }]);
    });
  });

  describe('buildTranslatableHeaderFormula', () => {
    it('matches the bare name and the "::lang" variant', () => {
      expect(buildTranslatableHeaderFormula('A1', ['label'])).to.equal(
        'OR(A1="label",LEFT(A1,7)="label::")'
      );
    });
  });

  describe('buildKnownHeaderFormula', () => {
    it('builds a MATCH-based membership test', () => {
      expect(buildKnownHeaderFormula('A1', ['type', 'name'])).to.equal(
        'NOT(ISERROR(MATCH(A1,{"type","name"},0)))'
      );
    });
  });

  describe('buildEmptyBodyFormula', () => {
    it('counts the body rows including the row buffer', () => {
      const [, worksheet] = newSheet('survey', ['type'], [['calculate']]);

      expect(buildEmptyBodyFormula(worksheet)).to.equal('COUNTA(A$2:A$1002)=0');
    });
  });

  describe('buildEmptyColumnFormula', () => {
    it('combines a populated header with an empty body', () => {
      const [, worksheet] = newSheet('survey', ['type'], [['calculate']]);

      expect(buildEmptyColumnFormula(worksheet)).to.equal('AND(A1<>"",COUNTA(A$2:A$1002)=0)');
    });
  });

  describe('writeChtxColumn', () => {
    it('creates a hidden chtx sheet and writes the values into the first empty column', () => {
      const [workbook] = newSheet('survey', ['type']);

      const range = Effect.runSync(writeChtxColumn(workbook, 'survey_header_names')(['type', 'name']));

      const chtx = workbook.getWorksheet('chtx');
      expect(chtx).to.not.be.undefined;
      expect(chtx?.state).to.equal('veryHidden');
      expect(chtx?.getCell('A1').value).to.equal('survey_header_names');
      expect(chtx?.getCell('A2').value).to.equal('type');
      expect(chtx?.getCell('A3').value).to.equal('name');
      expect(range).to.equal('\'chtx\'!$A$2:$A$3');
    });

    it('reuses an existing chtx sheet', () => {
      const [workbook] = newSheet('survey', ['type']);
      const existing = workbook.addWorksheet('chtx');
      existing.getCell('A1').value = 'first_col';

      const range = Effect.runSync(writeChtxColumn(workbook, 'second_col')(['a']));

      expect(workbook.worksheets.filter(ws => ws.name === 'chtx')).to.have.length(1);
      expect(range).to.equal('\'chtx\'!$C$2:$C$2');
    });
  });

  describe('setSupportedValuesValidation', () => {
    it('adds list validations for columns that declare supported values', () => {
      const [, worksheet] = newSheet('settings', ['style', 'form_title', 'read_only']);

      setSupportedValuesValidation({
        style: { supportedValues: ['', 'pages'] },
        form_title: {},
        missing: { supportedValues: ['', 'x'] },
      })(worksheet);

      const validation = getDataValidation(worksheet, 'A2:A1001');
      expect(validation).to.deep.include({
        type: 'list',
        allowBlank: true,
        formulae: ['",pages"'],
      });
      expect(validation?.error).to.equal('This column only accepts "pages" or an empty value.');
      expect(getDataValidation(worksheet, 'B2:B1001')).to.be.undefined;
    });
  });

  describe('setSupportedValuesFormatting', () => {
    it('adds error formatting for values outside the supported set', () => {
      const [, worksheet] = newSheet('settings', ['style']);

      setSupportedValuesFormatting({
        style: { supportedValues: ['', 'pages'] },
        missing: { supportedValues: ['', 'x'] },
      })(worksheet);

      expect(worksheet.getColumn('A').numFmt).to.equal('@');
      expect(getConditionalFormattings(worksheet)).to.have.length(1);
      expect(getConditionalFormattingRule(worksheet, 0).formulae).to.deep.equal(['AND(A2<>"",A2<>"pages")']);
    });
  });

  describe('setHeaderlessCellFormatting', () => {
    it('flags cells that have data under an empty header', () => {
      const [, worksheet] = newSheet('survey', ['type', 'name']);

      setHeaderlessCellFormatting(worksheet);

      const lastCol = worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter;
      expect(getConditionalFormattings(worksheet)).to.have.length(1);
      expect(getConditionalFormatting(worksheet).ref).to.equal(`A2:${lastCol}1001`);
      const rule = getConditionalFormattingRule(worksheet, 0);
      expect(rule.formulae).to.deep.equal(['AND(A2<>"",A$1="")']);
      expect(rule.style).to.deep.equal(FORM_STYLE.ERROR);
    });
  });

  describe('clearWorkbookFormatting', () => {
    it('clears formatting on present form sheets and removes the chtx sheet', () => {
      const workbook = new ExcelJS.Workbook();
      const survey = workbook.addWorksheet('survey');
      survey.getRow(1).values = ['type'];
      survey.views = [{ state: 'frozen', xSplit: 2, ySplit: 1 }];
      workbook.addWorksheet('choices').getRow(1).values = ['list_name'];
      workbook.addWorksheet('chtx');

      clearWorkbookFormatting(workbook);

      expect(survey.views.some(view => view.state === 'frozen')).to.be.false;
      expect(workbook.getWorksheet('chtx')).to.be.undefined;
    });
  });
});
