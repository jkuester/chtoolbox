import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Effect } from 'effect';
import ExcelJS from 'exceljs';
import { getHeaderNames, type Worksheet } from '../../../src/libs/xlsx.ts';
import { BUFFER_COL_COUNT } from '../../../src/libs/form/index.ts';
import {
  getConditionalFormatting,
  getConditionalFormattingRule,
  getConditionalFormattings,
  getDataValidation,
} from '../../utils/xlsx.ts';
import {
  normalizeSurveyTypeValues,
  setSurveyBeginGroupFormatting,
  setSurveyBeginRepeatFormatting,
  setSurveyCalculationFormatting,
  setSurveyEndGroupFormatting,
  setSurveyEndRepeatFormatting,
  setSurveyHeaderComments,
  setSurveyHeaderFormatting,
  setSurveyHeaderValidation,
  setSurveyLabelFormatting,
  setSurveyNameFormatting,
  setSurveySupportedValuesFormatting,
  setSurveySupportedValuesValidation,
  setSurveyTypeFormatting,
  setSurveyTypeValidation,
} from '../../../src/libs/form/survey.ts';

const newWorkbook = (
  headers: readonly string[],
  rows: readonly (readonly string[])[] = [],
  { withChoices = false } = {}
): [ExcelJS.Workbook, Worksheet] => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('survey');
  worksheet.getRow(1).values = [...headers];
  rows.forEach((row, idx) => {
    worksheet.getRow(idx + 2).values = [...row];
  });
  if (withChoices) {
    workbook.addWorksheet('choices').getRow(1).values = ['list_name', 'name'];
  }
  return [workbook, worksheet as unknown as Worksheet];
};

describe('form survey libs', () => {
  describe('setSurveyTypeFormatting', () => {
    it('references the choices list when a choices sheet is present', () => {
      const [workbook, worksheet] = newWorkbook(['type', 'name'], [], { withChoices: true });

      setSurveyTypeFormatting(workbook)(worksheet);

      const formula = getConditionalFormattingRule(worksheet, 0).formulae[0] ?? '';
      expect(formula).to.contain('MATCH(MID(A2');
      expect(formula).to.contain('choices!$A:$A');
    });

    it('falls back to FALSE when there is no choices list', () => {
      const [workbook, worksheet] = newWorkbook(['type', 'name']);

      setSurveyTypeFormatting(workbook)(worksheet);

      expect(getConditionalFormattingRule(worksheet, 0).formulae[0] ?? '').to.contain('FALSE');
    });
  });

  describe('normalizeSurveyTypeValues', () => {
    it('rewrites alternative type names to their canonical form', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [
        ['begin group', 'g'],
        ['text', 'q'],
      ]);
      worksheet.getCell('A4').value = 42;

      normalizeSurveyTypeValues(worksheet);

      expect(worksheet.getCell('A2').value).to.equal('begin_group');
      expect(worksheet.getCell('A3').value).to.equal('text');
      expect(worksheet.getCell('A4').value).to.equal(42);
    });
  });

  describe('setSurveyHeaderFormatting', () => {
    it('adds the eight header conditional formatting rules', () => {
      const [, worksheet] = newWorkbook(['type', 'name', 'label']);

      setSurveyHeaderFormatting(worksheet);

      const lastCol = worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter;
      expect(getConditionalFormattings(worksheet)).to.have.length(1);
      expect(getConditionalFormatting(worksheet).ref).to.equal(`A1:${lastCol}1`);
      expect(getConditionalFormatting(worksheet).rules).to.have.length(8);
      expect(getConditionalFormattingRule(worksheet, 0).formulae)
        .to.deep.equal([`AND(A1<>"",COUNTIF($A$1:$${lastCol}$1,A1)>1)`]);
    });
  });

  describe('setSurveyHeaderComments', () => {
    it('sets the documented comments on the survey columns', () => {
      const [, worksheet] = newWorkbook(['type', 'name']);

      setSurveyHeaderComments(worksheet);

      expect(worksheet.getCell('A1').note).to.contain('Determines what kinds of values are allowed');
      expect(worksheet.getCell('B1').note).to.contain('Variable name.');
    });
  });

  describe('setSurveyHeaderValidation', () => {
    it('writes the header names to the chtx sheet and adds list validation', () => {
      const [workbook, worksheet] = newWorkbook(['type', 'name']);

      Effect.runSync(setSurveyHeaderValidation(workbook)(worksheet));

      const chtx = workbook.getWorksheet('chtx');
      expect(chtx?.getCell('A1').value).to.equal('survey_header_names');
      const lastCol = worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter;
      const rule = getDataValidation(worksheet, `A1:${lastCol}1`);
      expect(rule).to.deep.include({ type: 'list', errorStyle: 'information', errorTitle: 'Column warning' });
      expect(rule?.formulae[0]).to.match(/^'chtx'!\$A\$2:\$A\$\d+$/);
    });
  });

  describe('setSurveyTypeValidation', () => {
    it('adds a sorted list validation on the type column', () => {
      const [, worksheet] = newWorkbook(['type', 'name']);

      setSurveyTypeValidation(worksheet);

      const rule = getDataValidation(worksheet, 'A2:A1001');
      expect(rule).to.deep.include({ type: 'list', errorStyle: 'information', errorTitle: 'Type warning' });
      expect(rule?.formulae[0]).to.contain('calculate');
    });
  });

  describe('setSurveySupportedValuesValidation', () => {
    it('adds list validation for supported-value columns', () => {
      const [, worksheet] = newWorkbook(['type', 'read_only']);

      setSurveySupportedValuesValidation(worksheet);

      expect(getDataValidation(worksheet, 'B2:B1001')).to.deep.include({ type: 'list', formulae: ['",true"'] });
    });
  });

  describe('setSurveySupportedValuesFormatting', () => {
    it('adds error formatting for supported-value columns', () => {
      const [, worksheet] = newWorkbook(['type', 'read_only']);

      setSurveySupportedValuesFormatting(worksheet);

      expect(worksheet.getColumn('B').numFmt).to.equal('@');
      expect(getConditionalFormattingRule(worksheet, 0).formulae).to.deep.equal(['AND(B2<>"",B2<>"true")']);
    });
  });

  describe('setSurveyNameFormatting', () => {
    it('flags rows that have a type but no name', () => {
      const [, worksheet] = newWorkbook(['type', 'name']);

      setSurveyNameFormatting(worksheet);

      expect(getConditionalFormattingRule(worksheet, 0).formulae).to.deep.equal(['AND(A2<>"",B2="")']);
    });

    it('does nothing when there is no name column', () => {
      const [, worksheet] = newWorkbook(['type', 'label']);

      setSurveyNameFormatting(worksheet);

      expect(getConditionalFormattings(worksheet)).to.deep.equal([]);
    });
  });

  describe('setSurveyLabelFormatting', () => {
    it('flags missing, extraneous, and placeholder labels', () => {
      const [, worksheet] = newWorkbook(['type', 'label', 'label::en']);

      setSurveyLabelFormatting(worksheet);

      expect(getConditionalFormattings(worksheet)).to.have.length(2);
      expect(getConditionalFormatting(worksheet).rules).to.have.length(3);
      expect(getConditionalFormattingRule(worksheet, 2).formulae).to.deep.equal([
        'OR(B2="NO_LABEL",B2="DELETE_THIS_LINE")'
      ]);
    });
  });

  describe('setSurveyCalculationFormatting', () => {
    it('flags calculate rows with no calculation', () => {
      const [, worksheet] = newWorkbook(['type', 'calculation']);

      setSurveyCalculationFormatting(worksheet);

      expect(getConditionalFormattingRule(worksheet, 0).formulae).to.deep.equal(['AND(A2="calculate",B2="")']);
    });

    it('does nothing when there is no calculation column', () => {
      const [, worksheet] = newWorkbook(['type', 'name']);

      setSurveyCalculationFormatting(worksheet);

      expect(getConditionalFormattings(worksheet)).to.deep.equal([]);
    });
  });

  describe('group boundary formatting', () => {
    it('adds a top/bottom border rule for each group and repeat boundary type', () => {
      const [, worksheet] = newWorkbook(['type', 'name']);

      setSurveyBeginGroupFormatting(worksheet);
      setSurveyEndGroupFormatting(worksheet);
      setSurveyBeginRepeatFormatting(worksheet);
      setSurveyEndRepeatFormatting(worksheet);

      expect(getConditionalFormattings(worksheet)).to.have.length(4);
      expect(getConditionalFormattingRule(worksheet, 0, 0).formulae).to.deep.equal(['AND($A2="begin_group",A$1<>"")']);
      expect(getConditionalFormattingRule(worksheet, 0, 3).formulae).to.deep.equal(['AND($A2="end_repeat",A$1<>"")']);
    });
  });
});
