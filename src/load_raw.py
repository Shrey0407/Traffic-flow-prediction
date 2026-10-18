# src/load_raw.py
"""Read the PEMS-BAY benchmark files (speed table + sensor locations)."""
import numpy as np
import pandas as pd

MPH_TO_KMH = 1.609344


def list_keys(path: str) -> list:
    """Print/return the HDF5 keys inside the file (run this first on Day 2)."""
    with pd.HDFStore(path, mode="r") as store:
        return store.keys()


def _resolve_key(path: str, key: str | None) -> str:
    if key:
        return key
    keys = list_keys(path)
    if len(keys) == 1:
        return keys[0]
    raise ValueError(f"{path} has several keys {keys}. Set 'speed_key' in configs/dataset.json.")


def load_speed_wide(path: str, key: str | None = None) -> pd.DataFrame:
    """
    Wide table: index = timestamp, columns = sensor ids (str), values = speed in km/h.
    Zeros are treated as missing (verify this in Notebook 01) and become NaN.
    """
    wide = pd.read_hdf(path, key=_resolve_key(path, key))
    wide.index = pd.to_datetime(wide.index)
    wide.index.name = "timestamp"
    wide.columns = [str(c) for c in wide.columns]
    wide = wide[~wide.index.duplicated(keep="first")].sort_index()
    wide = wide.replace(0, np.nan) * MPH_TO_KMH
    return wide


def load_speed_table(path: str, key: str | None = None, sensors: list | None = None) -> pd.DataFrame:
    """
    Long table with columns: timestamp, segment_id, speed_kmh (one row per sensor per 5 minutes).
    Pass `sensors` to keep only some columns (the full table is ~17 million rows).
    """
    wide = load_speed_wide(path, key)
    if sensors is not None:
        wide = wide[[str(s) for s in sensors]]
    long = wide.reset_index().melt(id_vars="timestamp", var_name="segment_id", value_name="speed_kmh")
    return long.sort_values(["segment_id", "timestamp"]).reset_index(drop=True)


def read_sensor_locations(path: str) -> pd.DataFrame:
    """
    Return columns: sensor_id (str), latitude, longitude.
    Handles both layouts: with a header (index,sensor_id,latitude,longitude) and without one
    (sensor_id,latitude,longitude). Check the result in Notebook 01.
    """
    probe = pd.read_csv(path, header=None, dtype=str, nrows=1).iloc[0].tolist()

    def is_number(x):
        try:
            float(x)
            return True
        except (TypeError, ValueError):
            return False

    if not all(is_number(v) for v in probe):          # first row is a header
        df = pd.read_csv(path)
        df.columns = [c.strip().lower() for c in df.columns]
    else:                                              # no header
        df = pd.read_csv(path, header=None)
        if df.shape[1] == 3:
            df.columns = ["sensor_id", "latitude", "longitude"]
        elif df.shape[1] == 4:
            df.columns = ["index", "sensor_id", "latitude", "longitude"]
        else:
            raise ValueError(f"Unexpected number of columns ({df.shape[1]}) in {path}")

    try:
        df["sensor_id"] = df["sensor_id"].astype("int64").astype(str)
    except (TypeError, ValueError):
        df["sensor_id"] = df["sensor_id"].astype(str)
    return df[["sensor_id", "latitude", "longitude"]]
