// Import necessary modules from the libraries
import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime, NodeHttpClient } from "@effect/platform-node";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform"
import { Console, Effect } from "effect";
import { LocalSystemDataService, LocalSystemDataServiceLive } from './services/local-system-data.service';
import * as Layer from "effect/Layer"
import { CouchServiceLive } from './services/couch.service';
import { DbsInfoService, DbsInfoServiceLive } from './services/dbs-info.service';

const getCouchServiceData = Effect.flatMap(
  LocalSystemDataService,
  (couchSystem) => couchSystem.get(),
);

// Define the top-level command  Effect<void, unknown, unknown>
const command = Command.make("index", {}, () => getCouchServiceData.pipe(
  Effect.tap(Console.log),
  Effect.andThen(DbsInfoService),
  // x => x,
  Effect.flatMap(dbsInfoService => dbsInfoService.get()),
  x => x,
  Effect.tap(Console.log),
  x => x
));

// Set up the CLI application
const cli = Command.run(command, {
  name: "Hello World CLI",
  version: "v1.0.0"
})

// Prepare and run the CLI application
cli(process.argv).pipe(
  Effect.provide(NodeContext.layer),
  Effect.provide(CouchServiceLive),
  Effect.provide(LocalSystemDataServiceLive),
  Effect.provide(DbsInfoServiceLive),
  NodeRuntime.runMain
)
