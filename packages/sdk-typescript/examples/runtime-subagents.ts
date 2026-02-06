import { query, type SubagentConfig } from '@papert-code/sdk-typescript';

const agents: SubagentConfig[] = [
  {
    name: 'test-architect',
    description: 'Creates robust deterministic tests',
    tools: ['read_file', 'write_file', 'run_shell_command'],
    systemPrompt:
      'You are a test specialist. Focus on deterministic tests and edge cases.',
    modelConfig: { model: 'gpt-4o-mini', temp: 0.1 },
    runConfig: { max_time_minutes: 10, max_turns: 12 },
    level: 'session',
  },
];

async function main() {
  const result = query({
    prompt: 'Use `test-architect` to improve auth module test coverage.',
    options: {
      cwd: process.cwd(),
      permissionMode: 'auto-edit',
      agents,
    },
  });

  for await (const message of result) {
    if (message.type === 'result') {
      console.log('done');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

