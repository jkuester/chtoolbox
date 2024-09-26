# chtoolbox

**Toolbox of utilities for the CHT**

CHToolbox is a command-line utility for development and testing of the Community Health Toolkit. The goal is to provide a platform that makes it easy to create and share utility scripts.

## Installation

To globally install the app run:

```shell
npm i -g git+https://github.com/jkuester/chtoolbox.git
```

### Target specific branch

A particular branch can be installed by running:

```shell
npm i -g git+https://github.com/jkuester/chtoolbox.git#<branch>
```

## Usage

Check the help text for the latest usage information:

```shell
chtx --help
```

## Development

This project is built on the [Effect](https://effect.website/) framework. New functionality should be implemented with Effect. However, it is not expected that new contributors will be experts with Effect. The moderate size and complexity of this codebase make it a great starting point for learning the framework. All levels of PRs are welcome and the review process can be an opportunity to refine and improve the Effectful nature of the code.

This readme is not the place for a comprehensive guide to Effect. The [Effect documentation](https://effect.website/docs/introduction) and [API reference](https://effect-ts.github.io/effect/docs/effect) are a good place to start. However, here are some specifics that should help orient you to the codebase:

- Implementation code in the `src` directory is written using the [pipeline pattern](https://effect.website/docs/guides/essentials/pipeline). Code in the test directory is written using the [generator pattern](https://effect.website/docs/guides/essentials/using-generators).
    - The primary motivation for this is to provide the opportunity to demonstrate both patterns in the codebase (without confusingly mixing them in the same code).
    - It is also a natural fit since the pipeline code needs to be more carefully structured while the generator code is a bit more free-form.
- Dependency injection is achieved using Effect [services](https://effect.website/docs/guides/context-management/services). This allows for proper separation of concerns and testability.
    - Each service file exports a `*Live` layer that represents the implementation of the service. When the app is run, these layers are injected in the [`src/index.ts`](src/index.ts) file.
        - New services will need to be added to the dependency tree in the `src/index.ts` file to be available in the app.
    - In the tests, instead of injecting the `*Live` layers of dependency services, mocked services should be injected in the `run` function (along with the `*Live` layer for the service being tested).
    - For consistency and convenience in testing, service properties should always be functions.
- The CLI interface is built using the [Effect CLI](https://github.com/Effect-TS/effect/blob/main/packages/cli/README.md) package.
    - New sub-commands should be added to the `src/commands` directory and then included in the `Command.withSubcommands` array in the `src/index.ts` file.  
- The Effect [platform library](https://effect.website/docs/guides/platform/introduction) is used for file system access and other platform-specific operations.
- The Effect [schema library](https://effect.website/docs/guides/schema/introduction) is used for data deserialization (e.g. extracting typed data from the JSON payload of HTTP responses).

### Development Environment

Using recent versions of Node.js and NPM, you can install the project dependencies by running:

```shell
npm ci
``` 

### Building the app

To build the app run:

```shell
npm run build-app
```

When committing changes to the app, make sure to run the build command first. Then include any changes to the files in the `dist` directory in your commit. If you do not include these changes, they will not be reflected for anyone installing the app directly from GitHub. (The app is not rebuilt when globally installing from a git repository.)

### Run command locally

Use the `npm run local` script to execute the app locally (without needing to rebuild it).

You can include sub-commands, options, and arguments after `--` in the command. For example, to run the `monitor` sub-command:

```shell
npm run local -- monitor
```
