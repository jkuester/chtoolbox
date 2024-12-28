import { Args, Command } from '@effect/cli';
import { Effect } from 'effect';
import { initializeUrl } from '../../index';
import { CouchDbsInfoService } from '../../services/couch/dbs-info';

import { logJson } from '../../libs/console';

const databases = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The database to inspect'),
    Args.atLeast(1),
  );

export const inspect = Command
  .make('inspect', { databases }, ({ databases }) => initializeUrl.pipe(
    Effect.andThen(CouchDbsInfoService.post(databases)),
    Effect.tap(logJson),
  ))
  .pipe(Command.withDescription(`Display detailed information on one or more Couch databases`));
