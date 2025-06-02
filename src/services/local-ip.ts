import { Array, Effect, Number, Option, pipe, String } from 'effect';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import * as Context from 'effect/Context';
import {
  doesContainerExist,
  getContainerLabelValue,
  getContainerNamesWithLabel,
  rmContainer,
  runContainer
} from '../libs/docker.js';
import { getFreePort, getLANIPAddress } from '../libs/local-network.js';

const NGINX_LOCAL_IP_IMAGE = 'medicmobile/nginx-local-ip';
const CHTX_LOCAL_IP_PREFIX = 'chtx_local_ip';
const CHTX_LOCAL_IP_LABEL = 'chtx.instance.local-ip';

const getLocalIpContainerName = (toPort: number) => `${CHTX_LOCAL_IP_PREFIX}_${toPort.toString()}`;

const assertLocalIpContainerDoesNotExist = (
  toPort: number
) => doesContainerExist(getLocalIpContainerName(toPort))
  .pipe(Effect.filterOrFail(
    exists => !exists,
    () => new Error(`Local-ip instance already exists for port [${toPort.toString()}].`)
  ));

const getFromPort = (fromPort: Option.Option<number>) => fromPort.pipe(
  Option.map(port => getFreePort({ port })
    .pipe(Effect.filterOrFail(
      freePort => freePort === port,
      () => new Error(`Port [${port.toString()}] is not available.`)
    ))),
  Option.getOrElse(() => getFreePort()),
);

const createLocalIpContainer = (toPort: number) => (fromPort: number) => runContainer({
  image: NGINX_LOCAL_IP_IMAGE,
  name: getLocalIpContainerName(toPort),
  ports: [[fromPort, 443]] as [number, number][],
  env: { APP_URL: `http://${getLANIPAddress()}:${toPort.toString()}` },
  labels: [`${CHTX_LOCAL_IP_LABEL}=${fromPort.toString()}:${toPort.toString()}`],
});

const getPortsFromLabel = (label: string) => pipe(
  label,
  String.split(':'),
  Array.map(Number.parse),
  Array.map(Option.getOrThrow),
  ([from, to]) => ({ from, to })
);

const serviceContext = CommandExecutor.pipe(Effect.map(executor => Context.make(CommandExecutor, executor)));

export class LocalIpService extends Effect.Service<LocalIpService>()('chtoolbox/LocalIpService', {
  effect: serviceContext.pipe(Effect.map(context => ({
    create: (
      toPort: number,
      fromPort: Option.Option<number>
    ): Effect.Effect<number, Error> => assertLocalIpContainerDoesNotExist(toPort)
      .pipe(
        Effect.andThen(getFromPort(fromPort)),
        Effect.tap(createLocalIpContainer(toPort)),
        Effect.mapError(x => x as Error),
        Effect.provide(context),
      ),
    rm: (toPort: number): Effect.Effect<void, Error> => rmContainer(getLocalIpContainerName(toPort))
      .pipe(
        Effect.mapError(x => x as unknown as Error),
        Effect.provide(context),
      ),
    ls: (): Effect.Effect<{ from: number, to: number }[], Error> => getContainerNamesWithLabel(CHTX_LOCAL_IP_LABEL)
      .pipe(
        Effect.map(Array.map(getContainerLabelValue(CHTX_LOCAL_IP_LABEL))),
        Effect.flatMap(Effect.all),
        Effect.map(Array.map(getPortsFromLabel)),
        Effect.mapError(x => x as unknown as Error),
        Effect.provide(context),
      )
  }))),
  accessors: true,
}) {
}
