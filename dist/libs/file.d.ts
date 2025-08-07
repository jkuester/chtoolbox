import { FileSystem, HttpClient } from '@effect/platform';
import { Effect } from 'effect';
import { Scope } from 'effect/Scope';
import { PlatformError } from '@effect/platform/Error';
export declare const createDir: (dirPath: string) => Effect.Effect<void, PlatformError, FileSystem.FileSystem>;
export declare const createTmpDir: () => Effect.Effect<string, PlatformError, FileSystem.FileSystem | Scope>;
export declare const getRemoteFile: (url: string) => Effect.Effect<string, Error, HttpClient.HttpClient>;
export declare const writeFile: (path: string) => (content: string) => Effect.Effect<void, PlatformError, FileSystem.FileSystem>;
export declare const writeJsonFile: (path: string, data: object) => Effect.Effect<void, PlatformError, FileSystem.FileSystem>;
export declare const readJsonFile: (fileName: string, directory: string) => Effect.Effect<unknown, PlatformError, FileSystem.FileSystem>;
export declare const writeEnvFile: (path: string, data: Record<string, string>) => Effect.Effect<void, PlatformError, FileSystem.FileSystem>;
export declare const isDirectoryEmpty: (dirPath: string) => Effect.Effect<boolean, PlatformError, FileSystem.FileSystem>;
//# sourceMappingURL=file.d.ts.map