import { ConfigProvider, Effect, Layer, pipe } from 'effect';
import { NodeHttpClient } from '@effect/platform-node';
import { type ChtDdocsDiffByDb, getDesignDocsDiffWithCurrent } from './libs/medic-staging.ts';
import { ChtClientService } from './services/cht-client.ts';
import { PouchDBService } from './services/pouchdb.ts';

/**
 * Configuration for connecting to a CHT instance.
 */
export interface ChtoolboxConfig {
  /** The URL of the CHT/CouchDB server (without credentials) */
  url: string;
  /** Admin username */
  username: string;
  /** Admin password */
  password: string;
}

/**
 * The CHT Toolbox API.
 */
export interface Chtoolbox {
  /**
   * Operations for the database design documents.
   */
  design: {
    /**
     * Get the diff between design documents in the current CHT instance
     * and a target CHT version from the Medic staging server.
     *
     * @param version - Target CHT version to compare against (e.g., "4.5.0")
     * @returns Promise resolving to the diff grouped by database
     */
    getDiffWithCurrent: (version: string) => Promise<ChtDdocsDiffByDb>;
  }
}

/**
 * Create a CHT Toolbox instance for interacting with a CHT server.
 *
 * @param config - Connection configuration for the CHT instance
 * @returns A toolbox object with methods for CHT operations
 *
 * @example
 * ```javascript
 * const { createChtoolbox } = require('chtoolbox');
 *
 * const chtoolbox = createChtoolbox({
 *   url: 'https://my-cht.example.com',
 *   username: 'admin',
 *   password: 'secret'
 * });
 *
 * const diff = await chtoolbox.design.getDiffWithCurrent('4.5.0');
 * console.log(diff.medic.updated); // Design docs that changed in medic db
 * ```
 */
export const createChtoolbox = (config: ChtoolboxConfig): Chtoolbox => {
  const configProvider = ConfigProvider.fromJson({
    CHT_URL: config.url,
    CHT_USERNAME: config.username,
    CHT_PASSWORD: config.password,
  });

  const layer = Layer.mergeAll(
    ChtClientService.Default.pipe(Layer.provide(NodeHttpClient.layer)),
    PouchDBService.Default,
  );

  return {
    design: {
      getDiffWithCurrent: (version: string) => pipe(
        getDesignDocsDiffWithCurrent(version),
        Effect.withConfigProvider(configProvider),
        Effect.provide(layer),
        Effect.runPromise,
      ),
    }
  };
};
