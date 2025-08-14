import { Function, pipe, Schema, Tuple } from 'effect';
import * as Effect from 'effect/Effect';
import { HttpClientRequest } from '@effect/platform';
import { Struct } from 'effect/Schema';
import type { HttpBodyError } from '@effect/platform/HttpBody';

export const buildPostRequest = <T extends Struct.Fields>(
  endpoint: string,
  struct: Schema.Struct<T>
): (body: typeof struct.Type) => Effect.Effect<
  HttpClientRequest.HttpClientRequest,
  HttpBodyError,
  Schema.Schema.Context<T[keyof T]>
> => Effect.fn((body) => pipe(
    Tuple.make(
      HttpClientRequest.post(endpoint),
      body
    ),
    Function.tupled(HttpClientRequest.schemaBodyJson(struct)),
  ));
