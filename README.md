# 3db-socketio

a 3db plugin to allow running rivet workflows within 3db.

see [3suite-db](https://github.com/3sig/3suite-db) for more information, including installation instructions.

## why 3db? why rivet?

AI can be difficult to integrate into creative tools, like touchdesigner and unity. 3db's plugin system lets you choose a transport mechanism to use.

rivet's flexibility shines through with its graph input/output systems, which can cleanly integrate with 3db's key/value store.

## usage

see `orchestrator.json5` for annotated configuration details.

3db-rivet exposes a single api for interacting with rivet projects.

`rivet/runGraph` takes one parameter, the name of the graph to run. inputs are read from the 3db database, and outputs are written directly to the database. the keys are controlled by the name of the input nodes and the output nodes.

the `test.rivet-project` file in this repo is an example of a project that reads from the "input" field in the database and writes to the "output" field. multiple inputs and outputs can be used.

## development

### creating a release

ensure that you are in a fully committed state before creating a tag.
run `npm run release` (or `bun run release`) and follow the prompts.
