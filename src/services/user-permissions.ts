import * as Effect from 'effect/Effect';
import * as Context from 'effect/Context';
import { bulkDocs, getDoc, PouchDBService, streamAllDocPages } from './pouchdb.ts';
import { Array, Option, pipe, Predicate, Schema, Stream } from 'effect';
import { ChtClientService } from './cht-client.ts';
import type { UnknownException } from 'effect/Cause';

class UserDoc extends Schema.Class<UserDoc>('UserDoc')({
  _id: Schema.String,
  password_change_required: Schema.UndefinedOr(Schema.Boolean),
  roles: Schema.Array(Schema.String),
}) {
}

class ChtSettings extends Schema.Class<ChtSettings>('ChtSettings')({
  settings: Schema.Struct({
    permissions: Schema.Struct({
      can_skip_password_change: Schema.UndefinedOr(Schema.Array(Schema.String)),
    })
  })
}) {
}

const hasPasswordChangeRequired = ({ password_change_required }: UserDoc) => Predicate
  .isTruthy(password_change_required);

const cachedCanSkipPasswordChangeRoles: Effect.Effect<CanSkipPasswordRoles> = pipe(
  'settings',
  getDoc('medic'),
  Effect.tap(Effect.logDebug('Retrieved settings doc')),
  Effect.map(Option.flatMap(Schema.decodeUnknownOption(ChtSettings))),
  Effect.map(Option.map(({ settings: { permissions: { can_skip_password_change } } }) => can_skip_password_change)),
  Effect.map(Option.flatMap(Option.fromNullable)),
  Effect.map(Option.getOrElse(() => [] as string[])),
  Effect.cached
);

type CanSkipPasswordRoles = Effect.Effect<string[] | readonly string[], UnknownException, PouchDBService>;

const hasCanSkipPasswordChangePermission = (
  canSkipRoles: CanSkipPasswordRoles
) => ({ roles }: UserDoc) => pipe(
  canSkipRoles,
  Effect.map(Array.intersection(roles)),
  Effect.map(Array.isNonEmptyArray),
);

const updateUsersPasswordChangeRequired = (users: UserDoc[]) => pipe(
  users,
  Array.map(doc => ({ ...doc, password_change_required: false })),
  bulkDocs('_users'),
  Effect.map(Array.map(({ id }) => id)),
  Effect.tap(ids => Effect.logDebug(`Updated password_change_required for ${ids.length.toString()} users`)),
);

const decodeUserDoc = (doc: unknown) => pipe(
  doc,
  Schema.decodeUnknownOption(UserDoc, { onExcessProperty: 'preserve' })
);

const updateUsers = (canSkipRoles: CanSkipPasswordRoles) => pipe(
  { include_docs: true },
  streamAllDocPages('_users'),
  Effect.map(Stream.map(({ rows }) => rows)),
  Effect.map(Stream.map(Array.map(({ doc }) => doc))),
  Effect.map(Stream.map(Array.map(decodeUserDoc))),
  Effect.map(Stream.map(Array.map(Option.filter(hasPasswordChangeRequired)))),
  Effect.map(Stream.map(Array.map(Option.getOrUndefined))),
  Effect.map(Stream.map(Array.filter(Predicate.isNotNullable))),
  Effect.map(Stream.mapEffect(Effect.filter(hasCanSkipPasswordChangePermission(canSkipRoles)))),
  Effect.map(Stream.mapEffect(updateUsersPasswordChangeRequired)),
  Effect.map(Stream.flattenIterables),
);

const serviceContext = Effect
  .all([
    ChtClientService,
    PouchDBService,
  ])
  .pipe(Effect.map(([
    chtClient,
    pouch,
  ]) => Context
    .make(PouchDBService, pouch)
    .pipe(Context.add(ChtClientService, chtClient))));

export class UserPermissionsService extends Effect.Service<UserPermissionsService>()(
  'chtoolbox/UserPermissionsService',
  {
    effect: serviceContext.pipe(Effect.map(context => ({
      updatePasswordChangeRequired: Effect.fn((): Effect.Effect<Stream.Stream<string, Error>> => pipe(
        cachedCanSkipPasswordChangeRoles,
        Effect.flatMap(updateUsers),
        Effect.map(Stream.mapError(x => x as unknown as Error)),
        Effect.map(Stream.provideContext(context)),
        Effect.provide(context),
      )),
    }))),
    accessors: true,
  }
) {
}
