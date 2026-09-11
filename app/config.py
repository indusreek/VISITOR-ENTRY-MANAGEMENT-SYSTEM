from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = "visitor-entry-dev-secret-change-in-production"
    access_token_expire_minutes: int = 480
    algorithm: str = "HS256"
    database_url: str = "sqlite:///./visitor_entry.db"


settings = Settings()
