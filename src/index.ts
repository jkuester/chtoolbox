#!/usr/bin/env node
import { Command, Options } from '@effect/cli';
import { NodeContext, NodeHttpClient, NodeRuntime } from '@effect/platform-node';
import { Console, Effect, Layer, Option, pipe, Ref } from 'effect';
import { CouchNodeSystemServiceLive } from './services/couch/node-system';
import { CouchServiceLive } from './services/couch/couch';
import { CouchDbsInfoServiceLive } from './services/couch/dbs-info';
import { monitor } from './commands/monitor';
import packageJson from '../package.json';
import { EnvironmentService, EnvironmentServiceLive, } from './services/environment';

const url = Options
  .text('url')
  .pipe(
    Options.withDescription('The URL of the CouchDB server. Defaults to the COUCH_URL environment variable.'),
    Options.optional
  );

export const populateUrl = (url: Option.Option<string>) => EnvironmentService.pipe(
  Effect.flatMap(env => env.url.pipe(
    Ref.get,
    Effect.map(envUrl => url.pipe(
      Option.getOrElse(() => envUrl),
    )),
    Effect.tap(urlValue => Ref.update(env.url, () => urlValue)),
  )),
);

export const chtx = Command.make('chtx', { url }, ({ url }) => pipe(
  EnvironmentService,
  Effect.tap(env => env.url.pipe(
    Ref.get,
    Effect.tap(Console.log),
  )),
  Effect.andThen(populateUrl(url)),
  Effect.andThen(EnvironmentService),
  Effect.tap(env => env.url.pipe(
    Ref.get,
    Effect.tap(Console.log),
  )),
));

const command = chtx.pipe(Command.withSubcommands([monitor]));

const cli = Command.run(command, {
  name: 'CHT Toolbox',
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
  version: packageJson.version
});

cli(process.argv)
  .pipe(
    Effect.provide(NodeContext.layer),
    Effect.provide(Layer
      .merge(CouchNodeSystemServiceLive, CouchDbsInfoServiceLive)
      .pipe(
        Layer.provide(CouchServiceLive),
        Layer.provideMerge(EnvironmentServiceLive),
        Layer.provide(NodeHttpClient.layer)
      )),
    NodeRuntime.runMain
  );
