import { Command } from '@effect/platform';
import { Array, Effect, FiberRef, Logger, LogLevel, Match, pipe, Schedule, Schema, String } from 'effect';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { PlatformError } from '@effect/platform/Error';
import { NodeContext, NodeHttpClient } from '@effect/platform-node';

class DockerComposeProjectInfo extends Schema.Class<DockerComposeProjectInfo>('DockerComposeProjectInfo')({
  Name: Schema.String,
  Status: Schema.String,
}) {
  static readonly decodeResponse = (response: string) => pipe(
    response,
    JSON.parse,
    Schema.decodeUnknown(Schema.Array(DockerComposeProjectInfo)),
  );
}

const dockerCompose = (projectName: string, composeFilePaths: string[], ...args: string[]) => pipe(
  composeFilePaths,
  Array.map(path => ['-f', path]),
  Array.flatten,
  composePathArgs => Command.make('docker', 'compose', '-p', projectName, ...composePathArgs, ...args),
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
        Match.orElse(() => Effect.fail(new Error(`Failed to create containers. Exit code: ${exitCode.toString()}`))),
      )),
  );

export const pullComposeImages = (
  projectName: string,
  env: Record<string, string>,
  ...composeFilePaths: string[]
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(
  projectName, composeFilePaths, 'pull'
)
  .pipe(
    Command.env(env),
    runForExitCode,
    // Pulling all the images at once can result in rate limiting
    Effect.retry({
      times: 10,
      schedule: Schedule.spaced(1000),
    }),
  );

const composeProjectInfos = Command
  .make('docker', 'compose', 'ls', '--all', '--format', 'json')
  .pipe(
    Command.string,
    Effect.flatMap(DockerComposeProjectInfo.decodeResponse),
  );

export const doesComposeProjectExist = (
  projectName: string
): Effect.Effect<boolean, PlatformError | Error, CommandExecutor> => composeProjectInfos.pipe(
  Effect.map(Array.some(info => info.Name === projectName)),
);

export const doesVolumeExistWithLabel = (
  label: string
): Effect.Effect<boolean, PlatformError, CommandExecutor> => Command
  .make('docker', 'volume', 'ls', '--filter', `label=${label}`, '-q',)
  .pipe(
    Command.string,
    Effect.map(String.trim),
    Effect.map(String.isNonEmpty),
  );

export const createComposeContainers = (
  projectName: string,
  env: Record<string, string>,
  ...composeFilePaths: string[]
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(
  projectName, composeFilePaths, 'create',
)
  .pipe(
    Command.env(env),
    runForExitCode,
  );

export const copyFileToComposeContainer = (
  projectName: string,
  hostFilePath: string,
  containerServiceName: string,
  containerFilePath: string,
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(
  projectName, [], 'cp', hostFilePath, `${containerServiceName}:${containerFilePath}`,
)
  .pipe(runForExitCode);

export const copyFileFromComposeContainer = (
  projectName: string,
  containerServiceName: string,
  containerFilePath: string,
  hostFilePath: string,
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(
  projectName, [], 'cp', `${containerServiceName}:${containerFilePath}`, hostFilePath,
)
  .pipe(runForExitCode);

export const restartCompose = (
  projectName: string,
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(
  projectName, [], 'restart',
)
  .pipe(runForExitCode);

export const stopCompose = (
  projectName: string,
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(
  projectName, [], 'stop',
)
  .pipe(runForExitCode);

export const destroyCompose = (
  projectName: string,
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(
  projectName, [], 'kill',
)
  .pipe(
    runForExitCode,
    Effect.andThen(dockerCompose(projectName, [], 'down', '-v')
      .pipe(
        runForExitCode
      )),
  );

export const rmComposeContainer = (
  projectName: string, serviceName: string
): Effect.Effect<void, Error | PlatformError, CommandExecutor> => dockerCompose(
  projectName, [], 'rm', '-f', serviceName
)
  .pipe(runForExitCode);

export const getEnvarFromComposeContainer = (
  projectName: string, containerServiceName: string, envar: string
): Effect.Effect<string, PlatformError, CommandExecutor> => dockerCompose(
  projectName, [], 'exec', containerServiceName, 'printenv', envar
)
  .pipe(
    Command.string,
    Effect.map(String.trim),
  );

// (async () => {
//   await Effect.runPromise(composeProjectInfos.pipe(
//     Effect.map(x => x),
//     Effect.tap(Effect.log),
//     Effect.provide(NodeHttpClient.layer),
//     Effect.provide(NodeContext.layer),
//     Logger.withMinimumLogLevel(LogLevel.Debug),
//   ));
// })();
