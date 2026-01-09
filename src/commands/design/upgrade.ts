import { Args, Command, Options, Prompt } from '@effect/cli';
import { Array, Console, DateTime, Effect, pipe, Predicate, Schedule, Stream } from 'effect';

import { clearConsoleEffect, clearThen } from '../../libs/console.ts';
import { UpgradeService } from '../../services/upgrade.ts';
import { type CouchActiveTaskStream, getDisplayDictByPid } from '../../libs/couch/active-tasks.ts';
import { getTaskDisplayData } from '../db/compact.ts';

const getCurrentTime = () => DateTime
  .unsafeNow()
  .pipe(DateTime.formatLocal({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));

const streamActiveTasks = Effect.fn((
  taskStream: CouchActiveTaskStream
) => taskStream.pipe(
  Stream.map(Array.map(getTaskDisplayData)),
  Stream.map(getDisplayDictByPid),
  Stream.tapError(e => Effect.logError(`${JSON.stringify(e, null, 2)}\n\nRetrying...`)),
  Stream.retry(Schedule.spaced(5000)),
  Stream.runForEach(taskDict => clearConsoleEffect.pipe(
    Effect.tap(Console.log(`Currently indexing: [${getCurrentTime()}]`)),
    Effect.tap(Console.table(taskDict)),
  )),
  Effect.tap(clearThen(Console.log('Design doc upgrade complete.'))),
));

const getConfirmationPrompt = (version: string) => Prompt.confirm({
  message: `Are you sure you want to upgrade the CHT design documents to ${version}?`,
  initial: false,
});

const isConfirmed = (version: string, yes: boolean) => pipe(
  Effect.succeed(yes),
  Effect.filterOrElse(Predicate.isTruthy, () => getConfirmationPrompt(version)),
  Effect.filterOrFail(Predicate.isTruthy, () => ({ _tag: 'NotConfirmed' }))
);

const yes = Options
  .boolean('yes')
  .pipe(
    Options.withAlias('y'),
    Options.withDescription('Do not prompt for confirmation.'),
  );

const version = Args
  .text({ name: 'version' })
  .pipe(
    Args.withDescription('The CHT version to upgrade the design documents to'),
  );

export const upgrade = Command
  .make('upgrade', { version, yes, }, Effect.fn(({ version, yes }) => pipe(
    isConfirmed(version, yes),
    Effect.andThen(UpgradeService.upgradeDdocs(version)),
    Effect.flatMap(streamActiveTasks),
    Effect.catchTag('NotConfirmed', () => Console.log('Operation cancelled')),
  )))
  .pipe(Command.withDescription(
    `Upgrade the design documents in for the current CHT instance to those from the specified CHT version.`
  ));
