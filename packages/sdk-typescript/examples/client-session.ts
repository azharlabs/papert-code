import { createClient } from '@papert-code/sdk-typescript';

async function main() {
  const client = createClient({
    cwd: process.cwd(),
    permissionMode: 'default',
    model: 'gpt-4o-mini',
  });

  const session = client.createSession({ sessionId: 'sdk-client-demo' });

  const first = await session.send('List top-level folders in this repository.');
  console.log('first message count:', first.length);

  const second = await session.send('Now summarize the test strategy in this repo.');
  console.log('second message count:', second.length);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

