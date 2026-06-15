import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Effect } from 'effect';
import ExcelJS from 'exceljs';
import os from 'node:os';
import nodePath from 'node:path';
import fs from 'node:fs/promises';
import { FormService } from '../../src/services/form.ts';
import { type Worksheet } from '../../src/libs/xlsx.ts';
import { getConditionalFormattings } from '../utils/xlsx.ts';
import { genWithLayer } from '../utils/base.ts';

const run = FormService.Default.pipe(genWithLayer);

const getSheet = (workbook: ExcelJS.Workbook, name: string): Worksheet => {
  const worksheet = workbook.getWorksheet(name);
  if (!worksheet) {
    throw new Error(`Worksheet "${name}" not found.`);
  }
  return worksheet as unknown as Worksheet;
};

const withTempFile = (build: (workbook: ExcelJS.Workbook) => void) => Effect.gen(function* () {
  const dir = yield* Effect.promise(() => fs.mkdtemp(nodePath.join(os.tmpdir(), 'chtx-form-')));
  const filePath = nodePath.join(dir, 'form.xlsx');
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  yield* Effect.promise(() => workbook.xlsx.writeFile(filePath));
  return { dir, filePath };
});

const readWorkbook = (filePath: string) => Effect.promise(async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
});

describe('Form Service', () => {
  describe('formatFile', () => {
    it('formats the survey, choices, and settings sheets', run(function* () {
      const { dir, filePath } = yield* withTempFile(workbook => {
        const survey = workbook.addWorksheet('survey');
        // The name and calculation columns must exist: the formatting chain taps
        // setSurveyNameFormatting / setSurveyCalculationFormatting, which return
        // Option.none() (a failing Effect) when those columns are absent.
        survey.getRow(1).values = ['type', 'name', 'label', 'calculation'];
        survey.getRow(2).values = ['begin group', 'grp'];
        workbook.addWorksheet('choices').getRow(1).values = ['list_name', 'name', 'label'];
        workbook.addWorksheet('settings').getRow(1).values = ['form_title', 'style'];
      });

      yield* FormService.formatFile(filePath);

      const output = yield* readWorkbook(filePath);
      const survey = getSheet(output, 'survey');
      // The alternative "begin group" type is normalized to its canonical form.
      expect(survey.getCell('A2').value).to.equal('begin_group');
      expect(getConditionalFormattings(survey)).to.not.be.empty;
      expect(survey.views.some(view => view.state === 'frozen')).to.be.true;
      expect(getConditionalFormattings(getSheet(output, 'choices'))).to.not.be.empty;
      expect(getConditionalFormattings(getSheet(output, 'settings'))).to.not.be.empty;

      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }));
    }));

    it('writes the file even when none of the known sheets are present', run(function* () {
      const { dir, filePath } = yield* withTempFile(workbook => {
        workbook.addWorksheet('other').getRow(1).values = ['col'];
      });

      yield* FormService.formatFile(filePath);

      const output = yield* readWorkbook(filePath);
      expect(output.getWorksheet('other')).to.not.be.undefined;
      expect(output.getWorksheet('survey')).to.be.undefined;

      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }));
    }));
  });
});
