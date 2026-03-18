# services/memory/memory_manager.py

from typing import Any, Dict, Optional
from services.memory.memory_store import MemoryStore
from services.memory.memory_schemas import MemoryConfig
from services.context.context_compressor import compress


class MemoryManager:
    """
    Orchestrates reading from and writing to MemoryStore
    based on agent-specific MemoryConfig.

    All behavior is config-driven — no hardcoded agent names or keys.
    """

    def __init__(self, store: MemoryStore):
        self.store = store

    async def read_for_agent(
        self, memory_config: Optional[MemoryConfig]
    ) -> Dict[str, Any]:
        """
        Read memory slice for an agent based on its config.
        Returns dict of {key: value} pairs the agent is allowed to see.
        """
        if memory_config is None or memory_config.read is None:
            return {}

        read_config = memory_config.read
        strategy = read_config.strategy

        if strategy == "none":
            return {}

        raw_memory = {}
        if strategy == "all":
            raw_memory = await self.store.export()
        elif strategy in ["selective", "top_k"]:
            keys = read_config.keys or []
            # If keys is a dict (like in top_k: keys: {problems: 3}), extract the keys list
            if isinstance(keys, dict):
                keys_list = list(keys.keys())
            else:
                keys_list = keys
            raw_memory = await self.store.get_many(keys_list)
            
        # If strategy is selective, no compression needed (unless params say otherwise, but standard selective is just filtering)
        if strategy == "selective":
            return raw_memory
            
        # Apply context compression based on strategy and params
        params = getattr(read_config, "params", {}) or {}
        if strategy == "top_k":
            # Pass keys down in params for specific k values if keys was a dict
            if isinstance(read_config.keys, dict):
                params["keys"] = read_config.keys
            
        return compress(raw_memory, strategy, params)

    async def write_from_agent(
        self,
        memory_config: Optional[MemoryConfig],
        agent_name: str,
        output: Any,
    ) -> None:
        """
        Write agent output to memory based on its config.
        Supports overwrite, append, and merge modes.
        """
        if memory_config is None or memory_config.write is None:
            return

        write_config = memory_config.write
        key = write_config.key

        if key is None:
            return

        mode = write_config.mode

        if mode == "overwrite":
            await self.store.set(key, output)
        elif mode == "append":
            await self.store.add(key, output)
        elif mode == "merge":
            existing = await self.store.get(key, {})
            if isinstance(existing, dict) and isinstance(output, dict):
                merged = {**existing, **output}
                await self.store.set(key, merged)
            else:
                # Fallback to overwrite if types don't support merge
                await self.store.set(key, output)
