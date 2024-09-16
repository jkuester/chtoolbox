import { Effect, Option, Ref } from 'effect';

export const optionalUpdate = <A>(ref: Ref.Ref<A>, value: Option.Option<A>): Effect.Effect<void> => value.pipe(
  Option.map(value => Ref.update(ref, () => value)),
  Option.getOrElse(() => Effect.void)
);
