import * as Effect from 'effect/Effect';
import { ChtClientService } from '../../services/cht-client.ts';
import { Schema } from 'effect';
declare const ChtMonitoringData_base: Schema.Class<ChtMonitoringData, {
    version: Schema.Struct<{
        app: typeof Schema.String;
        couchdb: typeof Schema.String;
    }>;
}, Schema.Struct.Encoded<{
    version: Schema.Struct<{
        app: typeof Schema.String;
        couchdb: typeof Schema.String;
    }>;
}>, never, {
    readonly version: {
        readonly app: string;
        readonly couchdb: string;
    };
}, {}, {}>;
export declare class ChtMonitoringData extends ChtMonitoringData_base {
    static readonly decodeResponse: <E>(self: import("@effect/platform/HttpIncomingMessage").HttpIncomingMessage<E>) => Effect.Effect<ChtMonitoringData, E | import("effect/ParseResult").ParseError, never>;
}
export declare const getChtMonitoringData: () => Effect.Effect<ChtMonitoringData, Error, ChtClientService>;
export {};
//# sourceMappingURL=monitoring.d.ts.map