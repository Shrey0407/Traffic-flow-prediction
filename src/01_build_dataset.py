# src/01_build_dataset.py
"""Stage 2: raw PEMS-BAY files -> hourly modelling table.  Run from the repo root:
    python src/01_build_dataset.py
"""
import json
import os
from pathlib import Path

import pandas as pd

os.chdir(Path(__file__).resolve().parents[1])

from holidays_feat import add_holiday_flag
from hourly import eligible_locations, pick_spread, to_hourly_wide, wide_to_long
from load_raw import load_speed_wide, read_sensor_locations
from neighbours import add_neighbour_speed, nearest_neighbours
from weather import get_weather

CFG_PATH = Path("configs/dataset.json")
cfg = json.loads(CFG_PATH.read_text())
Path("results/data_quality").mkdir(parents=True, exist_ok=True)
Path("data/processed").mkdir(parents=True, exist_ok=True)

# 1. Load, convert mph -> km/h, zeros -> NaN
wide = load_speed_wide(cfg["speed_file"], cfg["speed_key"])
print(f"Raw table: {wide.shape[0]} timestamps x {wide.shape[1]} sensors, "
      f"{wide.index.min()} to {wide.index.max()}")

# 2. Hourly resampling with the coverage rule (fewer than 9 of 12 readings -> NaN)
hourly_wide, stats = to_hourly_wide(wide, cfg["min_readings_per_hour"])
print("Hourly build:", stats)
Path("results/data_quality/hourly_build_log.json").write_text(json.dumps(stats, indent=2))

# 3. Segment selection (coverage >= min_coverage, spread by longitude), frozen in the config
locs = read_sensor_locations(cfg["sensor_locations_file"])
locs = locs[locs["sensor_id"].isin(hourly_wide.columns)]
coverage, elig = eligible_locations(hourly_wide, locs, cfg["min_coverage"])
print(f"{len(elig)} of {len(hourly_wide.columns)} sensors have coverage >= {cfg['min_coverage']}")

if cfg["segments"]:
    chosen = [str(s) for s in cfg["segments"]]
    missing = [s for s in chosen if s not in set(locs["sensor_id"])]
    if missing:
        raise SystemExit(f"Segments {missing} are not in the sensor location file or the speed file.")
    print("Using the segments already recorded in configs/dataset.json:", chosen)
else:
    chosen = pick_spread(elig, cfg["n_segments"])
    cfg["segments"] = chosen
    CFG_PATH.write_text(json.dumps(cfg, indent=2))
    print("Selected segments (written to configs/dataset.json):", chosen)

# 4. Neighbours: nearest sensors among ALL eligible sensors, speed taken at the SAME hour t
nb_locs = locs[locs["sensor_id"].isin(set(elig["sensor_id"]) | set(chosen))]
neigh = nearest_neighbours(nb_locs, k=cfg["n_neighbours"], targets=chosen)
hourly = wide_to_long(hourly_wide[chosen])
hourly = add_neighbour_speed(hourly, neigh, pivot=hourly_wide)

# 5. Weather (Open-Meteo archive, cached in data/raw/)
chosen_locs = locs[locs["sensor_id"].isin(chosen)]
lat = cfg["city_lat"] if cfg["city_lat"] is not None else float(chosen_locs["latitude"].mean())
lon = cfg["city_lon"] if cfg["city_lon"] is not None else float(chosen_locs["longitude"].mean())
start = hourly["timestamp"].min().date().isoformat()
end = hourly["timestamp"].max().date().isoformat()
print(f"Weather for ({lat:.3f}, {lon:.3f}), {start} to {end}, {cfg['timezone']}")
weather = get_weather(lat, lon, start, end, cfg["timezone"])
hourly = hourly.merge(weather, on="timestamp", how="left")
weather_nan = {c: int(hourly[c].isna().sum()) for c in ["temperature", "humidity", "precipitation"]}
print("Weather NaN count after merge:", weather_nan)

# 6. Holidays
hourly = add_holiday_flag(hourly, cfg["holiday_country"], cfg.get("holiday_subdiv"))

# 7. Save
hourly = hourly.sort_values(["segment_id", "timestamp"]).reset_index(drop=True)
hourly.to_parquet("data/processed/hourly.parquet", index=False)

summary = {
    "dataset": cfg["dataset_name"],
    "segments": chosen,
    "rows": int(len(hourly)),
    "start": str(hourly["timestamp"].min()),
    "end": str(hourly["timestamp"].max()),
    "speed_missing_rate": float(hourly["speed_kmh"].isna().mean()),
    "weather_nan": weather_nan,
    "neighbours": neigh,
    "weather_lat": lat,
    "weather_lon": lon,
}
Path("results/data_quality/build_summary.json").write_text(json.dumps(summary, indent=2))
print(hourly.shape, hourly["segment_id"].nunique(), "segments")
