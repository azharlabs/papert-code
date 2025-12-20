import asyncio
import json
import logging
import os
import shutil
import subprocess
from typing import Optional, Dict, List, AsyncIterator, Any
import signal

from .protocol import SDKMessage

logger = logging.getLogger(__name__)

class ProcessTransport:
    def __init__(
        self,
        path_to_papert_executable: Optional[str] = None,
        cwd: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        debug: bool = False,
        model: Optional[str] = None,
        permission_mode: Optional[str] = None,
    ):
        self.path_to_papert_executable = path_to_papert_executable or "papert"
        self.cwd = cwd or os.getcwd()
        self.env = {**os.environ, **(env or {})}
        self.debug = debug
        self.model = model
        self.permission_mode = permission_mode
        
        self.process: Optional[asyncio.subprocess.Process] = None
        self.closed = False

    async def initialize(self):
        """Initializes the subprocess."""
        args = self._build_cli_arguments()
        
        # Resolve executable path
        executable = shutil.which(self.path_to_papert_executable)
        if not executable:
             # Fallback to direct path or node execution if simple name lookup fails
             # This is a simplification; a more robust logic like in TS SDK might be needed 
             executable = self.path_to_papert_executable

        cmd = [executable] + args
        
        logger.debug(f"Spawning CLI: {cmd}")
        
        try:
            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE if self.debug else asyncio.subprocess.DEVNULL,
                cwd=self.cwd,
                env=self.env,
                preexec_fn=os.setsid, # Create a new process group for cleaner termination
            )
            
            if self.debug and self.process.stderr:
                asyncio.create_task(self._read_stderr())
                
        except Exception as e:
            logger.error(f"Failed to spawn CLI: {e}")
            raise

    def _build_cli_arguments(self) -> List[str]:
        args = [
            '--input-format', 'stream-json',
            '--output-format', 'stream-json',
        ]
        
        if self.model:
            args.extend(['--model', self.model])
            
        if self.permission_mode:
            args.extend(['--approval-mode', self.permission_mode])
            
        # Add other args as needed (max-turns, etc.)
        
        return args

    async def _read_stderr(self):
        """Reads stderr and logs it."""
        if not self.process or not self.process.stderr:
            return
            
        while True:
            line = await self.process.stderr.readline()
            if not line:
                break
            logger.debug(f"CLI STDERR: {line.decode().strip()}")

    async def write(self, message: str):
        """Writes a string to the subprocess stdin."""
        if not self.process or not self.process.stdin:
            raise RuntimeError("Process not initialized or stdin not available")
            
        if self.closed:
            raise RuntimeError("Transport is closed")
            
        logger.debug(f"Writing to stdin: {message.strip()}")
        self.process.stdin.write(message.encode('utf-8'))
        self.process.stdin.write(b'\n')
        await self.process.stdin.drain()

    async def read_messages(self) -> AsyncIterator[Dict[str, Any]]:
        """Reads JSON lines from stdout and yields parsed objects."""
        if not self.process or not self.process.stdout:
            raise RuntimeError("Process not initialized or stdout not available")

        while True:
            line = await self.process.stdout.readline()
            if not line:
                break
                
            line_str = line.decode('utf-8').strip()
            if not line_str:
                continue
                
            try:
                yield json.loads(line_str)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON line: {line_str}, Error: {e}")

        # Wait for process to exit to clean up zombies
        await self.process.wait()

    async def close(self):
        """Closes the transport and terminates the process."""
        if self.closed:
            return
            
        self.closed = True
        
        if self.process:
            if self.process.stdin:
                try:
                    self.process.stdin.close()
                    await self.process.stdin.wait_closed()
                except Exception:
                    pass

            # Terminate process group
            try:
                os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass # Already dead
            except Exception as e:
                logger.warning(f"Error terminating process group: {e}")
                
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning("Process did not exit, force killing")
                try:
                    os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                except:
                    pass
            
            self.process = None
