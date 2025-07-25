import { Args, Command } from '@effect/cli';
import { Array, Effect, pipe } from 'effect';
import { initializeUrl } from '../../index.js';
import { getDesignInfo } from '../../libs/couch/design-info.js';
import { getViewNames } from '../../libs/couch/design.js';

import { logJson } from '../../libs/console.js';

const getViewData = (database: string) => (design: string) => Effect
  .all([
    getDesignInfo(database, design),
    getViewNames(database, design),
  ])
  .pipe(
    Effect.map(([designInfo, views]) => ({
      ...designInfo,
      views
    })),
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
      Effect.allWith({ concurrency: 'unbounded' }),
    )),
    Effect.tap(logJson),
  ))
  .pipe(Command.withDescription(`Display detailed information on one or more designs for a Couch database`));
