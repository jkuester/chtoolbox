import { describe, it } from 'mocha';
import sinon from 'sinon';
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
        // Only the type column is required: missing name/calculation columns must not fail formatting.
        survey.getRow(1).values = ['type', 'label'];
        survey.getRow(2).values = ['begin group', 'A label'];
        workbook.addWorksheet('choices').getRow(1).values = ['list_name', 'name', 'label'];
        workbook.addWorksheet('settings').getRow(1).values = ['form_title', 'style'];
      });

      yield* FormService.formatFile(filePath);

      const output = yield* readWorkbook(filePath);
      const survey = getSheet(output, 'survey');
      // The depth column is prepended, so the original columns shift one to the right.
      expect(survey.getCell('A1').value).to.equal('#');
      // The gutter is drawn by conditional formatting alone; its cells hold nothing pyxform can read.
      expect(survey.getCell('A2').value).to.equal(null);
      // The alternative "begin group" type is normalized to its canonical form.
      expect(survey.getCell('B2').value).to.equal('begin_group');
      expect(getConditionalFormattings(survey)).to.not.be.empty;
      expect(survey.views.some(view => view.state === 'frozen')).to.be.true;
      expect(getConditionalFormattings(getSheet(output, 'choices'))).to.not.be.empty;
      expect(getConditionalFormattings(getSheet(output, 'settings'))).to.not.be.empty;

      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }));
    }));

    it('fails without modifying the file when a sheet of its own is named like the chtx sheet', run(function* () {
      const { dir, filePath } = yield* withTempFile(workbook => {
        workbook.addWorksheet('survey').getRow(1).values = ['type', 'name'];
        workbook.addWorksheet('Chtx').getCell('A1').value = 'user data';
      });
      const original = yield* Effect.promise(() => fs.readFile(filePath));

      const error = yield* Effect.flip(FormService.formatFile(filePath));

      expect(error.message).to.equal('Could not format the workbook.');
      expect(yield* Effect.promise(() => fs.readFile(filePath))).to.deep.equal(original);

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

    it('produces the same result when formatting an already formatted file', run(function* () {
      const { dir, filePath } = yield* withTempFile(workbook => {
        const survey = workbook.addWorksheet('survey');
        survey.getRow(1).values = ['type', 'name', 'label'];
        survey.getRow(2).values = ['begin group', 'grp', 'Group'];
        survey.getRow(3).values = ['select_one yes_no', 'q', 'Question'];
        survey.getRow(4).values = ['end group', '', ''];
        survey.mergeCells('C3:D3');
        survey.autoFilter = 'A1:C4';
        const choices = workbook.addWorksheet('choices');
        choices.getRow(1).values = ['list_name', 'name', 'label'];
        choices.getRow(2).values = ['yes_no', 'yes', 'Yes'];
        const settings = workbook.addWorksheet('settings');
        settings.getRow(1).values = ['form_title'];
        settings.getCell('A2').value = { formula: 'survey!C2', result: 'Group' };
      });
      // The whole sheet model (values, styles, columns, comments, merges, views, formatting, validation).
      const snapshot = (workbook: ExcelJS.Workbook) => workbook.worksheets.map(({ model }) => model);

      yield* FormService.formatFile(filePath);
      const first = snapshot(yield* readWorkbook(filePath));
      yield* FormService.formatFile(filePath);
      const second = snapshot(yield* readWorkbook(filePath));

      expect(second).to.deep.equal(first);
      expect(first.map(({ name }) => name)).to.deep.equal(['survey', 'choices', 'settings', 'chtx']);
      expect(first[0]?.merges).to.deep.equal(['D3:E3']);
      expect(first[0]?.autoFilter).to.equal('B1:D4');
      expect(getSheet(yield* readWorkbook(filePath), 'settings').getCell('A2').formula).to.equal('survey!D2');

      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }));
    }));

    it('keeps a falsy cached formula result in a shifted survey column', run(function* () {
      const { dir, filePath } = yield* withTempFile(workbook => {
        const survey = workbook.addWorksheet('survey');
        survey.getRow(1).values = ['type', 'name', 'relevant'];
        survey.getRow(2).values = ['begin group', 'inputs'];
        survey.getCell('C2').value = { formula: 'FALSE()', result: false };
      });

      yield* FormService.formatFile(filePath);

      const output = yield* readWorkbook(filePath);
      const relevant = getSheet(output, 'survey').getCell('D2');
      expect(relevant.formula).to.equal('FALSE()');
      expect(relevant.result).to.equal(false);

      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }));
    }));

    it('formats a workbook with an empty choices sheet', run(function* () {
      const { dir, filePath } = yield* withTempFile(workbook => {
        workbook.addWorksheet('survey').getRow(1).values = ['type', 'name'];
        workbook.addWorksheet('choices');
      });

      yield* FormService.formatFile(filePath);

      const output = yield* readWorkbook(filePath);
      expect(getSheet(output, 'survey').getCell('A1').value).to.equal('#');

      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }));
    }));

    it('fails when the file is not an xlsx workbook', run(function* () {
      const dir = yield* Effect.promise(() => fs.mkdtemp(nodePath.join(os.tmpdir(), 'chtx-form-')));
      const filePath = nodePath.join(dir, 'form.xlsx');
      yield* Effect.promise(() => fs.writeFile(filePath, 'not a workbook'));

      const error = yield* Effect.flip(FormService.formatFile(filePath));

      expect(error.message).to.equal('Could not read the file as an .xlsx workbook.');

      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }));
    }));

    it('fails when the file cannot be written', run(function* () {
      const { dir, filePath } = yield* withTempFile(workbook => {
        workbook.addWorksheet('survey').getRow(1).values = ['type', 'name'];
      });
      yield* Effect.promise(() => fs.chmod(filePath, 0o444));

      const error = yield* Effect.flip(FormService.formatFile(filePath));

      expect(error.message).to.equal('Could not write the file.');

      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }));
    }));

    it('leaves the file unchanged when the workbook cannot be serialized', run(function* () {
      const { dir, filePath } = yield* withTempFile(workbook => {
        workbook.addWorksheet('survey').getRow(1).values = ['type', 'name'];
      });
      const original = yield* Effect.promise(() => fs.readFile(filePath));
      const xlsxPrototype = Object.getPrototypeOf(new ExcelJS.Workbook().xlsx) as ExcelJS.Xlsx;
      const writeBuffer = sinon.stub(xlsxPrototype, 'writeBuffer').rejects(new Error('serialize failed'));

      const error = yield* Effect.flip(FormService.formatFile(filePath)).pipe(
        Effect.ensuring(Effect.sync(() => writeBuffer.restore())),
      );

      expect(error.message).to.equal('Could not write the file.');
      expect(yield* Effect.promise(() => fs.readFile(filePath))).to.deep.equal(original);

      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }));
    }));

    it('fails without modifying the file when ExcelJS cannot format it', run(function* () {
      const { dir, filePath } = yield* withTempFile(workbook => {
        const survey = workbook.addWorksheet('survey');
        survey.getRow(1).values = ['type', 'name'];
        // A value in the last column cannot be moved over to make room for the depth column.
        survey.getCell(2, 16384).value = 'x';
      });
      const original = yield* Effect.promise(() => fs.readFile(filePath));

      const error = yield* Effect.flip(FormService.formatFile(filePath));

      expect(error.message).to.equal('Could not format the workbook.');
      expect(yield* Effect.promise(() => fs.readFile(filePath))).to.deep.equal(original);

      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }));
    }));

    it('fails without modifying the file when the survey sheet has no type column', run(function* () {
      const { dir, filePath } = yield* withTempFile(workbook => {
        const survey = workbook.addWorksheet('survey');
        survey.getRow(1).values = ['name', 'label'];
        survey.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      });
      const original = yield* Effect.promise(() => fs.readFile(filePath));

      const error = yield* Effect.flip(FormService.formatFile(filePath));

      expect(error.message).to.equal('The survey sheet has no "type" column.');
      expect(yield* Effect.promise(() => fs.readFile(filePath))).to.deep.equal(original);

      yield* Effect.promise(() => fs.rm(dir, { recursive: true, force: true }));
    }));
  });
});
