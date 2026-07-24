import { Effect, Option, pipe } from 'effect';
import ExcelJS from 'exceljs';
import { getWorksheetWithName } from '../libs/xlsx.ts';
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
} from '../libs/form/survey.ts';
import {
  clearWorkbookFormatting,
  freezeHeaderAndKeyColumns,
  setHeaderlessCellFormatting, SHEET_NAME_CHOICES, SHEET_NAME_SETTINGS,
  SHEET_NAME_SURVEY
} from '../libs/form/index.ts';
import {
  setChoicesHeaderComments,
  setChoicesHeaderFormatting,
  setChoicesHeaderValidation,
} from '../libs/form/choices.ts';
import {
  setSettingsHeaderComments,
  setSettingsHeaderFormatting,
  setSettingsHeaderValidation,
  setSettingsSupportedValuesFormatting,
  setSettingsSupportedValuesValidation,
  setSettingsVersionCachedValue,
} from '../libs/form/settings.ts';

const loadWorkbook = (filePath: string) => pipe(
  new ExcelJS.Workbook(),
  workbook => Effect.tryPromise(() => workbook.xlsx.readFile(filePath)),
);
const saveWorkbook = (
  filePath: string
) => (workbook: ExcelJS.Workbook) => Effect.promise(() => workbook.xlsx.writeFile(filePath));

const formatSurveyWorksheet = (workbook: ExcelJS.Workbook) => pipe(
  getWorksheetWithName(workbook)(SHEET_NAME_SURVEY),
  Option.map(surveySheet => pipe(
    surveySheet,
    Effect.succeed,
    Effect.tap(normalizeSurveyTypeValues),
    Effect.tap(freezeHeaderAndKeyColumns),
    Effect.tap(setSurveyHeaderFormatting),
    Effect.tap(setSurveyHeaderComments),
    Effect.tap(setSurveyHeaderValidation(workbook)),
    Effect.tap(setSurveyTypeFormatting(workbook)),
    Effect.tap(setSurveyTypeValidation),
    Effect.tap(setSurveySupportedValuesValidation),
    Effect.tap(setSurveySupportedValuesFormatting),
    Effect.tap(setSurveyNameFormatting),
    Effect.tap(setSurveyLabelFormatting),
    Effect.tap(setSurveyCalculationFormatting),
    Effect.tap(setSurveyBeginGroupFormatting),
    Effect.tap(setSurveyEndGroupFormatting),
    Effect.tap(setSurveyBeginRepeatFormatting),
    Effect.tap(setSurveyEndRepeatFormatting),
    Effect.tap(setHeaderlessCellFormatting),
  )),
  Option.getOrElse(() => Effect.void)
);

const formatChoicesWorksheet = (workbook: ExcelJS.Workbook) => pipe(
  getWorksheetWithName(workbook)(SHEET_NAME_CHOICES),
  Option.map(choicesSheet => pipe(
    choicesSheet,
    Effect.succeed,
    Effect.tap(freezeHeaderAndKeyColumns),
    Effect.tap(setChoicesHeaderFormatting),
    Effect.tap(setChoicesHeaderComments),
    Effect.tap(setChoicesHeaderValidation(workbook)),
    Effect.tap(setHeaderlessCellFormatting),
  )),
  Option.getOrElse(() => Effect.void)
);

const formatSettingsWorksheet = (workbook: ExcelJS.Workbook) => pipe(
  getWorksheetWithName(workbook)(SHEET_NAME_SETTINGS),
  Option.map(settingsSheet => pipe(
    settingsSheet,
    Effect.succeed,
    Effect.tap(setSettingsVersionCachedValue),
    Effect.tap(setSettingsHeaderFormatting),
    Effect.tap(setSettingsHeaderComments),
    Effect.tap(setSettingsHeaderValidation(workbook)),
    Effect.tap(setSettingsSupportedValuesValidation),
    Effect.tap(setSettingsSupportedValuesFormatting),
    Effect.tap(setHeaderlessCellFormatting),
  )),
  Option.getOrElse(() => Effect.void)
);

const formatWorkbook = (workbook: ExcelJS.Workbook) => pipe(
  Effect.succeed(workbook),
  Effect.tap(clearWorkbookFormatting),
  Effect.tap(formatSurveyWorksheet),
  Effect.tap(formatChoicesWorksheet),
  Effect.tap(formatSettingsWorksheet),
  Effect.asVoid
);

const formatFile = Effect.fn((filePath: string): Effect.Effect<void, Error> => Effect.acquireUseRelease(
  loadWorkbook(filePath),
  formatWorkbook,
  saveWorkbook(filePath)
));

export class FormService extends Effect.Service<FormService>()('chtoolbox/FormService', {
  effect: Effect.succeed({
    formatFile,
  }),
  accessors: true,
}) {
}
