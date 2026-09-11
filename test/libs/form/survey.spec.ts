import { describe, it } from 'mocha';
import { expect } from 'chai';
import { Effect } from 'effect';
import ExcelJS from 'exceljs';
import { getHeaderNames, STYLE, type Worksheet } from '../../../src/libs/xlsx.ts';
import { BUFFER_COL_COUNT, FORM_STYLE } from '../../../src/libs/form/index.ts';
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
  setSurveyDepthColumn,
  setSurveyDepthFormatting,
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

    it('accepts any non-empty file value for the from_file select types', () => {
      const [workbook, worksheet] = newWorkbook(['type', 'name']);

      setSurveyTypeFormatting(workbook)(worksheet);

      const formula = getConditionalFormattingRule(worksheet, 0).formulae[0] ?? '';
      expect(formula).to.contain('AND(LEFT(A2,21)="select_one_from_file ",LEN(A2)>21)');
      expect(formula).to.contain('AND(LEFT(A2,26)="select_multiple_from_file ",LEN(A2)>26)');
      expect(formula).to.not.contain('file.extension');
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
      // A duplicate header breaks the pyxform build; an unrecognized one is only silently ignored.
      expect(getConditionalFormattingRule(worksheet, 0).style).to.deep.equal(FORM_STYLE.ERROR);
      expect(getConditionalFormattingRule(worksheet, 1).style).to.deep.equal(FORM_STYLE.WARNING);
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
    it('adds warning formatting for supported-value columns', () => {
      const [, worksheet] = newWorkbook(['type', 'read_only']);

      setSurveySupportedValuesFormatting(worksheet);

      expect(worksheet.getColumn('B').numFmt).to.equal('@');
      expect(getConditionalFormattingRule(worksheet, 0).formulae).to.deep.equal(['AND(B2<>"",B2<>"true")']);
    });
  });

  describe('setSurveyNameFormatting', () => {
    it('flags rows that have a type requiring a name but no name', () => {
      const [, worksheet] = newWorkbook(['type', 'name']);

      setSurveyNameFormatting(worksheet);

      const rule = getConditionalFormattingRule(worksheet, 0);
      expect(rule.formulae).to.deep.equal([
        'AND(A2<>"",B2="",NOT(NOT(ISERROR(MATCH(A2,{"end_group","end_repeat"},0)))))'
      ]);
      expect(rule.style).to.deep.equal(FORM_STYLE.ERROR);
    });

    it('warns instead of erroring on the boundary types where a name is optional', () => {
      const [, worksheet] = newWorkbook(['type', 'name']);

      setSurveyNameFormatting(worksheet);

      expect(getConditionalFormatting(worksheet).rules).to.have.length(2);
      const rule = getConditionalFormattingRule(worksheet, 1);
      expect(rule.formulae).to.deep.equal(['AND(B2="",NOT(ISERROR(MATCH(A2,{"end_group","end_repeat"},0))))']);
      expect(rule.style).to.deep.equal(FORM_STYLE.WARNING);
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
      // All three label problems still convert, so they warn rather than erroring.
      expect(getConditionalFormatting(worksheet).rules.map(({ style }) => style))
        .to.deep.equal([FORM_STYLE.WARNING, FORM_STYLE.WARNING, FORM_STYLE.WARNING]);
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
      // The gutter is always in place by the time the body formatters run.
      setSurveyDepthColumn(worksheet);

      setSurveyBeginGroupFormatting(worksheet);
      setSurveyEndGroupFormatting(worksheet);
      setSurveyBeginRepeatFormatting(worksheet);
      setSurveyEndRepeatFormatting(worksheet);

      expect(getConditionalFormattings(worksheet)).to.have.length(4);
      expect(getConditionalFormattingRule(worksheet, 0, 0).formulae).to.deep.equal(['AND($B2="begin_group",B$1<>"")']);
      expect(getConditionalFormattingRule(worksheet, 0, 3).formulae).to.deep.equal(['AND($B2="end_repeat",B$1<>"")']);
    });

    it('stops short of the depth gutter, which would drop the depth fill on boundary rows', () => {
      const [, worksheet] = newWorkbook(['type', 'name']);
      setSurveyDepthColumn(worksheet);

      setSurveyBeginGroupFormatting(worksheet);

      // Starts at B, so nothing but the depth rules covers the `#` column.
      expect(getConditionalFormatting(worksheet, 0).ref).to.equal('B2:BB1001');
      expect(getConditionalFormattingRule(worksheet, 0).formulae).to.deep.equal(['AND($B2="begin_group",B$1<>"")']);
    });
  });
  describe('setSurveyDepthColumn', () => {
    it('inserts the depth column ahead of the existing columns', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1']]);

      setSurveyDepthColumn(worksheet);

      expect(getHeaderNames(worksheet).slice(1)).to.deep.equal(['#', 'type', 'name']);
      expect(worksheet.getCell('B2').value).to.equal('begin_group');
      expect(worksheet.getCell('C2').value).to.equal('g1');
    });

    it('counts open groups and repeats, crediting end rows to the group they close', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1']]);

      setSurveyDepthColumn(worksheet);
      setSurveyDepthFormatting(worksheet);

      expect(worksheet.getCell('A2').value).to.deep.equal({
        formula: 'COUNTIF($B$2:$B2,"begin_*")-COUNTIF($B$2:$B2,"end_*")+IF(LEFT($B2,4)="end_",1,0)',
      });
    });

    it('hides the depth values, leaving the background as the only indicator', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['text', 'q1']]);

      setSurveyDepthColumn(worksheet);

      expect(worksheet.getColumn('A').numFmt).to.equal(';;;');
    });

    it('leaves the header label visible, which the column format would otherwise blank', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['text', 'q1']]);

      setSurveyDepthColumn(worksheet);

      expect(worksheet.getCell('A1').value).to.equal('#');
      expect(worksheet.getCell('A1').numFmt).to.equal('General');
      expect(worksheet.getCell('A2').numFmt).to.equal(';;;');
    });

    it('pads the column beside the gutter, so the fill does not run into its text', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1']]);

      setSurveyDepthColumn(worksheet);

      // On the column, for rows added later...
      expect(worksheet.getColumn('B').numFmt).to.equal('" "@');
      // ...and on the cells of rows that already exist and so do not inherit it.
      expect(worksheet.getCell('B1').numFmt).to.equal('" "@');
      expect(worksheet.getCell('B2').numFmt).to.equal('" "@');
      // Only the neighbour: the columns past it are left alone.
      expect(worksheet.getCell('C2').numFmt).to.equal(undefined);
    });

    it('pads only the display, leaving the value pyxform reads untouched', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1']]);

      setSurveyDepthColumn(worksheet);

      expect(worksheet.getCell('B2').value).to.equal('begin_group');
      expect(getHeaderNames(worksheet).slice(1)).to.deep.equal(['#', 'type', 'name']);
    });

    it('moves a gutter that has drifted back to the leading column', () => {
      // As left by a user inserting a column ahead of the generated gutter.
      const [, worksheet] = newWorkbook(['notes', '#', 'type', 'name'], [['', '', 'begin_group', 'g1']]);

      setSurveyDepthColumn(worksheet);

      expect(getHeaderNames(worksheet).slice(1)).to.deep.equal(['#', 'notes', 'type', 'name']);
      // Rebuilt in place rather than duplicated, and the row's own values ride along.
      expect(worksheet.getCell('C2').value).to.equal('begin_group');
      expect(worksheet.getCell('D2').value).to.equal('g1');
    });

    it('keeps the row-spanning rules clear of a gutter that had drifted', () => {
      const [, worksheet] = newWorkbook(['notes', '#', 'type', 'name'], [['', '', 'begin_group', 'g1']]);
      setSurveyDepthColumn(worksheet);

      setSurveyBeginGroupFormatting(worksheet);

      // Starts past the gutter, which before normalising it would have overlapped and suppressed.
      expect(getConditionalFormatting(worksheet, 0).ref).to.match(/^B2:/);
    });

    it('reuses the existing depth column instead of adding another', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1']]);

      setSurveyDepthColumn(worksheet);
      setSurveyDepthColumn(worksheet);

      expect(getHeaderNames(worksheet).slice(1)).to.deep.equal(['#', 'type', 'name']);
    });

    it('adds the column to a survey sheet with no rows', () => {
      const [, worksheet] = newWorkbook(['type', 'name']);

      setSurveyDepthColumn(worksheet);

      expect(getHeaderNames(worksheet).slice(1)).to.deep.equal(['#', 'type', 'name']);
      expect(worksheet.rowCount).to.equal(1);
    });

    it('drops stale formulas so repeat runs do not grow the sheet by the buffer each time', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1']]);

      setSurveyDepthColumn(worksheet);
      setSurveyDepthFormatting(worksheet);
      const grownRowCount = worksheet.rowCount;
      setSurveyDepthColumn(worksheet);

      expect(grownRowCount).to.equal(1002);
      expect(worksheet.rowCount).to.equal(2);
    });
  });

  describe('setSurveyDepthFormatting', () => {
    it('fills the buffer rows so rows appended below the form are shaded too', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1']]);
      setSurveyDepthColumn(worksheet);

      setSurveyDepthFormatting(worksheet);

      expect(worksheet.getCell('A1002').value).to.have.property('formula');
      expect(worksheet.getCell('A1003').value).to.equal(null);
    });

    it('hides the number on rows that already existed, which miss the column format', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1']]);
      // An empty row record, as left behind by a user appending further down the sheet.
      worksheet.getRow(3);
      setSurveyDepthColumn(worksheet);

      setSurveyDepthFormatting(worksheet);

      expect(worksheet.getCell('A3').numFmt).to.equal(';;;');
    });

    it('reports the enclosing depth for blank rows inside a group', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1'], ['', '']]);
      setSurveyDepthColumn(worksheet);

      setSurveyDepthFormatting(worksheet);

      // No blank-type guard, so the running count carries through the empty row.
      expect(worksheet.getCell('A3').value).to.deep.equal({
        formula: 'COUNTIF($B$2:$B3,"begin_*")-COUNTIF($B$2:$B3,"end_*")+IF(LEFT($B3,4)="end_",1,0)',
      });
    });

    it('tinges the depth cell bluer at each nesting level, deepest rule first', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1']]);
      setSurveyDepthColumn(worksheet);

      setSurveyDepthFormatting(worksheet);

      const formatting = getConditionalFormatting(worksheet, 0);
      expect(formatting.ref).to.equal('A2:A1002');
      expect(formatting.rules.map(({ formulae }) => formulae[0])).to.deep.equal([
        'A2>=6',
        'A2>=5',
        'A2>=4',
        'A2>=3',
        'A2>=2',
        'A2>=1',
      ]);
      // Deepest first, fading back toward the dark-theme background. Nothing matches at depth 0.
      expect(formatting.rules.map(({ style }) => (style as { fill: { bgColor: object } }).fill.bgColor))
        .to.deep.equal([
          { argb: 'FF0070C0' },
          { argb: 'FF2C84C4' },
          { argb: 'FF5296C7' },
          { argb: 'FF75A7CB' },
          { argb: 'FF96B6CD' },
          { argb: 'FFB4C5D0' },
        ]);
    });

    it('orders the fade deepest first, so the deepest match wins the fill', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1']]);
      setSurveyDepthColumn(worksheet);

      setSurveyDepthFormatting(worksheet);

      expect(getConditionalFormatting(worksheet, 0).rules.map(({ priority }) => priority))
        .to.deep.equal([1, 2, 3, 4, 5, 6]);
    });

    it('paints the resting grey on the depth cells, which is level 0 of the ramp', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['text', 'q1']]);
      setSurveyDepthColumn(worksheet);

      setSurveyDepthFormatting(worksheet);

      expect(worksheet.getCell('A2').fill).to.deep.equal(STYLE.FILL.GREY);
    });

    it('leaves the grey off the column, which would run it to the foot of the sheet', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['text', 'q1']]);
      setSurveyDepthColumn(worksheet);

      setSurveyDepthFormatting(worksheet);

      expect(worksheet.getColumn('A').style.fill).to.equal(undefined);
      // Bounded to the rows carrying a depth formula.
      expect(worksheet.getCell('A1002').fill).to.deep.equal(STYLE.FILL.GREY);
      expect(worksheet.getCell('A1003').fill).to.equal(undefined);
    });

    it('does nothing when there is no depth column', () => {
      const [, worksheet] = newWorkbook(['type', 'name'], [['begin_group', 'g1']]);

      setSurveyDepthFormatting(worksheet);

      expect(getConditionalFormattings(worksheet)).to.have.length(0);
    });
  });
});
