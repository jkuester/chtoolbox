import { Args, Command } from '@effect/cli';
import { Array, Console, Effect, pipe } from 'effect';
import { LocalInstanceService } from '../../services/local-instance.js';
const stopChtInstances = (names) => pipe(names, Array.map(LocalInstanceService.stop), Effect.all);
const names = Args
    .text({ name: 'name' })
    .pipe(Args.withDescription('The project name of the CHT instance to stop'), Args.atLeast(1));
export const stop = Command
    .make('stop', { names }, ({ names }) => stopChtInstances(names)
    .pipe(Effect.andThen(Console.log('CHT instance(s) stopped'))))
    .pipe(Command.withDescription(`LOCAL ONLY: Stop a local CHT instance. Data for the instance is not removed. Requires Docker and Docker Compose.`));
//# sourceMappingURL=stop.js.map