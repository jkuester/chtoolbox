import { Command } from '@effect/cli';
import { Option } from 'effect';
import { CouchDesignDocsService } from '../../services/couch/design-docs';
import { CouchDbsInfoService } from '../../services/couch/dbs-info';
export declare const ls: Command.Command<"ls", import("../../services/environment").EnvironmentService | CouchDbsInfoService | Command.Command.Context<"chtx"> | CouchDesignDocsService, Error, {
    readonly database: Option.Option<string>;
}>;
//# sourceMappingURL=ls.d.ts.map