from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_base_url: str = "http://localhost:5172"
    agent_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()