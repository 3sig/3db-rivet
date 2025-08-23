import * as Rivet from "@ironclad/rivet-core";
import chokidar from "chokidar";
import * as fs from "fs";

let rivetProject;

export {
  onInitialize,
  runGraph,
}

async function onInitialize(config, runApi) {
  function updateRivetProject() {
    try {
      console.log(`[rivet] Loading Rivet project from: ${config.filename}`);
      let fileContents = fs.readFileSync(config.filename, "utf8");
      rivetProject = Rivet.loadProjectFromString(fileContents);
      console.log(`[rivet] Rivet project reloaded successfully`);
    } catch (error) {
      console.error(`[rivet] Error loading Rivet project from ${config.filename}:`, error);
    }
  }
  let watcher = chokidar.watch(config.filename, {
    awaitWriteFinish: true,
    persistent: false,
    atomic: true,
  });
  watcher.on("change", () => {
    console.log(`[rivet] Rivet file changed, reloading...`);
    updateRivetProject();
  });
  updateRivetProject();
}

function _getGraphData(rivetProject) {
  let graphData = {};
  for (let graphId in rivetProject.graphs) {
    let graph = rivetProject.graphs[graphId];

    graphId = graph.metadata.name;
    let inputs = {};
    let outputs = {};

    let partialOutputNodeId = null;
    for (let nodeKey in graph.nodes) {
      let node = graph.nodes[nodeKey];

      if (node.type == "graphInput") {
        inputs[node.data.id] = node.id;
      } else if (node.type == "graphOutput") {
        outputs[node.data.id] = node.id;
      }

      if (node?.data?.useAsGraphPartialOutput) {
        partialOutputNodeId = node.id;
      }
    }

    graphData[graphId] = {
      inputs: inputs,
      outputs: outputs,
      partialOutputNodeId: partialOutputNodeId,
    };
  }
  return graphData;
}

async function runGraph(config, runApi, graph) {
  console.log(`[rivet] Running graph: ${graph}`);

  let graphData = _getGraphData(rivetProject);
  let gd = graphData[graph];

  if (!gd) {
    console.error(`[rivet] Graph '${graph}' not found in project`);
    return {};
  }

  let inputMap = {};

  for (let input of Object.keys(gd.inputs)) {
    if (config.verbose) {
      console.log(`[rivet] Fetching input '${input}' via core/get API`);
    }
    inputMap[input] = await runApi("core/get", input);
    if (config.verbose) {
      console.log(`[rivet] Input '${input}' value:`, inputMap[input]);
    }
  }

  for (let input of Object.keys(gd.inputs)) {
    if (
      inputMap[input] == undefined ||
      inputMap[input] == null
    ) {
      inputMap[input] = "";
      console.log(`[rivet] Missing input '${input}', using empty string`);
    }
  }

  for (let input in inputMap) {
    let type = "Any";
    if (typeof inputMap[input] === "string") {
      type = "string";
    }

    inputMap[input] = {
      type: type,
      value: inputMap[input]
    }
  }

  if (config.verbose) {
    console.log(`[rivet] Calling Rivet processor for graph '${graph}' with inputs:`, Object.keys(inputMap));
  }

  let rivetProcessor = Rivet.coreCreateProcessor(rivetProject, {
    graph: graph,
    inputs: inputMap,
    openAiKey: config.apiKey,
    openAiEndpoint: config.endpointUrl
  });

  let result = await rivetProcessor.run();

  if (config.verbose) {
    console.log(`[rivet] Graph '${graph}' execution completed, processing outputs:`, Object.keys(result));
  }

  let outputMap = {};
  for (let key in result) {
    if (key.startsWith("json")) {
      if (config.verbose) {
        console.log(`[rivet] Processing JSON output for key: ${key}`);
      }
      try {
        let resultJsonString = result.json.value;
        let resultJson = JSON.parse(resultJsonString);
        outputMap = { ...outputMap, ...resultJson };
        if (config.verbose) {
          console.log(`[rivet] JSON parsed successfully:`, Object.keys(resultJson));
        }
      } catch (e) {
        console.error(`[rivet] Error parsing JSON result for key '${key}':`, e);
      }
    } else if (key != "cost") {
      outputMap[key] = result[key].value;
    }
  }

  if (outputMap) {
    for (let output in outputMap) {
      if (config.verbose) {
        console.log(`[rivet] Updating '${output}' via core/update API with value:`, outputMap[output]);
      }
      await runApi("core/update", output, outputMap[output]);
    }
  }

  console.log(`[rivet] Graph '${graph}' completed with outputs:`, Object.keys(outputMap));

  return outputMap;
}
