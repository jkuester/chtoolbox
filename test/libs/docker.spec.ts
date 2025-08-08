import { Command } from '@effect/platform';
import { describe, it } from 'mocha';
import { Effect, Layer, Logger, LogLevel, Schedule } from 'effect';
import { expect } from 'chai';
import sinon from 'sinon';
import * as DockerLibs from '../../src/libs/docker.ts';
import { PlatformError } from '@effect/platform/Error';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { genWithLayer, sandbox } from '../utils/base.ts';
import esmock from 'esmock';

const PROJECT_NAME = 'projectName';
const ENV = { hello: 'world' } as const;
const FAKE_COMMAND = Effect.succeed({ fake: 'command' }) as unknown as Command.Command;
const mockCommand = {
  make: sandbox.stub(),
  env: sandbox.stub(),
  exitCode: sandbox.stub(),
  string: sandbox.stub(),
  lines: sandbox.stub(),
  stdout: sandbox.stub(),
  stderr: sandbox.stub(),
};
const mockSchedule = { spaced: sandbox.stub() };

const run = Layer
  .succeed(CommandExecutor, {} as unknown as CommandExecutor)
  .pipe(genWithLayer);
const {
  copyFileFromComposeContainer,
  copyFileToComposeContainer,
  createComposeContainers,
  destroyCompose,
  getContainersForComposeProject,
  doesVolumeExistWithLabel,
  getEnvarFromComposeContainer,
  getVolumeLabelValue,
  getContainerLabelValue,
  getVolumeNamesWithLabel,
  getContainerNamesWithLabel,
  pullImage,
  pullComposeImages,
  restartCompose,
  restartComposeService,
  rmComposeContainer,
  startCompose,
  stopCompose,
  runContainer,
  doesContainerExist,
  rmContainer
} = await esmock<typeof DockerLibs>('../../src/libs/docker.ts', {
  '@effect/platform': { Command: mockCommand },
  'effect': { Schedule: mockSchedule },
});

describe('docker libs', () => {
  beforeEach(() => {
    mockCommand.make.returns(FAKE_COMMAND);
    mockCommand.env.returns(sinon.stub().returns(FAKE_COMMAND) as unknown as Command.Command);
  });

  describe('runForExitCode', () => {
    const containerServiceName = 'containerServiceName';
    const hostFilePath = 'hostFilePath';
    const containerFilePath = 'containerFilePath';

    beforeEach(() => {
      mockCommand.exitCode.returns(Effect.succeed(0));
      const returnCommand = sinon.stub().returns(FAKE_COMMAND) as unknown as Command.Command;
      mockCommand.stdout.returns(returnCommand);
      mockCommand.stderr.returns(returnCommand);
    });

    it('pipes command to console when debug logging enabled', run(function* () {
      yield* copyFileToComposeContainer(PROJECT_NAME, containerServiceName)([hostFilePath, containerFilePath]).pipe(
        Logger.withMinimumLogLevel(LogLevel.Debug),
      );

      expect(mockCommand.make.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, 'cp', hostFilePath, `${containerServiceName}:${containerFilePath}`
      )).to.be.true;
      expect(mockCommand.env.notCalled).to.be.true;
      expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(mockCommand.string.notCalled).to.be.true;
      expect(mockCommand.lines.notCalled).to.be.true;
      expect(mockCommand.stdout.calledOnceWithExactly('inherit')).to.be.true;
      expect(mockCommand.stderr.calledOnceWithExactly('inherit')).to.be.true;
    }));

    it('does not print command output to console when debug logging disabled', run(function* () {
      yield* copyFileToComposeContainer(PROJECT_NAME, containerServiceName)([hostFilePath, containerFilePath]).pipe(
        Logger.withMinimumLogLevel(LogLevel.Info),
      );

      expect(mockCommand.make.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, 'cp', hostFilePath, `${containerServiceName}:${containerFilePath}`
      )).to.be.true;
      expect(mockCommand.env.notCalled).to.be.true;
      expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(mockCommand.string.notCalled).to.be.true;
      expect(mockCommand.lines.notCalled).to.be.true;
      expect(mockCommand.stdout.notCalled).to.be.true;
      expect(mockCommand.stderr.notCalled).to.be.true;
    }));
  });

  it('pullImage', run(function* () {
    mockCommand.exitCode.returns(Effect.succeed(0));

    yield* pullImage(PROJECT_NAME);

    expect(mockCommand.make.calledOnceWithExactly('docker', 'pull', PROJECT_NAME,)).to.be.true;
    expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(mockCommand.string.notCalled).to.be.true;
    expect(mockCommand.lines.notCalled).to.be.true;
  }));

  describe('pullComposeImages', () => {
    const composeFilePaths = ['path1', 'path2'];

    it('pulls images for the given compose files', run(function* () {
      mockCommand.exitCode.returns(Effect.succeed(0));

      yield* pullComposeImages(PROJECT_NAME, ENV)(composeFilePaths);

      expect(mockCommand.make.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, '-f', 'path1', '-f', 'path2', 'pull'
      )).to.be.true;
      expect(mockCommand.env.calledOnceWithExactly(ENV)).to.be.true;
      expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(mockCommand.string.notCalled).to.be.true;
      expect(mockCommand.lines.notCalled).to.be.true;
    }));

    it('retries when error code returned for pulling images', run(function* () {
      mockCommand.exitCode.onFirstCall().returns(Effect.succeed(1));
      mockCommand.exitCode.onSecondCall().returns(Effect.succeed(0));
      mockSchedule.spaced.returns(Schedule.forever); // Avoid waiting in tests

      yield* pullComposeImages(PROJECT_NAME, ENV)(composeFilePaths);

      expect(mockCommand.make.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, '-f', 'path1', '-f', 'path2', 'pull'
      )).to.be.true;
      expect(mockCommand.env.calledOnceWithExactly(ENV)).to.be.true;
      expect(mockCommand.exitCode.args).to.deep.equal([[FAKE_COMMAND], [FAKE_COMMAND]]);
      expect(mockCommand.string.notCalled).to.be.true;
      expect(mockCommand.lines.notCalled).to.be.true;
      expect(mockSchedule.spaced.calledOnceWithExactly(2000)).to.be.true;
    }));
  });

  describe('getContainersForComposeProject', () => {
    [
      ['c0\nc1\nc2', ['c0', 'c1', 'c2']],
      ['', []],
      ['c0  \n  c1\n    c2    \n   \n\n', ['c0', 'c1', 'c2']],
    ].forEach(([output, expected]) => {
      it('returns all containers for the compose project when no statuses are provided', run(function* () {
        mockCommand.string.returns(Effect.succeed(output));

        const result = yield* getContainersForComposeProject(PROJECT_NAME);

        expect(result).to.deep.equal(expected);
        expect(mockCommand.make.calledOnceWithExactly(
          'docker', 'compose', '-p', PROJECT_NAME, 'ps', '-q', '-a'
        )).to.be.true;
        expect(mockCommand.env.notCalled).to.be.true;
        expect(mockCommand.exitCode.notCalled).to.be.true;
        expect(mockCommand.string.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
        expect(mockCommand.lines.notCalled).to.be.true;
      }));
    });

    it('returns the compose containers for the given statuses', run(function* () {
      const output = 'container';
      mockCommand.string.returns(Effect.succeed(output));

      const result = yield* getContainersForComposeProject(PROJECT_NAME, 'running', 'exited');

      expect(result).to.deep.equal([output]);
      expect(mockCommand.make.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, 'ps', '-q', '--status', 'running', '--status', 'exited'
      )).to.be.true;
      expect(mockCommand.env.notCalled).to.be.true;
      expect(mockCommand.exitCode.notCalled).to.be.true;
      expect(mockCommand.string.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(mockCommand.lines.notCalled).to.be.true;
    }));
  });

  ([
    ['getVolumeNamesWithLabel', getVolumeNamesWithLabel, 'volume'],
    ['getContainerNamesWithLabel', getContainerNamesWithLabel, 'container'],
  ] as [string, (label: string) => Effect.Effect<string[], PlatformError, CommandExecutor>, string][]).forEach((
    [test, fn, entity]
  ) => {
    it(test, run(function* () {
      const entityNames = ['volume1', 'volume2'];
      mockCommand.lines.returns(Effect.succeed(['', '   ', ...entityNames]));
      const label = 'mylabel';

      const result = yield* fn(label);

      expect(result).to.deep.equal(entityNames);
      expect(mockCommand.make.calledOnceWithExactly(
        'docker', entity, 'ls', '--filter', `label=${label}`, '-q'
      )).to.be.true;
      expect(mockCommand.env.notCalled).to.be.true;
      expect(mockCommand.exitCode.notCalled).to.be.true;
      expect(mockCommand.string.notCalled).to.be.true;
      expect(mockCommand.lines.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    }));
  });

  [
    [['volume1', 'volume2'], true],
    [['volume1'], true],
    [[], false],
  ].forEach(([output, expected]) => {
    it('doesVolumeExistWithLabel', run(function* () {
      mockCommand.lines.returns(Effect.succeed(output));
      const label = 'mylabel';

      const result = yield* doesVolumeExistWithLabel(label);

      expect(result).to.equal(expected);
      expect(mockCommand.make.calledOnceWithExactly(
        'docker', 'volume', 'ls', '--filter', `label=${label}`, '-q'
      )).to.be.true;
      expect(mockCommand.env.notCalled).to.be.true;
      expect(mockCommand.exitCode.notCalled).to.be.true;
      expect(mockCommand.string.notCalled).to.be.true;
      expect(mockCommand.lines.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    }));
  });

  ([
    ['getVolumeLabelValue', getVolumeLabelValue, 'volume', '.Labels'],
    ['getContainerLabelValue', getContainerLabelValue, 'container', '.Config.Labels'],
  ] as [
    string,
    (labelName: string) => (name: string) => Effect.Effect<string, PlatformError, CommandExecutor>,
    string,
    string
  ][]).forEach(([test, fn, entity, labelPath]) => {
    [
      [`'output'`, 'output'],
      ['', ''],
      ['   ', ''],
    ].forEach(([output, expected]) => {
      it(test, run(function* () {
        mockCommand.string.returns(Effect.succeed(output));
        const label = 'mylabel';
        const volumeName = 'volumeName';

        const result = yield* fn(label)(volumeName);

        expect(result).to.equal(expected);
        expect(mockCommand.make.calledOnceWithExactly(
          'docker', entity, 'inspect', volumeName, '--format', `'{{ index ${labelPath} "${label}" }}'`
        )).to.be.true;
        expect(mockCommand.env.notCalled).to.be.true;
        expect(mockCommand.exitCode.notCalled).to.be.true;
        expect(mockCommand.string.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
        expect(mockCommand.lines.notCalled).to.be.true;
      }));
    });
  });

  it('createComposeContainers', run(function* () {
    const composeFilePaths = ['path1', 'path2'];
    mockCommand.exitCode.returns(Effect.succeed(0));

    yield* createComposeContainers(ENV, ...composeFilePaths)(PROJECT_NAME);

    expect(mockCommand.make.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, '-f', 'path1', '-f', 'path2', 'create'
    )).to.be.true;
    expect(mockCommand.env.calledOnceWithExactly(ENV)).to.be.true;
    expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(mockCommand.string.notCalled).to.be.true;
    expect(mockCommand.lines.notCalled).to.be.true;
  }));

  it('copyFileToComposeContainer', run(function* () {
    mockCommand.exitCode.returns(Effect.succeed(0));
    const containerServiceName = 'containerServiceName';
    const hostFilePath = 'hostFilePath';
    const containerFilePath = 'containerFilePath';

    yield* copyFileToComposeContainer(PROJECT_NAME, containerServiceName)([hostFilePath, containerFilePath]);

    expect(mockCommand.make.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'cp', hostFilePath, `${containerServiceName}:${containerFilePath}`
    )).to.be.true;
    expect(mockCommand.env.notCalled).to.be.true;
    expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(mockCommand.string.notCalled).to.be.true;
    expect(mockCommand.lines.notCalled).to.be.true;
  }));

  it('copyFileFromComposeContainer', run(function* () {
    mockCommand.exitCode.returns(Effect.succeed(0));
    const containerServiceName = 'containerServiceName';
    const hostFilePath = 'hostFilePath';
    const containerFilePath = 'containerFilePath';

    yield* copyFileFromComposeContainer(containerServiceName, containerFilePath, hostFilePath)(PROJECT_NAME);

    expect(mockCommand.make.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'cp', `${containerServiceName}:${containerFilePath}`, hostFilePath
    )).to.be.true;
    expect(mockCommand.env.notCalled).to.be.true;
    expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(mockCommand.string.notCalled).to.be.true;
    expect(mockCommand.lines.notCalled).to.be.true;
  }));

  ([
    [startCompose, 'start'],
    [restartCompose, 'restart'],
    [stopCompose, 'stop'],
  ] as [(projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>, string][]).forEach((
    [fn, command]
  ) => {
    it(`${command}Compose`, run(function* () {
      mockCommand.exitCode.returns(Effect.succeed(0));

      yield* fn(PROJECT_NAME);

      expect(mockCommand.make.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, command,
      )).to.be.true;
      expect(mockCommand.env.notCalled).to.be.true;
      expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(mockCommand.string.notCalled).to.be.true;
      expect(mockCommand.lines.notCalled).to.be.true;
    }));
  });

  it('restartComposeService', run(function* () {
    mockCommand.exitCode.returns(Effect.succeed(0));
    const containerServiceName = 'containerServiceName';

    yield* restartComposeService(PROJECT_NAME, containerServiceName);

    expect(mockCommand.make.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'restart', containerServiceName
    )).to.be.true;
    expect(mockCommand.env.notCalled).to.be.true;
    expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(mockCommand.string.notCalled).to.be.true;
    expect(mockCommand.lines.notCalled).to.be.true;
  }));

  it('destroyCompose', run(function* () {
    mockCommand.exitCode.returns(Effect.succeed(0));

    yield* destroyCompose(PROJECT_NAME);

    expect(mockCommand.make.calledTwice).to.be.true;
    expect(mockCommand.make.firstCall.calledWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'kill'
    )).to.be.true;
    expect(mockCommand.make.secondCall.calledWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'down', '-v'
    )).to.be.true;
    expect(mockCommand.env.notCalled).to.be.true;
    expect(mockCommand.exitCode.args).to.deep.equal([[FAKE_COMMAND], [FAKE_COMMAND]]);
    expect(mockCommand.string.notCalled).to.be.true;
    expect(mockCommand.lines.notCalled).to.be.true;
  }));

  it('rmComposeContainer', run(function* () {
    mockCommand.exitCode.returns(Effect.succeed(0));
    const containerServiceName = 'containerServiceName';

    yield* rmComposeContainer(containerServiceName)(PROJECT_NAME);

    expect(mockCommand.make.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'rm', '-f', containerServiceName
    )).to.be.true;
    expect(mockCommand.env.notCalled).to.be.true;
    expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(mockCommand.string.notCalled).to.be.true;
    expect(mockCommand.lines.notCalled).to.be.true;
  }));

  it('getEnvarFromComposeContainer', run(function* () {
    const output = '12345';
    mockCommand.string.returns(Effect.succeed(output));
    const envar = 'HTTPS_PORT';
    const containerServiceName = 'containerServiceName';

    const result = yield* getEnvarFromComposeContainer(containerServiceName, envar, PROJECT_NAME);

    expect(result).to.equal(output);
    expect(mockCommand.make.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'exec', containerServiceName, 'printenv', envar
    )).to.be.true;
    expect(mockCommand.env.notCalled).to.be.true;
    expect(mockCommand.exitCode.notCalled).to.be.true;
    expect(mockCommand.string.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(mockCommand.lines.notCalled).to.be.true;
  }));

  describe('runContainer', () => {
    it('runs container with all parameters', run(function* () {
      mockCommand.exitCode.returns(Effect.succeed(0));
      const opts = {
        image: 'my-image',
        name: 'my-container',
        labels: ['label1=value1', 'label2=value2'],
        ports: [[8080, 80], [443, 443]],
        env: { VAR1: 'value1', VAR2: 'value2' },
      } as const;

      yield* runContainer(opts);

      expect(mockCommand.make.calledOnceWithExactly(
        'docker',
        'run',
        '--detach',
        '--restart',
        'always',
        `--name`,
        opts.name,
        '--label',
        opts.labels[0],
        '--label',
        opts.labels[1],
        '--env',
        `VAR1=${opts.env.VAR1}`,
        '--env',
        `VAR2=${opts.env.VAR2}`,
        '--publish',
        `${opts.ports[0][0].toString()}:${opts.ports[0][1].toString()}`,
        '--publish',
        `${opts.ports[1][0].toString()}:${opts.ports[1][1].toString()}`,
        opts.image
      )).to.be.true;
      expect(mockCommand.env.notCalled).to.be.true;
      expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(mockCommand.string.notCalled).to.be.true;
      expect(mockCommand.lines.notCalled).to.be.true;
    }));

    it('runs container with only the minimum parameters', run(function* () {
      mockCommand.exitCode.returns(Effect.succeed(0));
      const opts = {
        image: 'my-image',
        name: 'my-container',
      };

      yield* runContainer(opts);

      expect(mockCommand.make.calledOnceWithExactly(
        'docker',
        'run',
        '--detach',
        '--restart',
        'always',
        `--name`,
        opts.name,
        opts.image
      )).to.be.true;
      expect(mockCommand.env.notCalled).to.be.true;
      expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(mockCommand.string.notCalled).to.be.true;
      expect(mockCommand.lines.notCalled).to.be.true;
    }));
  });

  [
    ['hello', true],
    ['', false],
    ['   ', false]
  ].forEach(([output, expected]) => {
    it('doesContainerExist', run(function* () {
      mockCommand.string.returns(Effect.succeed(output));

      const result = yield* doesContainerExist(PROJECT_NAME);

      expect(result).to.equal(expected);
      expect(mockCommand.make.calledOnceWithExactly(
        'docker', 'container', 'ls', '-q', '--filter', `name=${PROJECT_NAME}`
      )).to.be.true;
      expect(mockCommand.env.notCalled).to.be.true;
      expect(mockCommand.exitCode.notCalled).to.be.true;
      expect(mockCommand.string.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(mockCommand.lines.notCalled).to.be.true;
    }));
  });

  it('rmContainer', run(function* () {
    mockCommand.exitCode.returns(Effect.succeed(0));

    yield* rmContainer(PROJECT_NAME);

    expect(mockCommand.make.calledOnceWithExactly(
      'docker', 'rm', '-f', PROJECT_NAME
    )).to.be.true;
    expect(mockCommand.env.notCalled).to.be.true;
    expect(mockCommand.exitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(mockCommand.string.notCalled).to.be.true;
    expect(mockCommand.lines.notCalled).to.be.true;
  }));
});
