import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPapertAgent } from '../dist/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliBinaryPath = path.resolve(here, '../../cli/dist/index.js');

async function main() {
  const agent = await createPapertAgent({
    cliArgs: {
      model: 'gemini-2.5-flash', // or your provider model id
      approvalMode: 'auto-edit',
      // apiKey: process.env.OPENAI_API_KEY, // required
      cliBinaryPath,
      // baseUrl: 'https://api.openai.com/v1', // optional override for compatible APIs
    },
  });

  const result = await agent.runPrompt('explain about the project??');
  console.log('exitCode:', result.exitCode);
  console.log('stdout:', result.stdout.trim());
  console.log('stderr:', result.stderr.trim());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
