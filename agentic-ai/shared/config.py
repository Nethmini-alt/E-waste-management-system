"""Runtime settings for the whole agentic-ai service (one .env for all four agents)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ASP.NET Core API (backend launchSettings.json -> http://localhost:5172)
    api_base_url: str = "http://localhost:5172"
    # Shared secret. Used BOTH inbound (.NET -> this service) and outbound (agents -> .NET) as X-Agent-Key.
    # Empty = the service refuses every request (safe default).
    agent_api_key: str = ""

    # Tool-call safety limits
    tool_timeout_seconds: float = 5.0
    tool_max_retries: int = 2  # retries AFTER the first attempt (so up to 3 tries)

    # LLM (Gemini). Empty key -> Analyzer records a safe failure; Matcher/Planner run deterministically.
    gemini_api_key: str = ""
    gemini_model: str = "models/gemini-3.1-flash-lite-preview"  # override via GEMINI_MODEL
    llm_timeout_seconds: float = 20.0
    llm_max_attempts: int = 2

    # Analyzer image intake (SSRF / abuse limits)
    image_host_allowlist: str = ""   # comma-separated hostnames; the API host is always allowed
    max_images: int = 4
    max_image_bytes: int = 4_000_000
    image_timeout_seconds: float = 8.0

    # Workflow runtime
    workflow_timeout_seconds: float = 120.0
    max_concurrent_workflows: int = 4
    max_revisions: int = 3
    report_to_backend: bool = False  # set true once the .NET workflow endpoints exist (BACKEND_CONTRACT.md)

    @property
    def allowed_image_hosts(self) -> set[str]:
        return {h.strip().lower() for h in self.image_host_allowlist.split(",") if h.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
