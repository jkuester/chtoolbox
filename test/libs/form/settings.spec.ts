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
  setSettingsHeaderComments,
  setSettingsHeaderFormatting,
  setSettingsHeaderValidation,
  setSettingsSupportedValuesFormatting,
  setSettingsSupportedValuesValidation,
  setSettingsVersionCachedValue,
} from '../../../src/libs/form/settings.ts';

const newWorkbook = (
  headers: readonly string[]
): [ExcelJS.Workbook, Worksheet] => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('settings');
  worksheet.getRow(1).values = [...headers];
  return [workbook, worksheet as unknown as Worksheet];
};

describe('form settings libs', () => {
  describe('setSettingsHeaderComments', () => {
    it('sets the documented comments on the settings columns', () => {
      const [, worksheet] = newWorkbook(['form_title', 'style']);

      setSettingsHeaderComments(worksheet);

      expect(worksheet.getCell('A1').note).to.contain('The title that will be displayed');
      expect(worksheet.getCell('B1').note).to.contain('Specify different ways of displaying questions');
    });
  });

  describe('setSettingsSupportedValuesValidation', () => {
    it('adds list validation for columns with supported values', () => {
      const [, worksheet] = newWorkbook(['style', 'form_title']);

      setSettingsSupportedValuesValidation(worksheet);

      expect(getDataValidation(worksheet, 'A2:A1001')).to.deep.include({ type: 'list', formulae: ['",pages"'] });
      expect(getDataValidation(worksheet, 'B2:B1001')).to.be.undefined;
    });
  });

  describe('setSettingsSupportedValuesFormatting', () => {
    it('adds error formatting for unsupported values', () => {
      const [, worksheet] = newWorkbook(['style']);

      setSettingsSupportedValuesFormatting(worksheet);

      expect(worksheet.getColumn('A').numFmt).to.equal('@');
      expect(getConditionalFormattingRule(worksheet, 0).formulae).to.deep.equal(['AND(A2<>"",A2<>"pages")']);
    });
  });

  describe('setSettingsHeaderFormatting', () => {
    it('adds the four header conditional formatting rules', () => {
      const [, worksheet] = newWorkbook(['form_title', 'unknown_col']);

      setSettingsHeaderFormatting(worksheet);

      const lastCol = worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter;
      expect(getConditionalFormattings(worksheet)).to.have.length(1);
      expect(getConditionalFormatting(worksheet).ref).to.equal(`A1:${lastCol}1`);
      expect(getConditionalFormatting(worksheet).rules).to.have.length(4);
      const known = 'NOT(ISERROR(MATCH(A1,{"allow_choice_duplicates","form_title","namespaces","style","version"},0)))';
      expect(getConditionalFormattingRule(worksheet, 1).formulae).to.deep.equal([`AND(A1<>"",NOT(${known}))`]);
      expect(getConditionalFormattingRule(worksheet, 3).formulae).to.deep.equal([known]);
    });
  });

  describe('setSettingsHeaderValidation', () => {
    it('writes the header names to the chtx sheet and adds list validation', () => {
      const [workbook, worksheet] = newWorkbook(['form_title']);

      Effect.runSync(setSettingsHeaderValidation(workbook)(worksheet));

      const chtx = workbook.getWorksheet('chtx');
      expect(chtx?.getCell('A1').value).to.equal('settings_header_names');
      const lastCol = worksheet.getColumn(getHeaderNames(worksheet).length + BUFFER_COL_COUNT).letter;
      const rule = getDataValidation(worksheet, `A1:${lastCol}1`);
      expect(rule).to.deep.include({ type: 'list', errorStyle: 'information', error: 'Unexpected column name.' });
      expect(rule?.formulae).to.deep.equal(['\'chtx\'!$A$2:$A$6']);
    });
  });

  describe('setSettingsVersionCachedValue', () => {
    it('caches a timestamp string for a formula version cell, keeping the formula', () => {
      const [, worksheet] = newWorkbook(['form_title', 'version']);
      worksheet.getCell('B2').value = { formula: 'TEXT(NOW(), "yyyymmddhhmmss")' } as ExcelJS.CellFormulaValue;

      Effect.runSync(setSettingsVersionCachedValue(worksheet));

      const value = worksheet.getCell('B2').value as { formula: string, result: unknown };
      expect(value.formula).to.equal('TEXT(NOW(), "yyyymmddhhmmss")');
      expect(value.result).to.match(/^\d{14}$/);
    });

    it('leaves a static version value untouched', () => {
      const [, worksheet] = newWorkbook(['version']);
      worksheet.getCell('A2').value = '2017021501';

      Effect.runSync(setSettingsVersionCachedValue(worksheet));

      expect(worksheet.getCell('A2').value).to.equal('2017021501');
    });

    it('does nothing when there is no version column', () => {
      const [, worksheet] = newWorkbook(['form_title']);
      worksheet.getCell('A2').value = { formula: 'TEXT(NOW(), "yyyymmddhhmmss")' } as ExcelJS.CellFormulaValue;

      Effect.runSync(setSettingsVersionCachedValue(worksheet));

      expect((worksheet.getCell('A2').value as { result: unknown }).result).to.be.undefined;
    });
  });
});
