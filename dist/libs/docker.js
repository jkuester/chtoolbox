"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvarFromComposeContainer = exports.rmComposeContainer = exports.destroyCompose = exports.stopCompose = exports.restartComposeService = exports.restartCompose = exports.startCompose = exports.copyFileFromComposeContainer = exports.copyFileToComposeContainer = exports.createComposeContainers = exports.getVolumeLabelValue = exports.doesVolumeExistWithLabel = exports.getVolumeNamesWithLabel = exports.doesComposeProjectHaveContainers = exports.pullComposeImages = void 0;
const platform_1 = require("@effect/platform");
const effect_1 = require("effect");
const dockerCompose = (projectName, ...args) => platform_1.Command.make('docker', 'compose', '-p', projectName, ...args);
const getComposeFileParams = (composeFilePaths) => (0, effect_1.pipe)(composeFilePaths, effect_1.Array.map(path => ['-f', path]), effect_1.Array.flatten);
const debugLoggingEnabled = effect_1.FiberRef
    .get(effect_1.FiberRef.currentMinimumLogLevel)
    .pipe(effect_1.Effect.map(effect_1.LogLevel.lessThanEqual(effect_1.LogLevel.Debug)));
const printCommandWhenDebugLogging = (command) => debugLoggingEnabled.pipe(effect_1.Effect.map(debug => effect_1.Match
    .value(debug)
    .pipe(effect_1.Match.when(true, () => command.pipe(platform_1.Command.stdout('inherit'), platform_1.Command.stderr('inherit'))), effect_1.Match.orElse(() => command))));
const runForExitCode = (command) => printCommandWhenDebugLogging(command)
    .pipe(effect_1.Effect.flatMap(command => command.pipe(platform_1.Command.exitCode)), effect_1.Effect.flatMap(exitCode => effect_1.Match
    .value(exitCode)
    .pipe(effect_1.Match.when(0, () => effect_1.Effect.void), effect_1.Match.orElse(() => effect_1.Effect.fail(new Error(`Docker command failed. Exit code: ${exitCode.toString()}`))))));
const runForString = (command) => command.pipe(platform_1.Command.string, effect_1.Effect.tap(effect_1.Effect.logDebug), effect_1.Effect.map(effect_1.String.trim));
const pullComposeImages = (projectName, env) => (composeFilePaths) => (0, effect_1.pipe)(getComposeFileParams(composeFilePaths), composeFileParams => dockerCompose(projectName, ...composeFileParams, 'pull'), platform_1.Command.env(env), runForExitCode, 
// Pulling all the images at once can result in rate limiting
effect_1.Effect.retry({ schedule: effect_1.Schedule.spaced(2000) }));
exports.pullComposeImages = pullComposeImages;
const doesComposeProjectHaveContainers = (projectName) => dockerCompose(projectName, 'ps', '-qa')
    .pipe(runForString, effect_1.Effect.map(effect_1.String.isNonEmpty));
exports.doesComposeProjectHaveContainers = doesComposeProjectHaveContainers;
const getVolumeNamesWithLabel = (label) => platform_1.Command
    .make('docker', 'volume', 'ls', '--filter', `label=${label}`, '-q')
    .pipe(platform_1.Command.lines, effect_1.Effect.tap(effect_1.Effect.logDebug), effect_1.Effect.map(effect_1.Array.map(effect_1.String.trim)), effect_1.Effect.map(effect_1.Array.filter(effect_1.String.isNonEmpty)));
exports.getVolumeNamesWithLabel = getVolumeNamesWithLabel;
const doesVolumeExistWithLabel = (label) => (0, exports.getVolumeNamesWithLabel)(label)
    .pipe(effect_1.Effect.map(effect_1.Array.isNonEmptyArray));
exports.doesVolumeExistWithLabel = doesVolumeExistWithLabel;
const getVolumeLabelValue = (labelName) => (volumeName) => platform_1.Command
    .make('docker', 'volume', 'inspect', volumeName, '--format', `'{{ index .Labels "${labelName}" }}'`)
    .pipe(runForString, effect_1.Effect.map(effect_1.String.slice(1, -1)));
exports.getVolumeLabelValue = getVolumeLabelValue;
const createComposeContainers = (env, ...composeFilePaths) => (projectName) => (0, effect_1.pipe)(getComposeFileParams(composeFilePaths), composeFileParams => dockerCompose(projectName, ...composeFileParams, 'create'), platform_1.Command.env(env), runForExitCode);
exports.createComposeContainers = createComposeContainers;
const copyFileToComposeContainer = (projectName, containerServiceName) => ([hostFilePath, containerFilePath]) => (0, effect_1.pipe)(`${containerServiceName}:${containerFilePath}`, containerPath => dockerCompose(projectName, 'cp', hostFilePath, containerPath), runForExitCode);
exports.copyFileToComposeContainer = copyFileToComposeContainer;
const copyFileFromComposeContainer = (containerServiceName, containerFilePath, hostFilePath) => (projectName) => (0, effect_1.pipe)(`${containerServiceName}:${containerFilePath}`, containerPath => dockerCompose(projectName, 'cp', containerPath, hostFilePath), runForExitCode);
exports.copyFileFromComposeContainer = copyFileFromComposeContainer;
const startCompose = (projectName) => dockerCompose(projectName, 'start')
    .pipe(runForExitCode);
exports.startCompose = startCompose;
const restartCompose = (projectName) => dockerCompose(projectName, 'restart')
    .pipe(runForExitCode);
exports.restartCompose = restartCompose;
const restartComposeService = (projectName, serviceName) => dockerCompose(projectName, 'restart', serviceName)
    .pipe(runForExitCode);
exports.restartComposeService = restartComposeService;
const stopCompose = (projectName) => dockerCompose(projectName, 'stop')
    .pipe(runForExitCode);
exports.stopCompose = stopCompose;
const destroyCompose = (projectName) => dockerCompose(projectName, 'kill')
    .pipe(runForExitCode, effect_1.Effect.andThen(dockerCompose(projectName, 'down', '-v')
    .pipe(runForExitCode)));
exports.destroyCompose = destroyCompose;
const rmComposeContainer = (serviceName) => (projectName) => dockerCompose(projectName, 'rm', '-f', serviceName)
    .pipe(runForExitCode);
exports.rmComposeContainer = rmComposeContainer;
const getEnvarFromComposeContainer = (containerServiceName, envar) => (projectName) => dockerCompose(projectName, 'exec', containerServiceName, 'printenv', envar)
    .pipe(runForString);
exports.getEnvarFromComposeContainer = getEnvarFromComposeContainer;
//# sourceMappingURL=docker.js.map