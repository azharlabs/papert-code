# papert-code-sdk

A minimum experimental Python SDK for programmatic access to Papert Code.

## Installation

```bash
pip install papert-code-sdk
```

## Quick Start

```python
import asyncio
from papert_code_sdk import query

async def main():
    q = query(prompt="What files are in the current directory?", options={"cwd": "."})
    
    async for message in q:
        if message.type == "assistant":
            print(f"Assistant: {message.message.content}")
        elif message.type == "result":
            print(f"Result: {message.result}")

if __name__ == "__main__":
    asyncio.run(main())
```
