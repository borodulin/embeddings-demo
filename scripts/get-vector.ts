import "./_shared/env";

import { embedText } from "../lib/embeddings";
import { closeOpenAiProxyAgents } from "../lib/embeddings/providers/openai";
import { EMBEDDING_MODELS, isEmbeddingModel } from "../lib/models";
import { getArg } from "./_shared/cli";

const args = process.argv.slice(2);

const modelArg = getArg(args, "--model");
const textArg = getArg(args, "--text");
const jsonFlag = args.includes("--json");

async function main() {
  if (!modelArg || !isEmbeddingModel(modelArg)) {
    throw new Error(
      `--model is required. Allowed values: ${EMBEDDING_MODELS.join(", ")}`,
    );
  }

  if (!textArg || textArg.trim().length === 0) {
    throw new Error("--text is required and must be non-empty");
  }

  const vector = await embedText(textArg, modelArg);

  if (jsonFlag) {
    console.log(
      JSON.stringify(
        {
          model: modelArg,
          text: textArg,
          dimensions: vector.length,
          vector,
        },
        null,
        2,
      ),
    );
    return;
  }

  const previewSize = Math.min(12, vector.length);
  console.log(`model: ${modelArg}`);
  console.log(`dimensions: ${vector.length}`);
  console.log(`preview[0:${previewSize}]: ${vector.slice(0, previewSize).join(", ")}`);
  console.log("Tip: add --json to print full vector.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeOpenAiProxyAgents();
  });
