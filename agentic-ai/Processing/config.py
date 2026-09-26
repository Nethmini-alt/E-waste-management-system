from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_base_url: str = "http://localhost:5172"
    agent_api_key: str = ""
    # No GOOGLE_API_KEY here on purpose — Validator is deterministic by design
    # (spec section 9.1: "deterministic checks such as schema or business-rule
    # validation", and section 12's Agent Evaluation rule that rule-based
    # assertions must not be replaced by LLM-as-judge alone).

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
