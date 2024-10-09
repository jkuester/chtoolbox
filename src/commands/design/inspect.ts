import { Args, Command } from '@effect/cli';
import { Array, Console, Effect, pipe } from 'effect';
import { initializeUrl } from '../../index';
import { CouchDesignInfoService } from '../../services/couch/design-info';

const database = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The database to inspect'),
  );

const designs = Args
  .text({ name: 'design' })
  .pipe(
    Args.withDescription('The designs to inspect'),
    Args.atLeast(1),
  );

export const inspect = Command
  .make('inspect', { database, designs }, ({ database, designs }) => initializeUrl.pipe(
    Effect.andThen(CouchDesignInfoService),
    Effect.flatMap(service => pipe(
      designs,
      Array.map(design => service.get(database, design)),
      Effect.all,
    )),
    Effect.map(d => JSON.stringify(d, null, 2)),
    Effect.tap(Console.log),
  ))
  .pipe(Command.withDescription(`Display detailed information on one or more designs for a Couch database`));
