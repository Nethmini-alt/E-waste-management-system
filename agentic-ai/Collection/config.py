from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_base_url: str = "http://localhost:5172"
    agent_api_key: str = ""
    # No GOOGLE_API_KEY — collector ranking is deterministic scoring (distance,
    # capacity, rating), matching how compare_commercial_options in Sales/ works.

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
