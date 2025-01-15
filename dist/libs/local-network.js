import OS from 'node:os';
import { Array, Effect, Option, pipe, Predicate, String } from 'effect';
import { promisedGetPort } from './core.js';
const IPV4_FAMILY_VALUES = ['IPv4', 4];
const LOCALHOST_IP = '127.0.0.1';
const getFreePort = (...exclude) => Effect.promise(() => promisedGetPort()
    .then(lib => lib.default({ exclude })));
export const getFreePorts = () => getFreePort()
    .pipe(Effect.flatMap(port => getFreePort(port)
    .pipe(Effect.tap(secondPort => Effect.logDebug(`Found free ports: ${port.toString()}, ${secondPort.toString()}`)), Effect.map(secondPort => [port, secondPort]))));
const getLANIPAddress = () => pipe(OS.networkInterfaces(), netsDict => pipe(Object.keys(netsDict), Array.map((netName) => netsDict[netName]), Array.filter(Predicate.isNotNullable), Array.flatten, Array.filter(({ family }) => IPV4_FAMILY_VALUES.includes(family)), Array.filter(({ internal }) => !internal), Array.map(({ address }) => address), Array.get(0), Option.getOrElse(() => LOCALHOST_IP)));
export const getLocalIpUrl = (port) => pipe(getLANIPAddress(), String.replace(/\./g, '-'), localIpPath => `https://${localIpPath}.local-ip.medicmobile.org:${port}`);
//# sourceMappingURL=local-network.js.map