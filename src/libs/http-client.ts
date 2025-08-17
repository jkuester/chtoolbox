import { Function, pipe, Schema, Tuple } from 'effect';
import * as Effect from 'effect/Effect';
import { HttpClientRequest } from '@effect/platform';
import type { HttpBodyError } from '@effect/platform/HttpBody';

export const buildPostRequest = <A, I, R>(
  endpoint: string,
  struct: Schema.Schema<A, I, R>
): (body: A) => Effect.Effect<
  HttpClientRequest.HttpClientRequest,
  HttpBodyError,
  R
> => Effect.fn((body) => pipe(
    Tuple.make(HttpClientRequest.post(endpoint), body),
    Function.tupled(HttpClientRequest.schemaBodyJson(struct)),
  ));
