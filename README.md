# 3suite

this repository serves as a template for 3suite-db plugins. as of writing, it includes:

- 3lib-orchestrator setup to test the plugin
- workflow actions for automated building and releasing via tags

see [3suite-db](https://github.com/3sig/3suite-db) for more information.

## usage

### getting started

- fork the repository, either through github or with gh `gh repo fork 3sig/3suite-db-plugin-template`
- change the `package.json` file to reflect your plugin's name
- update `orchestrator.json5` to reflect your plugin's name

### development

use `npm run start` or `bun run start` to run 3suite-db with this plugin.

### creating a new project

fork the repository--any changes that we make to the build workflows should be merged upstream to this template.

enable workflows in github so that the build workflows can run.

### creating a release

ensure that you are in a fully committed state before creating a tag.
run `npm run release` (or `bun run release`) and follow the prompts.
