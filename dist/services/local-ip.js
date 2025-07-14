import { Array, Effect, Number, Option, pipe, String } from 'effect';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import * as Context from 'effect/Context';
import { doesContainerExist, getContainerLabelValue, getContainerNamesWithLabel, pullImage, rmContainer, runContainer } from '../libs/docker.js';
import { getFreePort, getLANIPAddress } from '../libs/local-network.js';
const NGINX_LOCAL_IP_IMAGE = 'medicmobile/nginx-local-ip';
const CHTX_LOCAL_IP_PREFIX = 'chtx_local_ip';
const CHTX_LOCAL_IP_LABEL = 'chtx.instance.local-ip';
const getLocalIpContainerName = (toPort) => `${CHTX_LOCAL_IP_PREFIX}_${toPort.toString()}`;
const assertLocalIpContainerDoesNotExist = (toPort) => doesContainerExist(getLocalIpContainerName(toPort))
    .pipe(Effect.filterOrFail(exists => !exists, () => new Error(`Local-ip instance already exists for port [${toPort.toString()}].`)));
const getFromPort = (fromPort) => fromPort.pipe(Option.map(port => getFreePort({ port })
    .pipe(Effect.filterOrFail(freePort => freePort === port, () => new Error(`Port [${port.toString()}] is not available.`)))), Option.getOrElse(() => getFreePort()));
const createLocalIpContainer = (toPort) => (fromPort) => runContainer({
    image: NGINX_LOCAL_IP_IMAGE,
    name: getLocalIpContainerName(toPort),
    ports: [[fromPort, 443]],
    env: { APP_URL: `http://${getLANIPAddress()}:${toPort.toString()}` },
    labels: [`${CHTX_LOCAL_IP_LABEL}=${fromPort.toString()}:${toPort.toString()}`],
});
const getPortsFromLabel = (label) => pipe(label, String.split(':'), Array.map(Number.parse), Array.map(Option.getOrThrow), ([from, to]) => ({ from, to }));
// Continue even if the image pull fails, as it might exist locally.
const pullLocalIpImage = () => pullImage(NGINX_LOCAL_IP_IMAGE)
    .pipe(Effect.catchAll(() => Effect.log(`Failed to pull Docker image: ${NGINX_LOCAL_IP_IMAGE}`)));
const serviceContext = CommandExecutor.pipe(Effect.map(executor => Context.make(CommandExecutor, executor)));
export class LocalIpService extends Effect.Service()('chtoolbox/LocalIpService', {
    effect: serviceContext.pipe(Effect.map(context => ({
        create: (toPort, fromPort) => assertLocalIpContainerDoesNotExist(toPort)
            .pipe(Effect.andThen(pullLocalIpImage), Effect.andThen(getFromPort(fromPort)), Effect.tap(createLocalIpContainer(toPort)), Effect.mapError(x => x), Effect.provide(context)),
        rm: (toPort) => rmContainer(getLocalIpContainerName(toPort))
            .pipe(Effect.mapError(x => x), Effect.provide(context)),
        ls: () => getContainerNamesWithLabel(CHTX_LOCAL_IP_LABEL)
            .pipe(Effect.map(Array.map(getContainerLabelValue(CHTX_LOCAL_IP_LABEL))), Effect.flatMap(Effect.allWith({ concurrency: 'unbounded' })), Effect.map(Array.map(getPortsFromLabel)), Effect.mapError(x => x), Effect.provide(context))
    }))),
    accessors: true,
}) {
}
//# sourceMappingURL=local-ip.js.map