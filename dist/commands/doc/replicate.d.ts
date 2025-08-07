import { Command } from '@effect/cli';
import { ReplicateService } from '../../services/replicate.js';
import { ParseError } from 'effect/Cron';
import { PouchDBService } from '../../services/pouchdb.js';
export declare const replicate: Command.Command<"replicate", import("../../services/cht-client.ts").ChtClientService | Command.Command.Context<"chtx"> | import("../../services/environment.ts").EnvironmentService | PouchDBService | ReplicateService, Error | ParseError | import("effect/ParseResult").ParseError, {
    readonly follow: boolean;
    readonly contacts: string[];
    readonly source: string;
    readonly target: string;
    readonly all: boolean;
}>;
//# sourceMappingURL=replicate.d.ts.map