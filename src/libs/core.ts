import { Effect, Option, Ref } from 'effect';
import PouchDB from 'pouchdb-core';

export const optionalUpdate = <A>(ref: Ref.Ref<A>, value: Option.Option<A>): Effect.Effect<void> => value.pipe(
  Option.map(value => Ref.update(ref, () => value)),
  Option.getOrElse(() => Effect.void)
);

/**
 * Shim to make PouchDB easier to mock.
 */
export const pouchDB = (
  name?: string,
  options?: PouchDB.Configuration.DatabaseConfiguration
) => new PouchDB(name, options);
