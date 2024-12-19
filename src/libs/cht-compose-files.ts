import { FileSystem, HttpClient, HttpClientRequest } from '@effect/platform';
import { Array, Effect, pipe } from 'effect';
import { PlatformError } from '@effect/platform/Error';

export const UPGRADE_SVC_COMPOSE_FILE_NAME = 'docker-compose.yml';
export const CHTX_LABEL_NAME = 'chtx.instance';
const UPGRADE_SERVICE_COMPOSE = `
services:
  cht-upgrade-service:
    restart: always
    image: public.ecr.aws/s5s3h4s7/cht-upgrade-service:latest
    volumes:
      - \${DOCKER_HOST:-/var/run/docker.sock}:/var/run/docker.sock
      - chtx-compose-files:/docker-compose
    networks:
      - cht-net
    environment:
      - COUCHDB_USER
      - COUCHDB_PASSWORD
      - COUCHDB_SECRET
      - COUCHDB_DATA
      - NGINX_HTTP_PORT
      - NGINX_HTTPS_PORT
      - CHT_COMPOSE_PROJECT_NAME
      - CHT_NETWORK
networks:
  cht-net:
    name: CHT_NETWORK
volumes:
  chtx-compose-files:
    labels:
      - "${CHTX_LABEL_NAME}=\${CHT_COMPOSE_PROJECT_NAME}"
`;

export const CHT_COMPOSE_FILE_NAMES = [
  'cht-core.yml',
  'cht-couchdb.yml',
];

const chtComposeUrl = (
  version: string,
  fileName: string
) => `https://staging.dev.medicmobile.org/_couch/builds_4/medic%3Amedic%3A${version}/docker-compose/${fileName}`;

const getRemoteFile = (url: string) => HttpClient.HttpClient.pipe(
  Effect.map(HttpClient.filterStatusOk),
  Effect.flatMap(client => client.execute(HttpClientRequest.get(url))),
  Effect.flatMap(({ text }) => text),
  Effect.scoped,
);

const saveFile = (path: string) => (content: string) => FileSystem.FileSystem.pipe(
  Effect.flatMap(fs => fs.writeFileString(path, content)),
);

export const writeUpgradeServiceCompose = (
  dirPath: string
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> => pipe(
  UPGRADE_SERVICE_COMPOSE,
  saveFile(`${dirPath}/${UPGRADE_SVC_COMPOSE_FILE_NAME}`),
);

const writeChtCompose = (dirPath: string, version: string) => (fileName: string) => pipe(
  chtComposeUrl(version, fileName),
  getRemoteFile,
  Effect.flatMap(saveFile(`${dirPath}/${fileName}`)),
);

export const writeComposeFiles = (
  dirPath: string,
  version: string
): Effect.Effect<void, Error, FileSystem.FileSystem | HttpClient.HttpClient> => pipe(
  CHT_COMPOSE_FILE_NAMES,
  Array.map(writeChtCompose(dirPath, version)),
  Array.append(writeUpgradeServiceCompose(dirPath)),
  Effect.all,
  Effect.mapError(x => x as Error),
);
