import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPapertAgent } from '@papert-code/sdk-typescript';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliBinaryPath = path.resolve(here, '../../cli/dist/index.js');

async function main() {
  const agent = await createPapertAgent({
    cliArgs: {
      model: 'gpt-4o-mini',
      apiKey: 'bad-key', // intentionally wrong to demonstrate error handling
      cliBinaryPath,
    },
  });

  const res = await agent.runPrompt('test a bad key');
  console.log('exitCode:', res.exitCode);
  console.log('stderr:', res.stderr.trim() || res.stdout.trim());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
