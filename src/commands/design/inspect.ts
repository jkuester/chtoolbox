import { Args, Command } from '@effect/cli';
import { Array, Console, Effect, pipe } from 'effect';
import { initializeUrl } from '../../index';
import { CouchDesignInfoService } from '../../services/couch/design-info';
import { CouchDesignService } from '../../services/couch/design';

const getDesignInfo = (database: string, design: string) => Effect
  .flatMap(CouchDesignInfoService, svc => svc.get(database, design));

const getViewNames = (database: string, design: string) => Effect
  .flatMap(CouchDesignService, svc => svc.getViewNames(database, design));

const getViewData = (database: string) => (design: string) => Effect.all([
  getDesignInfo(database, design),
  getViewNames(database, design),
]).pipe(
  Effect.map(([designInfo, views]) => ({ ...designInfo, views })),
);

const database = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The database with the design to inspect'),
  );

const designs = Args
  .text({ name: 'design' })
  .pipe(
    Args.withDescription('The design to inspect'),
    Args.atLeast(1),
  );

export const inspect = Command
  .make('inspect', { database, designs }, ({ database, designs }) => initializeUrl.pipe(
    Effect.andThen(pipe(
      designs,
      Array.map(getViewData(database)),
      Effect.all,
    )),
    Effect.map(d => JSON.stringify(d, null, 2)),
    Effect.tap(Console.log),
  ))
  .pipe(Command.withDescription(`Display detailed information on one or more designs for a Couch database`));
