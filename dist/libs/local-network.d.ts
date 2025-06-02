import { Effect, Option } from 'effect';
import { LocalChtInstance } from '../services/local-instance.js';
export declare const getFreePort: (opts?: {
    port?: number;
    exclude?: number[];
}) => Effect.Effect<number>;
export declare const getFreePorts: () => Effect.Effect<[number, number]>;
export declare const getLANIPAddress: () => string;
export declare const getLocalIpUrl: (port: `${number}`) => string;
export declare const getLocalIpUrlBasicAuth: ({ username, password, port }: LocalChtInstance) => Option.Option<string>;
//# sourceMappingURL=local-network.d.ts.map