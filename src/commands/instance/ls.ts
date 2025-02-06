import { Args, Command } from '@effect/cli';
import { Array, Console, Effect, Match, Option, pipe, Record, Redacted } from 'effect';
import { LocalChtInstance, LocalInstanceService } from '../../services/local-instance.js';
import { getLocalIpUrl, getLocalIpUrlBasicAuth } from '../../libs/local-network.js';

const filterInstances = (names: string[]) => Match
  .value(Array.isEmptyArray(names))
  .pipe(
    Match.when(true, () => () => true),
    Match.orElse(() => ({ name }: LocalChtInstance) => names.includes(name)),
  )

const getPrintableInstanceInfo = (instance: LocalChtInstance) => ({
  name: instance.name,
  credentials: `${instance.username}:${Redacted.value(instance.password)}`,
  url: instance.port.pipe(
    Option.map(getLocalIpUrl),
    Option.getOrElse(() => ''),
  ),
});

const buildDictByName = (dict: Record<string, Record<string, string>>, instance: LocalChtInstance) => pipe(
  getPrintableInstanceInfo(instance),
  ({ name, ...info }) => pipe(
    dict,
    Record.set(name, info),
  ),
);
const getInstanceDisplayDictByName = (instances: LocalChtInstance[]) => Array.reduce(instances, {}, buildDictByName);

export const printInstanceTable = (instances: LocalChtInstance[]): Effect.Effect<void> => Match
  .value(Array.isEmptyArray(instances))
  .pipe(
    Match.when(true, () => Console.log('No instances found')),
    Match.orElse(() => pipe(
      getInstanceDisplayDictByName(instances),
      Console.table,
    )),
  );

const printUrls = (instances: LocalChtInstance[]) => pipe(
  instances,
  Array.map(getLocalIpUrlBasicAuth),
  Array.map(Option.map(Console.log)),
  Array.map(Option.getOrElse(() => Effect.void)),
  Effect.all,
);

const print = (names: string[]) => Match
  .value(Array.isEmptyArray(names))
  .pipe(
    Match.when(true, () => printInstanceTable),
    Match.orElse(() => (instances: LocalChtInstance[]) => pipe(
      instances,
      Array.filter(filterInstances(names)),
      printUrls,
    )),
  );

const names = Args
  .text({ name: 'name' })
  .pipe(
    Args.withDescription('The name of the instance'),
    Args.atLeast(0),
  );

export const ls = Command
  .make('ls', { names }, ({ names }) => LocalInstanceService
    .ls()
    .pipe(Effect.flatMap(print(names))))
  .pipe(Command.withDescription(
    `LOCAL ONLY: List the local CHT instances and their URLs. Requires Docker and Docker Compose.`
  ));
