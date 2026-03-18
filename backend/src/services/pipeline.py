# services/pipeline.py

import asyncio
from services.agent_factory import AgentFactory
from services.config.config_manager import ConfigManager
from services.memory.memory_store import MemoryStore
from services.memory.memory_manager import MemoryManager
from services.memory.memory_repository import MemoryRepository
from services.memory.memory_schemas import MemoryEntry


class Pipeline:
    def __init__(self):
        # Load pipeline config directly from YAML (not as AgentConfig)
        import yaml
        from pathlib import Path
        pipeline_path = Path("config/agents/pipeline.yaml")
        with open(pipeline_path) as f:
            self.pipeline_config = yaml.safe_load(f)
        self.memory_repo = MemoryRepository()

    async def run(self, input_data: dict, project_id: str = None) -> dict:
        """
        Execute the full agent pipeline.

        Args:
            input_data: Initial state dict passed to the first agent.
            project_id: Optional. When provided, enables persistent memory
                        across pipeline runs for the same project.

        Returns:
            Final state dict with all agent outputs.
        """
        state = input_data
        memory_store = MemoryStore()
        memory_manager = MemoryManager(memory_store)

        # Load prior memory from DB if project scope is provided
        if project_id:
            await self._load_persisted_memory(memory_store, project_id)

        # 2. Execute agent with memory injected
        max_parallel = self.pipeline_config.get("settings", {}).get("max_parallelism", 2)
        semaphore = asyncio.Semaphore(max_parallel)

        for step in self.pipeline_config["steps"]:
            agent = AgentFactory.create(step["agent"])

            # 1. Read memory slice for this agent (config-driven)
            agent_memory_config = None
            if hasattr(agent, "config") and isinstance(agent.config, dict):
                memory_raw = agent.config.get("memory")
                if memory_raw:
                    from services.memory.memory_schemas import MemoryConfig
                    agent_memory_config = MemoryConfig(**memory_raw)

            memory_slice = await memory_manager.read_for_agent(agent_memory_config)

            # 2. Execute agent with memory injected
            if step.get("mode") == "parallel":
                async def execute_with_semaphore(item):
                    async with semaphore:
                        return await agent.execute_async(
                            step["task"], item, memory=memory_slice
                        )
                
                results = await asyncio.gather(*[
                    execute_with_semaphore(item)
                    for item in state[step["input_key"]]
                ])
                state[step["output_key"]] = results
            else:
                result = await agent.execute_async(
                    step["task"], state, memory=memory_slice
                )
                state[step["output_key"]] = result

            # Optional: compress output before passing forward
            if "compression" in step:
                from services.context.context_compressor import compress
                state[step["output_key"]] = compress(
                    state[step["output_key"]],
                    strategy=step["compression"].get("strategy", "none"),
                    params=step["compression"].get("params", {})
                )

            # 3. Write output to runtime memory
            output = state[step["output_key"]]
            await memory_manager.write_from_agent(
                agent_memory_config, step["agent"], output
            )

            # 4. Persist to database if project_id provided
            if project_id:
                await self._persist_step_memory(
                    project_id,
                    step["agent"],
                    step.get("output_key", step["agent"]),
                    output,
                )

        return state

    async def _load_persisted_memory(
        self, store: MemoryStore, project_id: str
    ) -> None:
        """Load all prior memory entries for this project into the runtime store."""
        entries = await self.memory_repo.get_by_project(project_id)
        for entry in entries:
            await store.set(entry.memory_key, entry.content)

    async def _persist_step_memory(
        self,
        project_id: str,
        agent_name: str,
        memory_key: str,
        content,
    ) -> None:
        """Persist a single step's output to the database."""
        entry = MemoryEntry(
            project_id=project_id,
            agent_name=agent_name,
            memory_key=memory_key,
            content=content if isinstance(content, dict) else {"data": content},
        )
        await self.memory_repo.save(entry)
