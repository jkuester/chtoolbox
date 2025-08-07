import { Command } from '@effect/platform';
import { Array, Boolean, Effect, Option, pipe, Schedule, String } from 'effect';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { PlatformError } from '@effect/platform/Error';
import { debugLoggingEnabled } from './console.ts';

const dockerCompose = (
  projectName: string,
  ...args: string[]
) => Command.make('docker', 'compose', '-p', projectName, ...args);

const getComposeFileParams = (composeFilePaths: string[]) => pipe(
  composeFilePaths,
  Array.map(path => ['-f', path]),
  Array.flatten,
);

const printCommandWhenDebugLogging = (command: Command.Command) => Effect
  .succeed(command)
  .pipe(
    Effect.filterEffectOrElse({
      predicate: () => debugLoggingEnabled.pipe(Effect.map(Boolean.not)),
      orElse: () => Effect.succeed(command.pipe(
        Command.stdout('inherit'),
        Command.stderr('inherit'),
      ))
    }),
  );

const runForExitCode = (command: Command.Command) => printCommandWhenDebugLogging(command)
  .pipe(
    Effect.flatMap(command => command.pipe(Command.exitCode)),
    Effect.filterOrFail(
      exitCode => exitCode === 0,
      exitCode => new Error(`Docker command failed. Exit code: ${exitCode.toString()}`)
    )
  );

const runForString = (command: Command.Command) => command.pipe(
  Command.string,
  Effect.tap(Effect.logDebug),
  Effect.map(String.trim),
);

export const pullImage = (image: string): Effect.Effect<void, Error | PlatformError, CommandExecutor> => Command
  .make('docker', 'pull', image)
  .pipe(runForExitCode);

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

type DockerContainerStatus = 'running' | 'exited' | 'created' | 'paused' | 'restarting' | 'removing' | 'dead';

export const getContainersForComposeProject = (
  projectName: string,
  ...statuses: DockerContainerStatus[]
): Effect.Effect<string[], PlatformError, CommandExecutor> => Option
  .liftPredicate(statuses, Array.isNonEmptyArray)
  .pipe(
    Option.map(Array.flatMap(status => ['--status', status])),
    Option.getOrElse(() => ['-a']),
    statusArgs => dockerCompose(projectName, 'ps', '-q', ...statusArgs),
    runForString,
    Effect.map(String.split('\n')),
    Effect.map(Array.map(String.trim)),
    Effect.map(Array.filter(String.isNonEmpty)),
  );

const getEntityWithLabel = (entity: 'volume' | 'container') => (label: string) => Command
  .make('docker', entity, 'ls', '--filter', `label=${label}`, '-q',)
  .pipe(
    Command.lines,
    Effect.tap(Effect.logDebug),
    Effect.map(Array.map(String.trim)),
    Effect.map(Array.filter(String.isNonEmpty)),
  );
export const getVolumeNamesWithLabel: (
  label: string
) => Effect.Effect<string[], PlatformError, CommandExecutor> = getEntityWithLabel('volume');
export const getContainerNamesWithLabel: (
  label: string
) => Effect.Effect<string[], PlatformError, CommandExecutor> = getEntityWithLabel('container');

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
export const getContainerLabelValue = (labelName: string) => (
  container: string,
): Effect.Effect<string, PlatformError, CommandExecutor> => Command
  .make('docker', 'container', 'inspect', container, '--format', `'{{ index .Config.Labels "${labelName}" }}'`)
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

const getEnvParams = (env?: Record<string, string>) => pipe(
  Option.fromNullable(env),
  Option.map(envMap => Object.entries(envMap)),
  Option.map(Array.map(([key, value]) => ['--env', `${key}=${value}`])),
  Option.map(Array.flatten),
  Option.getOrElse(() => [] as string[]),
);

const getPortParams = (ports: [number, number][]) => pipe(
  ports,
  Array.map(([host, container]) => ['--publish', `${host.toString()}:${container.toString()}`]),
  Array.flatten,
);

export const runContainer = ({ image, name, env, labels = [], ports = [] }: {
  image: string,
  name: string,
  labels?: string[],
  ports?: [host: number, container: number][],
  env?: Record<string, string>,
}): Effect.Effect<void, Error | PlatformError, CommandExecutor> => pipe(
  Array.make(
    'docker',
    'run',
    '--detach',
    '--restart',
    'always',
    `--name`,
    name,
  ),
  Array.appendAll(labels.flatMap(label => ['--label', label])),
  Array.appendAll(getEnvParams(env)),
  Array.appendAll(getPortParams(ports)),
  Array.append(image),
  ([command, ...args]) => Command.make(command, ...args),
  runForExitCode
);

export const doesContainerExist = (
  containerName: string
): Effect.Effect<boolean, PlatformError, CommandExecutor> => Command
  .make('docker', 'container', 'ls', '-q', '--filter', `name=${containerName}`)
  .pipe(
    runForString,
    Effect.map(String.isNonEmpty),
  )

export const rmContainer = (name: string): Effect.Effect<void, Error | PlatformError, CommandExecutor> => Command
  .make('docker', 'rm', '-f', name)
  .pipe(runForExitCode);
