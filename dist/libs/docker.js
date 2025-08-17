import { Command } from '@effect/platform';
import { Array, Boolean, Effect, Function, Option, pipe, Schedule, String } from 'effect';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { PlatformError } from '@effect/platform/Error';
import { debugLoggingEnabled } from "./console.js";
const dockerCompose = (projectName, ...args) => Command.make('docker', 'compose', '-p', projectName, ...args);
const getComposeFileParams = (composeFilePaths) => pipe(composeFilePaths, Array.map(path => ['-f', path]), Array.flatten);
const setCommandStdOut = (destination) => Effect.fn((command) => command.pipe(Command.stdout(destination), Command.stderr(destination), Effect.succeed));
const printCommandWhenDebugLogging = Effect.fn((command) => pipe(Effect.succeed(command), Effect.filterEffectOrElse({
    predicate: () => debugLoggingEnabled.pipe(Effect.map(Boolean.not)),
    orElse: setCommandStdOut('inherit')
})));
const runForExitCode = Effect.fn((command) => printCommandWhenDebugLogging(command)
    .pipe(Effect.flatMap(Command.exitCode), Effect.filterOrFail(exitCode => exitCode === 0, exitCode => new Error(`Docker command failed. Exit code: ${exitCode.toString()}`))));
const runForString = Effect.fn((command) => command.pipe(Command.string, Effect.tap(Effect.logDebug), Effect.map(String.trim)));
export const pullImage = Effect.fn((image) => Command
    .make('docker', 'pull', image)
    .pipe(runForExitCode));
const pullImagesForComposeFiles = (projectName) => (composeFileParams) => dockerCompose(projectName, ...composeFileParams, 'pull');
export const pullComposeImages = (projectName, env) => Effect.fn((composeFilePaths) => pipe(getComposeFileParams(composeFilePaths), pullImagesForComposeFiles(projectName), Command.env(env), runForExitCode, 
// Pulling all the images at once can result in rate limiting
Effect.retry({ schedule: Schedule.spaced(2000) })));
const getStatusParams = (statuses) => pipe(statuses, Array.flatMap(status => ['--status', status]));
const psComposeProject = (projectName) => (args) => dockerCompose(projectName, 'ps', '-q', ...args);
export const getContainersForComposeProject = Effect.fn((projectName, ...statuses) => Option
    .liftPredicate(statuses, Array.isNonEmptyArray)
    .pipe(Option.map(getStatusParams), Option.getOrElse(() => ['-a']), psComposeProject(projectName), runForString, Effect.map(String.split('\n')), Effect.map(Array.map(String.trim)), Effect.map(Array.filter(String.isNonEmpty))));
const getEntityWithLabel = (entity) => Effect.fn((label) => Command
    .make('docker', entity, 'ls', '--filter', `label=${label}`, '-q')
    .pipe(Command.lines, Effect.tap(Effect.logDebug), Effect.map(Array.map(String.trim)), Effect.map(Array.filter(String.isNonEmpty))));
export const getVolumeNamesWithLabel = getEntityWithLabel('volume');
export const getContainerNamesWithLabel = getEntityWithLabel('container');
export const doesVolumeExistWithLabel = Effect.fn((label) => getVolumeNamesWithLabel(label)
    .pipe(Effect.map(Array.isNonEmptyArray)));
export const getVolumeLabelValue = (labelName) => Effect.fn((volumeName) => Command
    .make('docker', 'volume', 'inspect', volumeName, '--format', `'{{ index .Labels "${labelName}" }}'`)
    .pipe(runForString, Effect.map(String.slice(1, -1))));
export const getContainerLabelValue = (labelName) => Effect.fn((container) => Command
    .make('docker', 'container', 'inspect', container, '--format', `'{{ index .Config.Labels "${labelName}" }}'`)
    .pipe(runForString, Effect.map(String.slice(1, -1))));
export const createComposeContainers = (env, ...composeFilePaths) => Effect.fn((projectName) => pipe(getComposeFileParams(composeFilePaths), composeFileParams => dockerCompose(projectName, ...composeFileParams, 'create'), Command.env(env), runForExitCode));
export const copyFileToComposeContainer = (projectName, containerServiceName) => Effect.fn(([hostFilePath, containerFilePath]) => pipe(`${containerServiceName}:${containerFilePath}`, containerPath => dockerCompose(projectName, 'cp', hostFilePath, containerPath), runForExitCode));
export const copyFileFromComposeContainer = (containerServiceName, containerFilePath, hostFilePath) => Effect.fn((projectName) => pipe(`${containerServiceName}:${containerFilePath}`, containerPath => dockerCompose(projectName, 'cp', containerPath, hostFilePath), runForExitCode));
export const startCompose = Effect.fn((projectName) => dockerCompose(projectName, 'start')
    .pipe(runForExitCode));
export const restartCompose = Effect.fn((projectName) => dockerCompose(projectName, 'restart')
    .pipe(runForExitCode));
export const restartComposeService = Effect.fn((projectName, serviceName) => dockerCompose(projectName, 'restart', serviceName)
    .pipe(runForExitCode));
export const stopCompose = Effect.fn((projectName) => dockerCompose(projectName, 'stop')
    .pipe(runForExitCode));
const downCompose = Effect.fn((projectName) => dockerCompose(projectName, 'down', '-v')
    .pipe(runForExitCode));
export const destroyCompose = Effect.fn((projectName) => pipe(dockerCompose(projectName, 'kill'), runForExitCode, Effect.andThen(downCompose(projectName))));
export const rmComposeContainer = (serviceName) => Effect.fn((projectName) => dockerCompose(projectName, 'rm', '-f', serviceName)
    .pipe(runForExitCode));
export const getEnvarFromComposeContainer = Effect.fn((containerServiceName, envar, projectName) => dockerCompose(projectName, 'exec', containerServiceName, 'printenv', envar)
    .pipe(runForString));
const getEnvParams = (env) => pipe(Option.fromNullable(env), Option.map(envMap => Object.entries(envMap)), Option.map(Array.map(([key, value]) => ['--env', `${key}=${value}`])), Option.map(Array.flatten), Option.getOrElse(() => []));
const getPortParams = (ports) => pipe(ports, Array.map(([host, container]) => ['--publish', `${host.toString()}:${container.toString()}`]), Array.flatten);
export const runContainer = Effect.fn(({ image, name, env, labels = [], ports = [] }) => pipe(Array.make('docker', 'run', '--detach', '--restart', 'always', `--name`, name), Array.appendAll(labels.flatMap(label => ['--label', label])), Array.appendAll(getEnvParams(env)), Array.appendAll(getPortParams(ports)), Array.append(image), Function.tupled(Command.make), runForExitCode));
export const doesContainerExist = Effect.fn((containerName) => Command.make('docker', 'container', 'ls', '-q', '--filter', `name=${containerName}`), runForString, Effect.map(String.isNonEmpty));
export const rmContainer = Effect.fn((name) => Command.make('docker', 'rm', '-f', name), runForExitCode);
