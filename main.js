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
      let fileContents = fs.readFileSync(config.filename, "utf8");
      rivetProject = Rivet.loadProjectFromString(fileContents);
    } catch (error) {
      console.error(
        "Error loading Rivet project:",
        config.filename,
        "error: ",
        error,
      );
    }
  }
  let watcher = chokidar.watch(config.filename, {
    awaitWriteFinish: true,
    persistent: false,
    atomic: true,
  });
  watcher.on("change", updateRivetProject);
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
  let graphData = _getGraphData(rivetProject);

  let gd = graphData[graph];
  let inputMap = {};

  // collect inputs
  for (let input of Object.keys(gd.inputs)) {
    inputMap[input] = await runApi("core/get", input);
  }

  // fill in missing inputs
  for (let input of Object.keys(gd.inputs)) {
    if (
      inputMap[input] == undefined ||
      inputMap[input] == null
    ) {
      inputMap[input] == "";
      console.log(`Missing input: ${input}`);
    }
  }

  for (let input in inputMap) {
    let type = "Any";
    if (typeof inputMap[input] === "string") {
      type = "string";
    }

    inputMap[input] = {
      type:type,
      value: inputMap[input]
    }
  }

  // run the graph
  let rivetProcessor = Rivet.coreCreateProcessor(rivetProject, {
    graph: graph,
    inputs: inputMap,
    openAiKey: config.apiKey,
    openAiEndpoint: config.endpointUrl
  });

  let result = await rivetProcessor.run();

  let outputMap = {};
  for (let key in result) {
    if (key.startsWith("json")) {
      console.log("graphLogic.js JSON PARSE HIT");
      try {
        let resultJsonString = result.json.value;
        let resultJson = JSON.parse(resultJsonString);
        outputMap = { ...outputMap, ...resultJson };
      } catch (e) {
        console.error("Error parsing result json: ", e);
      }
    } else if (key != "cost") {
      // filter out rivet reporting the cost of the query
      outputMap[key] = result[key].value;
    }
  }

  if (outputMap) {
    for (let output in outputMap) {
      await runApi("core/update", output, outputMap[output])
    }
  }

  return outputMap;
}
