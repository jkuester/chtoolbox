# chtoolbox

Toolbox of utilities for the CHT

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

## Development

### Building the app

To build the app run:

```shell
npm run build-app
```

When committing changes to the app, make sure to run the build command first. Then be sure to include any changes to the files in the `dist` directory in your commit. If you do not include these changes, they will not be reflected for anyone installing the app directly from GitHub. (The app is not rebuilt when globally installing from a git repository.)

### Run command locally

Use the `npm run local` script to execute the app locally (without needing to rebuild it).

You can include sub-commands, options, and arguments after `--` in the command. For example, to run the `monitor` sub-command:

```shell
npm run local -- monitor
```
