import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPapertAgent } from '@papert-code/sdk-typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliBinaryPath = path.resolve(here, '../../cli/dist/index.js');

async function main() {
  const controller = new AbortController();

  const agent = await createPapertAgent({
    cliArgs: {
      model: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY,
      cliBinaryPath,
    },
  });

  const runPromise = agent.runPrompt(
    'Write a long essay about testing best practices.',
    { signal: controller.signal },
  );

  // Cancel after 1 second for demo purposes.
  setTimeout(() => controller.abort(), 1000);

  try {
    const res = await runPromise;
    console.log('Result:', res);
  } catch (err) {
    console.error('Aborted:', err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
