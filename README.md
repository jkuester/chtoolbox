# chtoolbox

**Toolbox of utilities for the CHT**

CHToolbox is a command-line utility for development and testing of the Community Health Toolkit. The goal is to provide a platform that makes it easy to create and share utility scripts.

Note that some features, such as maintaining local CHT instances, require Docker and Docker Compose to also be installed. 

Features include (but are not limited to):

- Local CHT instance:
  - Create/destroy local instance
  - Modify SSL certificates for local instance (`local-ip.medicmobile.org` certs are used by default)
- Upgrade CHT instance to new version (using REST apis)
- Couch:
  - Add/remove dbs
  - Replicate docs between databases
  - Follow active tasks
  - Purge docs from database (including filtering based on contact/report/reported_date)
  - Compact databases and view indexes
- Upgrade CHT instance to new version
  - Also supports staging/completing upgrades
- Monitor storage metrics for CHT databases and view indexes

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

### Run without installing

The `npx` command can be used to run one-off chtx commands without installing anything locally:

```shell
npx -y git+https://github.com/jkuester/chtoolbox.git --help
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

### Unit tests

To execute the tests, run:

```shell
npm run test
```

Note that currently, the code in `src/commands` is not covered by tests. The goal is to strike a balance between development speed and stability. Reusable code in (e.g. `src/libs` and `src/services`) should be fully covered by automated tests. However, the top-level command code does not have any unit tests.

#### Code coverage

The `test` script will automatically evaluate the code coverage of the tests. If the tests do not fully exercise the implementation code, the script will fail. For more details about the current code coverage, you can view the HTML report in `./.nyc_output/reports`.
