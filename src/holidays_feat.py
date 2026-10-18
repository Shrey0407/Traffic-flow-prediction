# src/holidays_feat.py
"""Public-holiday indicator (Guide 7.8)."""
import holidays


def add_holiday_flag(df, country: str = "US", subdiv: str | None = None):
    """Adds is_holiday = 1 on public holidays for the chosen country (and optional subdivision)."""
    hol = holidays.country_holidays(country, subdiv=subdiv)
    df = df.copy()
    df["is_holiday"] = df["timestamp"].dt.date.map(lambda d: int(d in hol))
    return df
