import { Args, Command } from '@effect/cli';
import { Console, Effect } from 'effect';
import { initializeUrl } from '../../index';
import { CouchDbsInfoService } from '../../services/couch/dbs-info';

const databases = Args
  .text({ name: 'database' })
  .pipe(
    Args.withDescription('The database to inspect'),
    Args.atLeast(1),
  );

export const inspect = Command
  .make('inspect', { databases }, ({ databases }) => initializeUrl.pipe(
    Effect.andThen(CouchDbsInfoService.post(databases)),
    Effect.map(d => JSON.stringify(d, null, 2)),
    Effect.tap(Console.log),
  ))
  .pipe(Command.withDescription(`Display detailed information on one or more Couch databases`));
