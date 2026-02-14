import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  query,
  createClient,
  createPapertAgent,
  isSDKAssistantMessage,
  isSDKResultMessage,
  isSDKPartialAssistantMessage,
  isAbortError,
} from '@papert-code/sdk-typescript';

function readArg(name, fallback = undefined) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function requiredArg(name) {
  const value = readArg(name);
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return value;
}

function parseAgentPath(raw) {
  if (!raw) return [];
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

async function printQuery(q) {
  for await (const msg of q) {
    if (isSDKPartialAssistantMessage(msg)) {
      process.stdout.write(msg.delta || '');
      continue;
    }
    if (isSDKAssistantMessage(msg)) {
      const content = Array.isArray(msg.message?.content)
        ? JSON.stringify(msg.message.content)
        : String(msg.message?.content || '');
      console.log('\n[assistant]', content);
      continue;
    }
    if (isSDKResultMessage(msg)) {
      console.log('\n[result]', msg.result || 'done');
      continue;
    }
  }
}

async function usecase01_basic() {
  const q = query({ prompt: 'Say hello in one sentence.' });
  await printQuery(q);
}

async function usecase02_with_cwd() {
  const cwd = readArg('--cwd', process.cwd());
  const q = query({ prompt: 'List top-level files.', options: { cwd } });
  await printQuery(q);
}

async function usecase03_with_model() {
  const model = readArg('--model', 'gpt-5.2');
  const q = query({ prompt: 'Summarize this project in 5 bullets.', options: { model } });
  await printQuery(q);
}

async function usecase04_permission_plan() {
  const q = query({
    prompt: 'Create a new file named PLAN.md with 3 action items.',
    options: { permissionMode: 'plan' },
  });
  await printQuery(q);
}

async function usecase05_allowed_tools() {
  const q = query({
    prompt: 'Read package.json and summarize scripts.',
    options: {
      allowedTools: ['read_file', 'glob', 'grep_search'],
      permissionMode: 'default',
    },
  });
  await printQuery(q);
}

async function usecase06_exclude_tools() {
  const q = query({
    prompt: 'Try to edit a file and then explain what happened.',
    options: {
      excludeTools: ['write_file', 'edit_file'],
      permissionMode: 'default',
    },
  });
  await printQuery(q);
}

async function usecase07_skills_path() {
  const skillsPath = readArg('--skills-path', path.resolve(process.cwd(), '.papert/skills'));
  const q = query({
    prompt: 'List available skills and briefly describe each.',
    options: { skillsPath },
  });
  await printQuery(q);
}

async function usecase08_use_specific_skill() {
  const q = query({
    prompt: 'Use the pptx skill and explain what inputs you need before generating slides.',
    options: {
      allowedTools: ['read_file', 'glob', 'grep_search'],
    },
  });
  await printQuery(q);
}

async function usecase09_pdf_to_pptx_skill() {
  const pdf = requiredArg('--pdf');
  const absPdf = path.resolve(process.cwd(), pdf);
  const prompt = [
    'Use the pptx skill for this task.',
    `PDF input: @${absPdf}`,
    `Task: take the south india banks quartly report ${absPdf} and create teh beautiful PPT to submit to south india bank stake holders use the PPtX skill`,
  ].join('\n');

  const agent = await createPapertAgent({
    cliBinaryPath: 'papert',
    cliArgs: {
      approvalMode: 'auto-edit',
      extraArgs: ['--skills', 'pptx'],
    },
  });

  const result = await agent.runPrompt(prompt);
  console.log('exitCode:', result.exitCode);
  console.log(result.stdout);
  if (result.stderr?.trim()) console.error(result.stderr);
}

async function usecase10_abort_controller() {
  const abortController = new AbortController();
  const q = query({
    prompt: 'Run a long task and keep reporting progress.',
    options: { abortController },
  });

  const killer = (async () => {
    await delay(2000);
    abortController.abort();
  })();

  try {
    await printQuery(q);
  } catch (err) {
    if (isAbortError(err)) {
      console.log('Query aborted as expected.');
    } else {
      throw err;
    }
  } finally {
    await killer;
  }
}

async function usecase11_can_use_tool_callback() {
  const q = query({
    prompt: 'Read package.json and then try writing SUMMARY.md.',
    options: {
      canUseTool: async (toolName, input, _ctx) => {
        if (toolName && toolName.startsWith('read_')) {
          return { behavior: 'allow', updatedInput: input };
        }
        return { behavior: 'deny', message: 'Write tools denied by host app policy.' };
      },
    },
  });
  await printQuery(q);
}

async function usecase12_multi_turn_stream() {
  async function* prompts() {
    yield {
      type: 'user',
      session_id: 'multi-turn-demo',
      parent_tool_use_id: null,
      message: { role: 'user', content: 'Create 3 TODOs in markdown.' },
    };
    yield {
      type: 'user',
      session_id: 'multi-turn-demo',
      parent_tool_use_id: null,
      message: { role: 'user', content: 'Now summarize the TODOs in one line.' },
    };
  }

  const q = query({
    prompt: prompts(),
    options: { permissionMode: 'auto-edit' },
  });
  await printQuery(q);
}

async function usecase13_client_send() {
  const client = createClient({ cwd: process.cwd(), permissionMode: 'auto-edit' });
  const session = client.createSession({ sessionId: 'client-send-demo' });

  const first = await session.send('Create TODO.md with 3 items.');
  const second = await session.send('Summarize TODO.md in 2 bullets.');

  console.log('first message count:', first.length);
  console.log('second message count:', second.length);

  await client.close();
}

async function usecase14_client_stream() {
  const client = createClient({ cwd: process.cwd(), permissionMode: 'auto-edit' });
  const session = client.createSession({ sessionId: 'client-stream-demo' });

  const stream = session.stream('List all Markdown files and provide a short summary.');
  await printQuery(stream);

  await session.close();
  await client.close();
}

async function usecase15_runtime_subagents() {
  const agents = parseAgentPath(readArg('--agents'));
  const q = query({
    prompt: 'Delegate architecture review and return consolidated findings.',
    options: {
      agents: agents.map((name) => ({
        name,
        description: `Runtime subagent ${name}`,
        prompt: `You are ${name}. Focus on concise actionable output.`,
      })),
    },
  });
  await printQuery(q);
}

const usecases = {
  '01': usecase01_basic,
  '02': usecase02_with_cwd,
  '03': usecase03_with_model,
  '04': usecase04_permission_plan,
  '05': usecase05_allowed_tools,
  '06': usecase06_exclude_tools,
  '07': usecase07_skills_path,
  '08': usecase08_use_specific_skill,
  '09': usecase09_pdf_to_pptx_skill,
  '10': usecase10_abort_controller,
  '11': usecase11_can_use_tool_callback,
  '12': usecase12_multi_turn_stream,
  '13': usecase13_client_send,
  '14': usecase14_client_stream,
  '15': usecase15_runtime_subagents,
};

async function main() {
  const id = readArg('--usecase', '01');
  const runner = usecases[id];
  if (!runner) {
    console.error('Unknown usecase:', id);
    console.error('Available:', Object.keys(usecases).join(', '));
    process.exit(1);
  }
  await runner();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
