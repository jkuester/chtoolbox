import { Command } from '@effect/platform';
import { Array, Effect, FiberRef, LogLevel, Match, pipe, Schedule, String } from 'effect';
const dockerCompose = (projectName, ...args) => Command.make('docker', 'compose', '-p', projectName, ...args);
const getComposeFileParams = (composeFilePaths) => pipe(composeFilePaths, Array.map(path => ['-f', path]), Array.flatten);
const debugLoggingEnabled = FiberRef
    .get(FiberRef.currentMinimumLogLevel)
    .pipe(Effect.map(LogLevel.lessThanEqual(LogLevel.Debug)));
const printCommandWhenDebugLogging = (command) => debugLoggingEnabled.pipe(Effect.map(debug => Match
    .value(debug)
    .pipe(Match.when(true, () => command.pipe(Command.stdout('inherit'), Command.stderr('inherit'))), Match.orElse(() => command))));
const runForExitCode = (command) => printCommandWhenDebugLogging(command)
    .pipe(Effect.flatMap(command => command.pipe(Command.exitCode)), Effect.flatMap(exitCode => Match
    .value(exitCode)
    .pipe(Match.when(0, () => Effect.void), Match.orElse(() => Effect.fail(new Error(`Docker command failed. Exit code: ${exitCode.toString()}`))))));
const runForString = (command) => command.pipe(Command.string, Effect.tap(Effect.logDebug), Effect.map(String.trim));
export const pullComposeImages = (projectName, env) => (composeFilePaths) => pipe(getComposeFileParams(composeFilePaths), composeFileParams => dockerCompose(projectName, ...composeFileParams, 'pull'), Command.env(env), runForExitCode, 
// Pulling all the images at once can result in rate limiting
Effect.retry({ schedule: Schedule.spaced(2000) }));
export const doesComposeProjectHaveContainers = (projectName) => dockerCompose(projectName, 'ps', '-qa')
    .pipe(runForString, Effect.map(String.isNonEmpty));
export const getVolumeNamesWithLabel = (label) => Command
    .make('docker', 'volume', 'ls', '--filter', `label=${label}`, '-q')
    .pipe(Command.lines, Effect.tap(Effect.logDebug), Effect.map(Array.map(String.trim)), Effect.map(Array.filter(String.isNonEmpty)));
export const doesVolumeExistWithLabel = (label) => getVolumeNamesWithLabel(label)
    .pipe(Effect.map(Array.isNonEmptyArray));
export const getVolumeLabelValue = (labelName) => (volumeName) => Command
    .make('docker', 'volume', 'inspect', volumeName, '--format', `'{{ index .Labels "${labelName}" }}'`)
    .pipe(runForString, Effect.map(String.slice(1, -1)));
export const createComposeContainers = (env, ...composeFilePaths) => (projectName) => pipe(getComposeFileParams(composeFilePaths), composeFileParams => dockerCompose(projectName, ...composeFileParams, 'create'), Command.env(env), runForExitCode);
export const copyFileToComposeContainer = (projectName, containerServiceName) => ([hostFilePath, containerFilePath]) => pipe(`${containerServiceName}:${containerFilePath}`, containerPath => dockerCompose(projectName, 'cp', hostFilePath, containerPath), runForExitCode);
export const copyFileFromComposeContainer = (containerServiceName, containerFilePath, hostFilePath) => (projectName) => pipe(`${containerServiceName}:${containerFilePath}`, containerPath => dockerCompose(projectName, 'cp', containerPath, hostFilePath), runForExitCode);
export const startCompose = (projectName) => dockerCompose(projectName, 'start')
    .pipe(runForExitCode);
export const restartCompose = (projectName) => dockerCompose(projectName, 'restart')
    .pipe(runForExitCode);
export const restartComposeService = (projectName, serviceName) => dockerCompose(projectName, 'restart', serviceName)
    .pipe(runForExitCode);
export const stopCompose = (projectName) => dockerCompose(projectName, 'stop')
    .pipe(runForExitCode);
export const destroyCompose = (projectName) => dockerCompose(projectName, 'kill')
    .pipe(runForExitCode, Effect.andThen(dockerCompose(projectName, 'down', '-v')
    .pipe(runForExitCode)));
export const rmComposeContainer = (serviceName) => (projectName) => dockerCompose(projectName, 'rm', '-f', serviceName)
    .pipe(runForExitCode);
export const getEnvarFromComposeContainer = (containerServiceName, envar) => (projectName) => dockerCompose(projectName, 'exec', containerServiceName, 'printenv', envar)
    .pipe(runForString);
//# sourceMappingURL=docker.js.map