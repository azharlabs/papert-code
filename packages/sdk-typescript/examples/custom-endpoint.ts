import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPapertAgent } from '@papert-code/sdk-typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliBinaryPath = path.resolve(here, '../../cli/dist/index.js');

async function main() {
  const agent = await createPapertAgent({
    cliArgs: {
      model: 'my-provider-model',
      baseUrl: 'https://api.myprovider.com/v1', // OpenAI-compatible endpoint
      apiKey: process.env.OPENAI_API_KEY, // or your provider key
      approvalMode: 'auto_edit',
      cliBinaryPath,
    },
  });

  const result = await agent.runPrompt('List 2 advantages of typed SDKs.', {
    extraArgs: ['--approval-mode', 'yolo'], // per-call override if desired
  });

  console.log('exitCode:', result.exitCode);
  console.log('stdout:', result.stdout.trim().slice(0, 400));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
