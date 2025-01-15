import { Command } from '@effect/cli';
import { generate } from './generate.js';
import { purge } from './purge.js';
import { replicate } from './replicate.js';
export const doc = Command
    .make('doc', {})
    .pipe(Command.withDescription(`Manage Couch documents.`), Command.withSubcommands([generate, purge, replicate]));
//# sourceMappingURL=index.js.map