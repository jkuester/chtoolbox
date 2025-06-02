import OS from 'node:os';
import { Array, Effect, Option, pipe, Predicate, Redacted, String } from 'effect';
import getPort from 'get-port';
import { LocalChtInstance } from '../services/local-instance.js';

const IPV4_FAMILY_VALUES = ['IPv4', 4];
const LOCALHOST_IP = '127.0.0.1';

export const getFreePort = (
  opts?: { port?: number, exclude?: number[] }
): Effect.Effect<number> => Effect.promise(() => getPort(opts));

export const getFreePorts = (): Effect.Effect<[number, number]> => getFreePort()
  .pipe(Effect.flatMap(port => getFreePort({ exclude: [port] })
    .pipe(
      Effect.tap(secondPort => Effect.logDebug(`Found free ports: ${port.toString()}, ${secondPort.toString()}`)),
      Effect.map(secondPort => [port, secondPort]),
    )));

export const getLANIPAddress = (): string => pipe(
  OS.networkInterfaces(),
  netsDict => pipe(
    Object.keys(netsDict),
    Array.map((netName) => netsDict[netName]),
    Array.filter(Predicate.isNotNullable),
    Array.flatten,
    Array.filter(({ family }) => IPV4_FAMILY_VALUES.includes(family)),
    Array.filter(({ internal }) => !internal),
    Array.map(({ address }) => address),
    Array.get(0),
    Option.getOrElse(() => LOCALHOST_IP),
  ),
);

const getLANIPAddressHost = (): string => pipe(
  getLANIPAddress(),
  String.replace(/\./g, '-'),
);

export const getLocalIpUrl = (port: `${number}`): string => pipe(
  getLANIPAddressHost(),
  localIpPath => `https://${localIpPath}.local-ip.medicmobile.org:${port}`,
);

export const getLocalIpUrlBasicAuth = ({
  username,
  password,
  port
}: LocalChtInstance): Option.Option<string> => port.pipe(
  Option.map(port => pipe(
    getLANIPAddressHost(),
    localIpPath => `https://${username}:${Redacted.value(password)}@${localIpPath}.local-ip.medicmobile.org:${port}`,
  )),
);
