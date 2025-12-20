import asyncio
import os
import sys

# Ensure src is in path for local testing
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from papert_code_sdk import query, SDKResultMessage

# Point to the local CLI build if relying on local development
# Adjust this path to where your CLI is built (e.g., packages/cli/dist/index.js)
# For node execution, we might need to prefix "node" in command or wrap it.
# Assuming 'papert' is in PATH or we point to the node script.
PAPERT_CLI_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../cli/dist/index.js'))

async def main():
    print(f"Using CLI at: {PAPERT_CLI_PATH}")
    
    # We need to construct the command to run the JS file with node if it's not a binary
    # The ProcessTransport logic splits simple commands but if we give a path to a JS file
    # we might need to handle it or rely on shebang + chmod + x.
    # For this example, let's assume we pass the node command explicitly if needed
    # but the SDK assumes pathToPapertExecutable is the binary.
    # Let's try to simulate what a user would do or use 'node' as executable and script as arg?
    # The current SDK implementation takes a single path string.
    # Let's create a wrapper script or use 'node' as the executable and pass the script as logic inside transport?
    # Our transport implementation is simple: cmd = [executable] + args.
    # So if we want `node path/to/cli.js`, we need to change how we init Query or Transport.
    # BUT, let's keep it simple: assume `papert` is an alias/shim in PATH.
    
    # For local testing without installing, we can hack the Transport or just point to a wrapper script.
    # Let's create a temporary wrapper script.
    
    q = query(
        prompt="What is 2 + 2? Answer with just the number.",
        options={
            "cwd": os.getcwd(),
            "debug": True,
            # Point to the papert binary in PATH
            "pathToPapertExecutable": "papert" 
        }
    )
    
    try:
        async for message in q:
            if message.type == "assistant":
                print(f"Assistant: {message.message.content}")
            elif message.type == "result":
                if message.is_error:
                    print(f"Error: {message.error}")
                else:
                    print(f"Result: {message.result}")
            elif message.type == "stream_event":
                # handle partials
                pass
    except Exception as e:
        print(f"Query failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
