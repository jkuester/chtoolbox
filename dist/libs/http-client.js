import { Function, pipe, Schema, Tuple } from 'effect';
import * as Effect from 'effect/Effect';
import { HttpClientRequest } from '@effect/platform';
import { Struct } from 'effect/Schema';
export const buildPostRequest = (endpoint, struct) => Effect.fn((body) => pipe(Tuple.make(HttpClientRequest.post(endpoint), body), Function.tupled(HttpClientRequest.schemaBodyJson(struct))));
