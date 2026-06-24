from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Fintelligent AI"
    debug: bool = False

    supported_timeframes: list[str] = ["1d", "1wk", "1mo"]

    # Zone detection tuning
    base_candle_body_atr_ratio: float = 0.3
    impulse_move_atr_ratio: float = 1.5
    zone_merge_proximity_pct: float = 0.002
    max_zone_lookback: int = 365

    anthropic_api_key: str = ""
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    model_config = {"env_file": ".env"}


settings = Settings()
