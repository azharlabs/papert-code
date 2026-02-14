import argparse
import asyncio
import os
from pathlib import Path
from typing import AsyncIterator

from papert_code_sdk import (
    SDKUserMessage,
    create_client,
    create_papert_agent,
    is_abort_error,
    query,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Papert Python SDK usecases')
    parser.add_argument('--usecase', default='01')
    parser.add_argument('--cwd', default=os.getcwd())
    parser.add_argument('--model', default='gpt-5.2')
    parser.add_argument('--skills-path', default=str(Path.cwd() / '.papert' / 'skills'))
    parser.add_argument('--pdf', default='')
    parser.add_argument('--agents', default='')
    return parser


async def print_query(q) -> None:
    async for msg in q:
        if msg.type == 'stream_event':
            delta = getattr(msg, 'delta', '')
            if delta:
                print(delta, end='', flush=True)
            continue
        if msg.type == 'assistant':
            print('\n[assistant]', msg.message)
        elif msg.type == 'result':
            print('\n[result]', getattr(msg, 'result', 'done'))


async def usecase01_basic(args):
    q = query(prompt='Say hello in one sentence.')
    await print_query(q)


async def usecase02_with_cwd(args):
    q = query(prompt='List top-level files.', options={'cwd': args.cwd})
    await print_query(q)


async def usecase03_with_model(args):
    q = query(prompt='Summarize this project in 5 bullets.', options={'model': args.model})
    await print_query(q)


async def usecase04_permission_plan(args):
    q = query(
        prompt='Create a new file named PLAN.md with 3 action items.',
        options={'permissionMode': 'plan'},
    )
    await print_query(q)


async def usecase05_allowed_tools(args):
    q = query(
        prompt='Read package.json and summarize scripts.',
        options={
            'allowedTools': ['read_file', 'glob', 'grep_search'],
            'permissionMode': 'default',
        },
    )
    await print_query(q)


async def usecase06_exclude_tools(args):
    q = query(
        prompt='Try editing a file and report what happened.',
        options={
            'excludeTools': ['write_file', 'edit_file'],
            'permissionMode': 'default',
        },
    )
    await print_query(q)


async def usecase07_skills_path(args):
    q = query(
        prompt='List available skills and briefly describe each.',
        options={'skillsPath': args.skills_path},
    )
    await print_query(q)


async def usecase08_specific_skill(args):
    q = query(
        prompt='Use the pptx skill and explain required inputs before generating slides.',
        options={'allowedTools': ['read_file', 'glob', 'grep_search']},
    )
    await print_query(q)


async def usecase09_pdf_to_pptx_skill(args):
    if not args.pdf:
        raise ValueError('--pdf is required for usecase 09')

    abs_pdf = str(Path(args.pdf).expanduser().resolve())
    prompt = '\n'.join([
        'Use the pptx skill for this task.',
        f'PDF input: @{abs_pdf}',
        f'Task: take the south india banks quartly report {abs_pdf} and create teh beautiful PPT to submit to south india bank stake holders use the PPtX skill',
    ])

    agent = create_papert_agent(
        {
            'options': {
                'pathToPapertExecutable': 'papert',
                'permissionMode': 'auto-edit',
                'env': {},
            }
        }
    )

    q = agent.run_prompt(
        prompt,
        options={
            'allowedTools': ['read_file', 'glob', 'grep_search', 'write_file', 'edit_file'],
        },
    )
    await print_query(q)


async def usecase10_abort_controller(args):
    from papert_code_sdk import AbortController

    abort_controller = AbortController()
    q = query(
        prompt='Run a long task and keep reporting progress.',
        options={'abortController': abort_controller},
    )

    async def killer():
        await asyncio.sleep(2)
        abort_controller.abort()

    asyncio.create_task(killer())

    try:
        await print_query(q)
    except Exception as exc:
        if is_abort_error(exc):
            print('Query aborted as expected.')
        else:
            raise


async def usecase11_can_use_tool_callback(args):
    async def can_use_tool(tool_name, tool_input, _ctx=None):
        if tool_name and tool_name.startswith('read_'):
            return {'behavior': 'allow', 'updatedInput': tool_input}
        return {'behavior': 'deny', 'message': 'Write tools denied by host app policy.'}

    q = query(
        prompt='Read package.json and then try writing SUMMARY.md.',
        options={'canUseTool': can_use_tool},
    )
    await print_query(q)


async def prompt_stream(session_id: str) -> AsyncIterator[SDKUserMessage]:
    yield SDKUserMessage(
        type='user',
        session_id=session_id,
        message={'role': 'user', 'content': 'Create 3 TODOs in markdown.'},
        parent_tool_use_id=None,
    )
    yield SDKUserMessage(
        type='user',
        session_id=session_id,
        message={'role': 'user', 'content': 'Now summarize the TODOs in one line.'},
        parent_tool_use_id=None,
    )


async def usecase12_multi_turn_stream(args):
    q = query(
        prompt=prompt_stream('multi-turn-demo'),
        options={'permissionMode': 'auto-edit'},
    )
    await print_query(q)


async def usecase13_client_send(args):
    client = create_client({'cwd': args.cwd, 'permissionMode': 'auto-edit'})
    session = client.create_session(session_id='client-send-demo')

    first = await session.send('Create TODO.md with 3 items.')
    second = await session.send('Summarize TODO.md in 2 bullets.')

    print('first message count:', len(first))
    print('second message count:', len(second))

    await client.close()


async def usecase14_client_stream(args):
    client = create_client({'cwd': args.cwd, 'permissionMode': 'auto-edit'})
    session = client.create_session(session_id='client-stream-demo')

    stream = session.stream('List all Markdown files and provide a short summary.')
    await print_query(stream)

    await session.close()
    await client.close()


async def usecase15_runtime_subagents(args):
    agent_names = [v.strip() for v in args.agents.split(',') if v.strip()]
    agents = [
        {
            'name': name,
            'description': f'Runtime subagent {name}',
            'prompt': f'You are {name}. Focus on concise actionable output.',
        }
        for name in agent_names
    ]

    q = query(
        prompt='Delegate architecture review and return consolidated findings.',
        options={'agents': agents},
    )
    await print_query(q)


USECASES = {
    '01': usecase01_basic,
    '02': usecase02_with_cwd,
    '03': usecase03_with_model,
    '04': usecase04_permission_plan,
    '05': usecase05_allowed_tools,
    '06': usecase06_exclude_tools,
    '07': usecase07_skills_path,
    '08': usecase08_specific_skill,
    '09': usecase09_pdf_to_pptx_skill,
    '10': usecase10_abort_controller,
    '11': usecase11_can_use_tool_callback,
    '12': usecase12_multi_turn_stream,
    '13': usecase13_client_send,
    '14': usecase14_client_stream,
    '15': usecase15_runtime_subagents,
}


async def main() -> None:
    args = build_parser().parse_args()
    fn = USECASES.get(args.usecase)
    if not fn:
        raise ValueError(f'Unknown usecase: {args.usecase}. Available: {", ".join(USECASES.keys())}')
    await fn(args)


if __name__ == '__main__':
    asyncio.run(main())
