# src/uncertainty.py
"""Block bootstrap confidence interval for MAE (Guide 8.4).

Errors on neighbouring hours are correlated, so whole days are resampled together
instead of single rows.
"""
import numpy as np
import pandas as pd


def bootstrap_mae_ci(abs_err, block_labels, n_boot: int = 2000, alpha: float = 0.05, seed: int = 0):
    """Return (low, high) of the (1 - alpha) interval for MAE, resampling blocks (e.g. days)."""
    rng = np.random.default_rng(seed)
    abs_err = np.asarray(abs_err, dtype=float)
    inv, uniq = pd.factorize(np.asarray(block_labels))
    sums = np.bincount(inv, weights=abs_err)
    counts = np.bincount(inv).astype(float)
    n_blocks = len(uniq)

    maes = np.empty(n_boot)
    for b in range(n_boot):
        pick = rng.integers(0, n_blocks, n_blocks)
        maes[b] = sums[pick].sum() / counts[pick].sum()
    return (float(np.percentile(maes, 100 * alpha / 2)),
            float(np.percentile(maes, 100 * (1 - alpha / 2))))
