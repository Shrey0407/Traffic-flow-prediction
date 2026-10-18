# src/weather.py
"""Hourly weather from the Open-Meteo Historical Weather API (free, no key). Guide 7.7."""
from pathlib import Path

import pandas as pd
import requests

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def fetch_weather(lat: float, lon: float, start: str, end: str, tz: str) -> pd.DataFrame:
    """start/end as 'YYYY-MM-DD'. Returns hourly weather with a 'timestamp' column (local time)."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start,
        "end_date": end,
        "hourly": "temperature_2m,relative_humidity_2m,precipitation",
        "timezone": tz,
    }
    r = requests.get(ARCHIVE_URL, params=params, timeout=60)
    r.raise_for_status()
    h = r.json()["hourly"]
    return pd.DataFrame({
        "timestamp": pd.to_datetime(h["time"]),
        "temperature": h["temperature_2m"],
        "humidity": h["relative_humidity_2m"],
        "precipitation": h["precipitation"],
    })


def get_weather(lat: float, lon: float, start: str, end: str, tz: str, cache_dir: str = "data/raw") -> pd.DataFrame:
    """Download once, then reuse the cached CSV: data/raw/weather_<start>_<end>.csv"""
    cache = Path(cache_dir) / f"weather_{start}_{end}.csv"
    if cache.exists():
        df = pd.read_csv(cache, parse_dates=["timestamp"])
    else:
        df = fetch_weather(lat, lon, start, end, tz)
        cache.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(cache, index=False)
    return df.drop_duplicates("timestamp").reset_index(drop=True)
