"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalIpUrl = exports.getFreePorts = void 0;
const node_os_1 = require("node:os");
const effect_1 = require("effect");
const promisedGetPort = import('get-port');
const IPV4_FAMILY_VALUES = ['IPv4', 4];
const LOCALHOST_IP = '127.0.0.1';
const getFreePort = (...exclude) => effect_1.Effect.promise(() => promisedGetPort
    .then(lib => lib.default({ exclude })));
const getFreePorts = () => getFreePort()
    .pipe(effect_1.Effect.flatMap(port => getFreePort(port)
    .pipe(effect_1.Effect.tap(secondPort => effect_1.Effect.logDebug(`Found free ports: ${port.toString()}, ${secondPort.toString()}`)), effect_1.Effect.map(secondPort => [port, secondPort]))));
exports.getFreePorts = getFreePorts;
const getLANIPAddress = () => (0, effect_1.pipe)((0, node_os_1.networkInterfaces)(), netsDict => (0, effect_1.pipe)(Object.keys(netsDict), effect_1.Array.map((netName) => netsDict[netName]), effect_1.Array.filter(effect_1.Predicate.isNotNullable), effect_1.Array.flatten, effect_1.Array.filter(({ family }) => IPV4_FAMILY_VALUES.includes(family)), effect_1.Array.filter(({ internal }) => !internal), effect_1.Array.map(({ address }) => address), effect_1.Array.get(0), effect_1.Option.getOrElse(() => LOCALHOST_IP)));
const getLocalIpUrl = (port) => (0, effect_1.pipe)(getLANIPAddress(), effect_1.String.replace(/\./g, '-'), localIpPath => `https://${localIpPath}.local-ip.medicmobile.org:${port}`);
exports.getLocalIpUrl = getLocalIpUrl;
//# sourceMappingURL=local-network.js.map