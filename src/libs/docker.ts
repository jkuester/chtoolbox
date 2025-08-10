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

const printCommandWhenDebugLogging = Effect.fn((command: Command.Command) => Effect
  .succeed(command)
  .pipe(
    Effect.filterEffectOrElse({
      predicate: () => debugLoggingEnabled.pipe(Effect.map(Boolean.not)),
      orElse: () => Effect.succeed(command.pipe(
        Command.stdout('inherit'),
        Command.stderr('inherit'),
      ))
    }),
  ));

const runForExitCode = Effect.fn((command: Command.Command) => printCommandWhenDebugLogging(command)
  .pipe(
    Effect.flatMap(command => command.pipe(Command.exitCode)),
    Effect.filterOrFail(
      exitCode => exitCode === 0,
      exitCode => new Error(`Docker command failed. Exit code: ${exitCode.toString()}`)
    )
  ));

const runForString = Effect.fn((command: Command.Command) => command.pipe(
  Command.string,
  Effect.tap(Effect.logDebug),
  Effect.map(String.trim),
));

export const pullImage = Effect.fn((image: string) => Command
  .make('docker', 'pull', image)
  .pipe(runForExitCode));

export const pullComposeImages = (
  projectName: string,
  env: Record<string, string>
): (p: string[]) => Effect.Effect<void, Error | PlatformError, CommandExecutor> => Effect.fn((composeFilePaths) => pipe(
  getComposeFileParams(composeFilePaths),
  composeFileParams => dockerCompose(projectName, ...composeFileParams, 'pull'),
  Command.env(env),
  runForExitCode,
  // Pulling all the images at once can result in rate limiting
  Effect.retry({ schedule: Schedule.spaced(2000) }),
));

type DockerContainerStatus = 'running' | 'exited' | 'created' | 'paused' | 'restarting' | 'removing' | 'dead';

export const getContainersForComposeProject = Effect.fn((
  projectName: string,
  ...statuses: DockerContainerStatus[]
) => Option
  .liftPredicate(statuses, Array.isNonEmptyArray)
  .pipe(
    Option.map(Array.flatMap(status => ['--status', status])),
    Option.getOrElse(() => ['-a']),
    statusArgs => dockerCompose(projectName, 'ps', '-q', ...statusArgs),
    runForString,
    Effect.map(String.split('\n')),
    Effect.map(Array.map(String.trim)),
    Effect.map(Array.filter(String.isNonEmpty)),
  ));

const getEntityWithLabel = (entity: 'volume' | 'container') => Effect.fn((label: string) => Command
  .make('docker', entity, 'ls', '--filter', `label=${label}`, '-q',)
  .pipe(
    Command.lines,
    Effect.tap(Effect.logDebug),
    Effect.map(Array.map(String.trim)),
    Effect.map(Array.filter(String.isNonEmpty)),
  ));
export const getVolumeNamesWithLabel: (
  label: string
) => Effect.Effect<string[], PlatformError, CommandExecutor> = getEntityWithLabel('volume');
export const getContainerNamesWithLabel: (
  label: string
) => Effect.Effect<string[], PlatformError, CommandExecutor> = getEntityWithLabel('container');

export const doesVolumeExistWithLabel = Effect.fn((
  label: string
) => getVolumeNamesWithLabel(label)
  .pipe(Effect.map(Array.isNonEmptyArray)));

export const getVolumeLabelValue = (
  labelName: string
): (v: string) => Effect.Effect<string, PlatformError, CommandExecutor> => Effect.fn((
  volumeName: string,
) => Command
  .make('docker', 'volume', 'inspect', volumeName, '--format', `'{{ index .Labels "${labelName}" }}'`)
  .pipe(
    runForString,
    Effect.map(String.slice(1, -1)),
  ));
export const getContainerLabelValue = (
  labelName: string
): (c: string) => Effect.Effect<string, PlatformError, CommandExecutor> => Effect.fn((
  container: string,
) => Command
  .make('docker', 'container', 'inspect', container, '--format', `'{{ index .Config.Labels "${labelName}" }}'`)
  .pipe(
    runForString,
    Effect.map(String.slice(1, -1)),
  ));

export const createComposeContainers = (
  env: Record<string, string>,
  ...composeFilePaths: string[]
): (projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor> => Effect.fn(
  (projectName) => pipe(
    getComposeFileParams(composeFilePaths),
    composeFileParams => dockerCompose(projectName, ...composeFileParams, 'create'),
    Command.env(env),
    runForExitCode,
  )
);

export const copyFileToComposeContainer = (
  projectName: string,
  containerServiceName: string,
): (
  [hostFilePath, containerFilePath]: [string, string]
) => Effect.Effect<void, Error | PlatformError, CommandExecutor> => Effect.fn((
  [hostFilePath, containerFilePath]
) => pipe(
  `${containerServiceName}:${containerFilePath}`,
  containerPath => dockerCompose(projectName, 'cp', hostFilePath, containerPath),
  runForExitCode
));

export const copyFileFromComposeContainer = (
  containerServiceName: string,
  containerFilePath: string,
  hostFilePath: string,
): (projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor> => Effect.fn(
  (projectName) => pipe(
    `${containerServiceName}:${containerFilePath}`,
    containerPath => dockerCompose(projectName, 'cp', containerPath, hostFilePath),
    runForExitCode
  )
);

export const startCompose = Effect.fn((projectName: string) => dockerCompose(projectName, 'start')
  .pipe(runForExitCode));

export const restartCompose = Effect.fn((projectName: string) => dockerCompose(projectName, 'restart')
  .pipe(runForExitCode));

export const restartComposeService = Effect.fn((
  projectName: string,
  serviceName: string,
) => dockerCompose(projectName, 'restart', serviceName)
  .pipe(runForExitCode));

export const stopCompose = Effect.fn((projectName: string) => dockerCompose(projectName, 'stop')
  .pipe(runForExitCode));

export const destroyCompose = Effect.fn((
  projectName: string,
) => dockerCompose(projectName, 'kill')
  .pipe(
    runForExitCode,
    Effect.andThen(dockerCompose(projectName, 'down', '-v')
      .pipe(runForExitCode)),
  ));

export const rmComposeContainer = (
  serviceName: string
): (projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor> => Effect.fn((
  projectName: string
) => dockerCompose(projectName, 'rm', '-f', serviceName)
  .pipe(runForExitCode));

export const getEnvarFromComposeContainer = Effect.fn((
  containerServiceName: string,
  envar: string,
  projectName: string
) => dockerCompose(projectName, 'exec', containerServiceName, 'printenv', envar)
  .pipe(runForString));

const getEnvParams = (env?: Record<string, string>) => pipe(
  Option.fromNullable(env),
  Option.map(envMap => Object.entries(envMap)),
  Option.map(Array.map(([key, value]) => ['--env', `${key}=${value}`])),
  Option.map(Array.flatten),
  Option.getOrElse(() => [] as string[]),
);

const getPortParams = (ports: readonly (readonly [number, number])[]) => pipe(
  ports,
  Array.map(([host, container]) => ['--publish', `${host.toString()}:${container.toString()}`]),
  Array.flatten,
);

export const runContainer = Effect.fn(({ image, name, env, labels = [], ports = [] }: {
  image: string,
  name: string,
  labels?: readonly string[],
  ports?: readonly (readonly [host: number, container: number])[],
  env?: Record<string, string>,
}) => pipe(
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
));

export const doesContainerExist = Effect.fn(
  (containerName: string) => Command.make('docker', 'container', 'ls', '-q', '--filter', `name=${containerName}`),
  runForString,
  Effect.map(String.isNonEmpty),
);

export const rmContainer = Effect.fn(
  (name: string) => Command.make('docker', 'rm', '-f', name),
  runForExitCode
);
