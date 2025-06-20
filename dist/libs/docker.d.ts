import { Effect } from 'effect';
import { CommandExecutor } from '@effect/platform/CommandExecutor';
import { PlatformError } from '@effect/platform/Error';
export declare const pullImage: (image: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export declare const pullComposeImages: (projectName: string, env: Record<string, string>) => (composeFilePaths: string[]) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
type DockerContainerStatus = 'running' | 'exited' | 'created' | 'paused' | 'restarting' | 'removing' | 'dead';
export declare const getContainersForComposeProject: (projectName: string, ...statuses: DockerContainerStatus[]) => Effect.Effect<string[], PlatformError, CommandExecutor>;
export declare const getVolumeNamesWithLabel: (label: string) => Effect.Effect<string[], PlatformError, CommandExecutor>;
export declare const getContainerNamesWithLabel: (label: string) => Effect.Effect<string[], PlatformError, CommandExecutor>;
export declare const doesVolumeExistWithLabel: (label: string) => Effect.Effect<boolean, PlatformError, CommandExecutor>;
export declare const getVolumeLabelValue: (labelName: string) => (volumeName: string) => Effect.Effect<string, PlatformError, CommandExecutor>;
export declare const getContainerLabelValue: (labelName: string) => (container: string) => Effect.Effect<string, PlatformError, CommandExecutor>;
export declare const createComposeContainers: (env: Record<string, string>, ...composeFilePaths: string[]) => (projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export declare const copyFileToComposeContainer: (projectName: string, containerServiceName: string) => ([hostFilePath, containerFilePath]: [string, string]) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export declare const copyFileFromComposeContainer: (containerServiceName: string, containerFilePath: string, hostFilePath: string) => (projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export declare const startCompose: (projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export declare const restartCompose: (projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export declare const restartComposeService: (projectName: string, serviceName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export declare const stopCompose: (projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export declare const destroyCompose: (projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export declare const rmComposeContainer: (serviceName: string) => (projectName: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export declare const getEnvarFromComposeContainer: (containerServiceName: string, envar: string, projectName: string) => Effect.Effect<string, PlatformError, CommandExecutor>;
export declare const runContainer: ({ image, name, env, labels, ports }: {
    image: string;
    name: string;
    labels?: string[];
    ports?: [host: number, container: number][];
    env?: Record<string, string>;
}) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export declare const doesContainerExist: (containerName: string) => Effect.Effect<boolean, PlatformError, CommandExecutor>;
export declare const rmContainer: (name: string) => Effect.Effect<void, Error | PlatformError, CommandExecutor>;
export {};
//# sourceMappingURL=docker.d.ts.map