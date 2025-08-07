import { Command } from '@effect/cli';
import { inspect } from "./inspect.js";
import { compact } from "./compact.js";
import { ls } from "./ls.js";
export const design = Command
    .make('design', {})
    .pipe(Command.withDescription(`Manage Couch database designs.`), Command.withSubcommands([compact, inspect, ls]));
//# sourceMappingURL=index.js.map