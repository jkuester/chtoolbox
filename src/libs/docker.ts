import { Command } from '@effect/platform';
import { Array, Effect, FiberRef, LogLevel, Match, pipe, Schedule, String } from 'effect';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { PlatformError } from '@effect/platform/Error';

const dockerCompose = (
  projectName: string,
  ...args: string[]
) => Command.make('docker', 'compose', '-p', projectName, ...args);

const getComposeFileParams = (composeFilePaths: string[]) => pipe(
  composeFilePaths,
  Array.map(path => ['-f', path]),
  Array.flatten,
);

const debugLoggingEnabled = FiberRef
  .get(FiberRef.currentMinimumLogLevel)
  .pipe(Effect.map(LogLevel.lessThanEqual(LogLevel.Debug)));

const printCommandWhenDebugLogging = (command: Command.Command) => debugLoggingEnabled.pipe(
  Effect.map(debug => Match
    .value(debug)
    .pipe(
      Match.when(true, () => command.pipe(
        Command.stdout('inherit'),
        Command.stderr('inherit'),
      )),
      Match.orElse(() => command),
    )),
);

const runForExitCode = (command: Command.Command) => printCommandWhenDebugLogging(command)
  .pipe(
    Effect.flatMap(command => command.pipe(Command.exitCode)),
    Effect.flatMap(exitCode => Match
      .value(exitCode)
      .pipe(
        Match.when(0, () => Effect.void),
        Match.orElse(() => Effect.fail(new Error(`Docker command failed. Exit code: ${exitCode.toString()}`))),
      )),
  );

const runForString = (command: Command.Command) => command.pipe(
  Command.string,
  Effect.tap(Effect.logDebug),
  Effect.map(String.trim),
);

export const pullComposeImages = (projectName: string, env: Record<string, string>) => (
  composeFilePaths: string[]
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => pipe(
  getComposeFileParams(composeFilePaths),
  composeFileParams => dockerCompose(projectName, ...composeFileParams, 'pull'),
  Command.env(env),
  runForExitCode,
  // Pulling all the images at once can result in rate limiting
  Effect.retry({ schedule: Schedule.spaced(2000) }),
);

export const doesComposeProjectHaveContainers = (
  projectName: string
): Effect.Effect<boolean, PlatformError | Error, CommandExecutor> => dockerCompose(projectName, 'ps', '-qa')
  .pipe(
    runForString,
    Effect.map(String.isNonEmpty),
  );

export const getVolumeNamesWithLabel = (
  label: string
): Effect.Effect<string[], PlatformError, CommandExecutor> => Command
  .make('docker', 'volume', 'ls', '--filter', `label=${label}`, '-q',)
  .pipe(
    Command.lines,
    Effect.tap(Effect.logDebug),
    Effect.map(Array.map(String.trim)),
    Effect.map(Array.filter(String.isNonEmpty)),
  );

export const doesVolumeExistWithLabel = (
  label: string
): Effect.Effect<boolean, PlatformError, CommandExecutor> => getVolumeNamesWithLabel(label)
  .pipe(Effect.map(Array.isNonEmptyArray));

export const getVolumeLabelValue = (labelName: string) => (
  volumeName: string,
): Effect.Effect<string, PlatformError, CommandExecutor> => Command
  .make('docker', 'volume', 'inspect', volumeName, '--format', `'{{ index .Labels "${labelName}" }}'`)
  .pipe(
    runForString,
    Effect.map(String.slice(1, -1)),
  );

export const createComposeContainers = (
  env: Record<string, string>,
  ...composeFilePaths: string[]
) => (projectName: string): Effect.Effect<void, Error | PlatformError, CommandExecutor> => pipe(
  getComposeFileParams(composeFilePaths),
  composeFileParams => dockerCompose(projectName, ...composeFileParams, 'create'),
  Command.env(env),
  runForExitCode,
);

export const copyFileToComposeContainer = (
  projectName: string,
  containerServiceName: string,
) => (
  [hostFilePath, containerFilePath]: [string, string]
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => pipe(
  `${containerServiceName}:${containerFilePath}`,
  containerPath => dockerCompose(projectName, 'cp', hostFilePath, containerPath),
  runForExitCode
);

export const copyFileFromComposeContainer = (
  containerServiceName: string,
  containerFilePath: string,
  hostFilePath: string,
) => (projectName: string): Effect.Effect<void, Error | PlatformError, CommandExecutor> => pipe(
  `${containerServiceName}:${containerFilePath}`,
  containerPath => dockerCompose(projectName, 'cp', containerPath, hostFilePath),
  runForExitCode
);

export const startCompose = (
  projectName: string,
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(projectName, 'start')
  .pipe(runForExitCode);

export const restartCompose = (
  projectName: string,
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(projectName, 'restart')
  .pipe(runForExitCode);

export const restartComposeService = (
  projectName: string,
  serviceName: string,
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(projectName, 'restart', serviceName)
  .pipe(runForExitCode);

export const stopCompose = (
  projectName: string,
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(projectName, 'stop')
  .pipe(runForExitCode);

export const destroyCompose = (
  projectName: string,
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(projectName, 'kill')
  .pipe(
    runForExitCode,
    Effect.andThen(dockerCompose(projectName, 'down', '-v')
      .pipe(runForExitCode)),
  );

export const rmComposeContainer = (serviceName: string) => (
  projectName: string
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(projectName, 'rm', '-f', serviceName)
  .pipe(runForExitCode);

export const getEnvarFromComposeContainer = (
  containerServiceName: string,
  envar: string,
  projectName: string
): Effect.Effect<string, PlatformError, CommandExecutor> => dockerCompose(
  projectName, 'exec', containerServiceName, 'printenv', envar
)
  .pipe(runForString);
