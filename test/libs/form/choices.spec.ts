import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Effect, Option } from 'effect';
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
  getChoicesListNameRange,
  setChoicesHeaderComments,
  setChoicesHeaderFormatting,
  setChoicesHeaderValidation,
} from '../../../src/libs/form/choices.ts';

const newWorkbook = (
  name: string,
  headers: readonly string[] = []
): [ExcelJS.Workbook, Worksheet] => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(name);
  if (headers.length) {
    worksheet.getRow(1).values = [...headers];
  }
  return [workbook, worksheet as unknown as Worksheet];
};

describe('form choices libs', () => {
  describe('getChoicesListNameRange', () => {
    it('returns the list_name column range when the choices sheet has one', () => {
      const [workbook] = newWorkbook('choices', ['name', 'list_name']);

      expect(getChoicesListNameRange(workbook)).to.deep.equal(Option.some('choices!$B:$B'));
    });

    it('returns None when the choices sheet has no list_name column', () => {
      const [workbook] = newWorkbook('choices', ['name', 'label']);

      expect(getChoicesListNameRange(workbook)).to.deep.equal(Option.none());
    });

    it('returns None when there is no choices sheet', () => {
      const [workbook] = newWorkbook('survey', ['type']);

      expect(getChoicesListNameRange(workbook)).to.deep.equal(Option.none());
    });
  });

  describe('setChoicesHeaderComments', () => {
    it('sets the documented comments on the choices columns', () => {
      const [, worksheet] = newWorkbook('choices', ['list_name', 'label']);

      setChoicesHeaderComments(worksheet);

      expect(worksheet.getCell('A1').note).to.contain('The name of a list.');
      expect(worksheet.getCell('B1').note).to.contain('The user-visible text for the choice.');
    });
  });

  describe('setChoicesHeaderFormatting', () => {
    it('adds the header conditional formatting rules', () => {
      const [, worksheet] = newWorkbook('choices', ['label', 'name']);

      setChoicesHeaderFormatting(worksheet);

      const lastCol = worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter;
      expect(getConditionalFormattings(worksheet)).to.have.length(1);
      expect(getConditionalFormatting(worksheet).ref).to.equal(`A1:${lastCol}1`);
      expect(getConditionalFormatting(worksheet).rules).to.have.length(5);
      expect(getConditionalFormattingRule(worksheet, 3).formulae).to.deep.equal([
        'OR(A1="audio",LEFT(A1,7)="audio::",A1="image",LEFT(A1,7)="image::",A1="label",LEFT(A1,7)="label::",'
        + 'A1="video",LEFT(A1,7)="video::")'
      ]);
      expect(getConditionalFormattingRule(worksheet, 4).formulae).to.deep.equal(['A1<>""']);
    });
  });

  describe('setChoicesHeaderValidation', () => {
    it('writes the header names to the chtx sheet and adds list validation', () => {
      const [workbook, worksheet] = newWorkbook('choices', ['list_name', 'label']);

      Effect.runSync(setChoicesHeaderValidation(workbook)(worksheet));

      const chtx = workbook.getWorksheet('chtx');
      expect(chtx?.getCell('A1').value).to.equal('choices_header_names');
      const lastCol = worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter;
      const rule = getDataValidation(worksheet, `A1:${lastCol}1`);
      expect(rule).to.deep.include({ type: 'list', allowBlank: true, errorStyle: 'information' });
      expect(rule?.formulae).to.deep.equal(['\'chtx\'!$A$2:$A$7']);
    });
  });
});
