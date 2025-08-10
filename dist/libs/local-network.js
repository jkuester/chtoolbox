import OS from 'node:os';
import { Array, Effect, Option, pipe, Predicate, Redacted, String } from 'effect';
import getPort from 'get-port';
const IPV4_FAMILY_VALUES = ['IPv4', 4];
const LOCALHOST_IP = '127.0.0.1';
export const getFreePort = Effect.fn((opts) => Effect.promise(() => getPort(opts)));
export const getFreePorts = Effect.fn(() => getFreePort(), Effect.flatMap(port => getFreePort({ exclude: [port] })
    .pipe(Effect.tap(secondPort => Effect.logDebug(`Found free ports: ${port.toString()}, ${secondPort.toString()}`)), Effect.map(secondPort => [port, secondPort]))));
export const getLANIPAddress = () => pipe(OS.networkInterfaces(), netsDict => pipe(Object.keys(netsDict), Array.map((netName) => netsDict[netName]), Array.filter(Predicate.isNotNullable), Array.flatten, Array.filter(({ family }) => IPV4_FAMILY_VALUES.includes(family)), Array.filter(({ internal }) => !internal), Array.map(({ address }) => address), Array.get(0), Option.getOrElse(() => LOCALHOST_IP)));
const getLANIPAddressHost = () => pipe(getLANIPAddress(), String.replace(/\./g, '-'));
export const getLocalIpUrl = (port) => pipe(getLANIPAddressHost(), localIpPath => `https://${localIpPath}.local-ip.medicmobile.org:${port}`);
export const getLocalIpUrlBasicAuth = ({ username, password, port }) => port.pipe(Option.map(port => pipe(getLANIPAddressHost(), localIpPath => `https://${username}:${Redacted.value(password)}@${localIpPath}.local-ip.medicmobile.org:${port}`)));
