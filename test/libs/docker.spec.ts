import { Command } from '@effect/platform';
import { describe, it } from 'mocha';
import { Array, Effect, Either, Layer, Logger, LogLevel, Schedule } from 'effect';
import { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import {
  copyFileFromComposeContainer,
  copyFileToComposeContainer,
  createComposeContainers,
  destroyCompose,
  doesComposeProjectHaveContainers,
  doesVolumeExistWithLabel,
  getEnvarFromComposeContainer,
  getVolumeLabelValue,
  getVolumeNamesWithLabel,
  pullComposeImages,
  restartCompose,
  restartComposeService,
  rmComposeContainer,
  startCompose,
  stopCompose
} from '../../src/libs/docker';
import { PlatformError } from '@effect/platform/Error';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { genWithLayer } from '../utils/base';

const PROJECT_NAME = 'projectName';
const ENV = { hello: 'world' } as const;
const FAKE_COMMAND = Effect.succeed({ fake: 'command' }) as unknown as Command.Command;

const run = Layer
  .succeed(CommandExecutor, {} as unknown as CommandExecutor)
  .pipe(genWithLayer);

describe('docker libs', () => {
  let commandMake: SinonStub;
  let commandEnv: SinonStub;
  let commandExitCode: SinonStub;
  let commandString: SinonStub;
  let commandLines: SinonStub;

  beforeEach(() => {
    commandMake = sinon.stub(Command, 'make').returns(FAKE_COMMAND);
    commandEnv = sinon
      .stub(Command, 'env')
      .returns(sinon.stub().returns(FAKE_COMMAND) as unknown as Command.Command);
    commandExitCode = sinon.stub(Command, 'exitCode');
    commandString = sinon.stub(Command, 'string');
    commandLines = sinon.stub(Command, 'lines');
  });

  describe('runForExitCode', () => {
    const containerServiceName = 'containerServiceName';
    const hostFilePath = 'hostFilePath';
    const containerFilePath = 'containerFilePath';
    let commandStdout: SinonStub;
    let commandStderr: SinonStub;

    beforeEach(() => {
      commandExitCode.returns(Effect.succeed(0));
      const returnCommand = sinon.stub().returns(FAKE_COMMAND) as unknown as Command.Command;
      commandStdout = sinon
        .stub(Command, 'stdout')
        .returns(returnCommand);
      commandStderr = sinon
        .stub(Command, 'stderr')
        .returns(returnCommand);
    });

    it('pipes command to console when debug logging enabled', run(function* () {
      yield* copyFileToComposeContainer(PROJECT_NAME, containerServiceName)([hostFilePath, containerFilePath]).pipe(
        Logger.withMinimumLogLevel(LogLevel.Debug),
      );

      expect(commandMake.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, 'cp', hostFilePath, `${containerServiceName}:${containerFilePath}`
      )).to.be.true;
      expect(commandEnv.notCalled).to.be.true;
      expect(commandExitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(commandString.notCalled).to.be.true;
      expect(commandLines.notCalled).to.be.true;
      expect(commandStdout.calledOnceWithExactly('inherit')).to.be.true;
      expect(commandStderr.calledOnceWithExactly('inherit')).to.be.true;
    }));

    it('does not print command output to console when debug logging disabled', run(function* () {
      yield* copyFileToComposeContainer(PROJECT_NAME, containerServiceName)([hostFilePath, containerFilePath]).pipe(
        Logger.withMinimumLogLevel(LogLevel.Info),
      );

      expect(commandMake.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, 'cp', hostFilePath, `${containerServiceName}:${containerFilePath}`
      )).to.be.true;
      expect(commandEnv.notCalled).to.be.true;
      expect(commandExitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(commandString.notCalled).to.be.true;
      expect(commandLines.notCalled).to.be.true;
      expect(commandStdout.notCalled).to.be.true;
      expect(commandStderr.notCalled).to.be.true;
    }));
  });

  describe('pullComposeImages', () => {
    const composeFilePaths = ['path1', 'path2'];

    it('pulls images for the given compose files', run(function* () {
      commandExitCode.returns(Effect.succeed(0));

      yield* pullComposeImages(PROJECT_NAME, ENV)(composeFilePaths);

      expect(commandMake.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, '-f', 'path1', '-f', 'path2', 'pull'
      )).to.be.true;
      expect(commandEnv.calledOnceWithExactly(ENV)).to.be.true;
      expect(commandExitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(commandString.notCalled).to.be.true;
      expect(commandLines.notCalled).to.be.true;
    }));

    it('retries when error code returned for pulling images', run(function* () {
      commandExitCode.onFirstCall().returns(Effect.succeed(1));
      commandExitCode.onSecondCall().returns(Effect.succeed(0));
      const scheduleSpaced = sinon
        .stub(Schedule, 'spaced')
        .returns(Schedule.forever); // Avoid waiting in tests

      yield* pullComposeImages(PROJECT_NAME, ENV)(composeFilePaths);

      expect(commandMake.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, '-f', 'path1', '-f', 'path2', 'pull'
      )).to.be.true;
      expect(commandEnv.calledOnceWithExactly(ENV)).to.be.true;
      expect(commandExitCode.args).to.deep.equal([[FAKE_COMMAND], [FAKE_COMMAND]]);
      expect(commandString.notCalled).to.be.true;
      expect(commandLines.notCalled).to.be.true;
      expect(scheduleSpaced.calledOnceWithExactly(2000)).to.be.true;
    }));
  });

  [
    ['hello', true],
    ['', false],
    ['   ', false]
  ].forEach(([output, expected]) => {
    it('doesComposeProjectHaveContainers', run(function* () {
      commandString.returns(Effect.succeed(output));

      const result = yield* doesComposeProjectHaveContainers(PROJECT_NAME);

      expect(result).to.equal(expected);
      expect(commandMake.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, 'ps', '-qa'
      )).to.be.true;
      expect(commandEnv.notCalled).to.be.true;
      expect(commandExitCode.notCalled).to.be.true;
      expect(commandString.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(commandLines.notCalled).to.be.true;
    }));
  });

  it('getVolumeNamesWithLabel', run(function* () {
    const volumeNames = ['volume1', 'volume2'];
    commandLines.returns(Effect.succeed(['', '   ', ...volumeNames]));
    const label = 'mylabel';

    const result = yield* getVolumeNamesWithLabel(label);

    expect(result).to.deep.equal(volumeNames);
    expect(commandMake.calledOnceWithExactly(
      'docker', 'volume', 'ls', '--filter', `label=${label}`, '-q'
    )).to.be.true;
    expect(commandEnv.notCalled).to.be.true;
    expect(commandExitCode.notCalled).to.be.true;
    expect(commandString.notCalled).to.be.true;
    expect(commandLines.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
  }));

  [
    [['volume1', 'volume2'], true],
    [['volume1'], true],
    [[], false],
  ].forEach(([output, expected]) => {
    it('doesVolumeExistWithLabel', run(function* () {
      commandLines.returns(Effect.succeed(output));
      const label = 'mylabel';

      const result = yield* doesVolumeExistWithLabel(label);

      expect(result).to.equal(expected);
      expect(commandMake.calledOnceWithExactly(
        'docker', 'volume', 'ls', '--filter', `label=${label}`, '-q'
      )).to.be.true;
      expect(commandEnv.notCalled).to.be.true;
      expect(commandExitCode.notCalled).to.be.true;
      expect(commandString.notCalled).to.be.true;
      expect(commandLines.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    }));
  });

  [
    [`'output'`, 'output'],
    ['', ''],
    ['   ', ''],
  ].forEach(([output, expected]) => {
    it('getVolumeLabelValue', run(function* () {
      commandString.returns(Effect.succeed(output));
      const label = 'mylabel';
      const volumeName = 'volumeName';

      const result = yield* getVolumeLabelValue(label)(volumeName);

      expect(result).to.equal(expected);
      expect(commandMake.calledOnceWithExactly(
        'docker', 'volume', 'inspect', volumeName, '--format', `'{{ index .Labels "${label}" }}'`
      )).to.be.true;
      expect(commandEnv.notCalled).to.be.true;
      expect(commandExitCode.notCalled).to.be.true;
      expect(commandString.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(commandLines.notCalled).to.be.true;
    }));
  });

  it('createComposeContainers', run(function* () {
    const composeFilePaths = ['path1', 'path2'];
    commandExitCode.returns(Effect.succeed(0));

    yield* createComposeContainers(ENV, ...composeFilePaths)(PROJECT_NAME);

    expect(commandMake.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, '-f', 'path1', '-f', 'path2', 'create'
    )).to.be.true;
    expect(commandEnv.calledOnceWithExactly(ENV)).to.be.true;
    expect(commandExitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(commandString.notCalled).to.be.true;
    expect(commandLines.notCalled).to.be.true;
  }));

  it('copyFileToComposeContainer', run(function* () {
    commandExitCode.returns(Effect.succeed(0));
    const containerServiceName = 'containerServiceName';
    const hostFilePath = 'hostFilePath';
    const containerFilePath = 'containerFilePath';

    yield* copyFileToComposeContainer(PROJECT_NAME, containerServiceName)([hostFilePath, containerFilePath]);

    expect(commandMake.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'cp', hostFilePath, `${containerServiceName}:${containerFilePath}`
    )).to.be.true;
    expect(commandEnv.notCalled).to.be.true;
    expect(commandExitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(commandString.notCalled).to.be.true;
    expect(commandLines.notCalled).to.be.true;
  }));

  it('copyFileFromComposeContainer', run(function* () {
    commandExitCode.returns(Effect.succeed(0));
    const containerServiceName = 'containerServiceName';
    const hostFilePath = 'hostFilePath';
    const containerFilePath = 'containerFilePath';

    yield* copyFileFromComposeContainer(containerServiceName, containerFilePath, hostFilePath)(PROJECT_NAME);

    expect(commandMake.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'cp', `${containerServiceName}:${containerFilePath}`, hostFilePath
    )).to.be.true;
    expect(commandEnv.notCalled).to.be.true;
    expect(commandExitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(commandString.notCalled).to.be.true;
    expect(commandLines.notCalled).to.be.true;
  }));

  ([
    [startCompose, 'start'],
    [restartCompose, 'restart'],
    [stopCompose, 'stop'],
  ] as [(projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>, string][]).forEach((
    [fn, command]
  ) => {
    it(`${command}Compose`, run(function* () {
      commandExitCode.returns(Effect.succeed(0));

      yield* fn(PROJECT_NAME);

      expect(commandMake.calledOnceWithExactly(
        'docker', 'compose', '-p', PROJECT_NAME, command,
      )).to.be.true;
      expect(commandEnv.notCalled).to.be.true;
      expect(commandExitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
      expect(commandString.notCalled).to.be.true;
      expect(commandLines.notCalled).to.be.true;
    }));
  });

  it('restartComposeService', run(function* () {
    commandExitCode.returns(Effect.succeed(0));
    const containerServiceName = 'containerServiceName';

    yield* restartComposeService(PROJECT_NAME, containerServiceName);

    expect(commandMake.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'restart', containerServiceName
    )).to.be.true;
    expect(commandEnv.notCalled).to.be.true;
    expect(commandExitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(commandString.notCalled).to.be.true;
    expect(commandLines.notCalled).to.be.true;
  }));

  it('destroyCompose', run(function* () {
    commandExitCode.returns(Effect.succeed(0));

    yield* destroyCompose(PROJECT_NAME);

    expect(commandMake.calledTwice).to.be.true;
    expect(commandMake.firstCall.calledWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'kill'
    )).to.be.true;
    expect(commandMake.secondCall.calledWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'down', '-v'
    )).to.be.true;
    expect(commandEnv.notCalled).to.be.true;
    expect(commandExitCode.args).to.deep.equal([[FAKE_COMMAND], [FAKE_COMMAND]]);
    expect(commandString.notCalled).to.be.true;
    expect(commandLines.notCalled).to.be.true;
  }));

  it('rmComposeContainer', run(function* () {
    commandExitCode.returns(Effect.succeed(0));
    const containerServiceName = 'containerServiceName';

    yield* rmComposeContainer(containerServiceName)(PROJECT_NAME);

    expect(commandMake.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'rm', '-f', containerServiceName
    )).to.be.true;
    expect(commandEnv.notCalled).to.be.true;
    expect(commandExitCode.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(commandString.notCalled).to.be.true;
    expect(commandLines.notCalled).to.be.true;
  }));

  it('getEnvarFromComposeContainer', run(function* () {
    const output = '12345';
    commandString.returns(Effect.succeed(output));
    const envar = 'HTTPS_PORT';
    const containerServiceName = 'containerServiceName';

    const result = yield* getEnvarFromComposeContainer(containerServiceName, envar)(PROJECT_NAME);

    expect(result).to.equal(output);
    expect(commandMake.calledOnceWithExactly(
      'docker', 'compose', '-p', PROJECT_NAME, 'exec', containerServiceName, 'printenv', envar
    )).to.be.true;
    expect(commandEnv.notCalled).to.be.true;
    expect(commandExitCode.notCalled).to.be.true;
    expect(commandString.calledOnceWithExactly(FAKE_COMMAND)).to.be.true;
    expect(commandLines.notCalled).to.be.true;
  }));
});
