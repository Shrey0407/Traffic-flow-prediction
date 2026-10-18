# src/neighbours.py
"""Nearest-sensor lists and the neighbour-speed feature (Guide 7.6)."""
import numpy as np
import pandas as pd


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = p2 - p1
    dlmb = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))


def nearest_neighbours(locs: pd.DataFrame, k: int = 3, targets: list | None = None) -> dict:
    """
    locs columns: sensor_id, latitude, longitude (the candidate neighbours).
    targets: sensors to build lists for (default: all). Returns {sensor_id: [k nearest ids]}.
    """
    ids = locs["sensor_id"].astype(str).tolist()
    lat, lon = locs["latitude"].to_numpy(), locs["longitude"].to_numpy()
    targets = ids if targets is None else [str(t) for t in targets]
    out = {}
    for sid in targets:
        i = ids.index(sid)
        d = haversine_km(lat[i], lon[i], lat, lon)
        order = np.argsort(d)
        out[sid] = [ids[j] for j in order if j != i][:k]
    return out


def add_neighbour_speed(hourly: pd.DataFrame, neigh: dict, pivot: pd.DataFrame | None = None) -> pd.DataFrame:
    """
    Adds neighbour_speed_t = mean speed of the k nearest sensors at the SAME hour t.
    `pivot` (timestamp x sensor, hourly) should hold ALL candidate neighbours, not only
    the chosen segments. If omitted it is built from `hourly`.
    """
    if pivot is None:
        pivot = hourly.pivot(index="timestamp", columns="segment_id", values="speed_kmh")
    nb_mean = {}
    for sid, nbs in neigh.items():
        cols = [c for c in nbs if c in pivot.columns]
        nb_mean[sid] = pivot[cols].mean(axis=1) if cols else pd.Series(np.nan, index=pivot.index)
    nb = pd.DataFrame(nb_mean)
    nb.index.name = "timestamp"
    nb = nb.reset_index().melt(id_vars="timestamp", var_name="segment_id", value_name="neighbour_speed_t")
    nb["segment_id"] = nb["segment_id"].astype(str)
    return hourly.merge(nb, on=["timestamp", "segment_id"], how="left")
