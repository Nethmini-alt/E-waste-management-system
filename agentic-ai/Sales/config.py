from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_base_url: str = "http://localhost:5172"
    agent_api_key: str = ""

    # Optional Gemini wiring — same shape as agentic-ai/Planner's config so the two
    # model-backed agents are configured identically (one key per agent, so a busy
    # Planner can't starve Sales's quota).
    #
    # With no key (or no langchain-google-genai installed) this agent still works: every
    # number, feasibility check and ordering comes from the deterministic tools in
    # tools/commercial_tools.py, and only the objective choice + prose are skipped.
    google_api_key: str = ""
    chat_model: str = "gemini-2.5-flash"

    # What the priority queue optimises when no objective is requested and no model is
    # available. "net_value" reproduces the ordering the .NET backend used to apply on
    # its own, so behaviour is unchanged until a key is configured.
    default_priority_objective: str = "net_value"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()