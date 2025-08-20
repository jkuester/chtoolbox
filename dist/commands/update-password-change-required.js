import { Command } from '@effect/cli';
import { Console, Effect, pipe, Stream } from 'effect';
import { initializeUrl } from "../index.js";
import { UserPermissionsService } from '../services/user-permissions.js';
export const updatePasswordChangeRequired = Command
    .make('update-password-change-required', {}, () => pipe(initializeUrl, Effect.andThen(UserPermissionsService.updatePasswordChangeRequired()), Effect.map(Stream.tap(Console.log)), Effect.flatMap(Stream.runDrain)))
    .pipe(Command.withDescription('Sets `password_change_required = false` for any users that have the can_skip_password_change permission.'));
