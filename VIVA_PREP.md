# Viva preparation (draft: rewrite in your own words)

Read this once, then close it and explain each answer out loud. Numbers below are from `results/` and `docs/data/`.
Note: the 14 topics follow the project's stages. Section 11 of the course guide was not available to me when this was written, so check the list against it.

## The 14 topics

1. **What is the question?** Predict the average speed on a road segment two hours ahead (`target_2h`), per segment per hour, using only what is known at hour *t*. Why: people plan ahead, and 2 h is far enough that "speed now" is not enough.
2. **What data?** PEMS-BAY: 325 freeway sensors, 5-minute speeds in mph, Jan to Jun 2017, from Caltrans PeMS via the DCRNN repository. Weather from Open-Meteo, holidays from the `holidays` package.
3. **Units and time.** mph times 1.609344 gives km/h. Timestamps are local time: the DST gap on 12 March (one hour missing) and the weekday rush-hour dips prove it.
4. **Missing data.** Missing is stored as zero (about 0.003% of readings), not blank, so zeros become NaN. On 2017-06-15 around 01:00 two thirds of sensors read zero together, a feed outage. An hour is kept only if at least 9 of 12 five-minute readings exist.
5. **Why 8 segments?** At least 95% coverage, spread by longitude, explainable, and frozen in `configs/dataset.json` before modelling. Segment 400100 has a frozen feed (the same value for 10 to 24 hours); it was kept and listed as a limitation.
6. **Neighbours.** The 3 nearest sensors by latitude/longitude distance, same hour *t*. Limit: distance is not road connectivity.
7. **Features and leakage.** 16 features: lags (1, 2, 24, 168 h), rolling means ending at *t*, neighbour speed, weather at *t*, calendar fields. Leakage means using information from after *t*; the target is a label only. `src/tests` checks this.
8. **Split.** Chronological 60/20/20 with 2-hour gaps: 20,584 train, 6,848 validation, 6,872 test rows. The gap stops a row's target from landing in the next block. A random split would leak the future.
9. **Baselines.** Persistence (speed now) and hour-of-week mean (average for this segment, weekday, hour in training data). They matter because a model is only useful if it beats them.
10. **Models.** Linear, Ridge (L2), Lasso (L1), decision tree, random forest (average of trees), XGBoost (trees fitted to the remaining errors), voting ensemble (average of random forest, XGBoost and decision tree). Not used: SVR, MLP, LSTM (scale, tuning, explainability for this data size).
11. **Tuning, selection, test.** Tuning: forward-chaining folds inside training. Selection: lowest validation MAE among trained models (baselines are not candidates). Test: reported once. Imputer and scaler live inside the pipeline so they are fitted on training data only.
12. **Metrics.** MAE (km/h, primary, easy to read), RMSE (punishes big misses), skill = 1 - MAE_model / MAE_persistence. Uncertainty: a daily block bootstrap (errors in nearby hours are correlated, so whole days are resampled).
13. **Results (honest).** Validation: hour-of-week 2.342 < voting_ensemble 2.551 < random_forest 2.573 < xgboost 2.615. Test: voting_ensemble 2.558 (95% 2.251 to 2.854), hour-of-week 2.436, persistence 5.008. Skill vs persistence 0.489. The model is much better than persistence and **not** better than hour-of-week; the paired difference is +0.122 km/h (95% interval -0.001 to +0.232, includes zero). Meaning: the weekly pattern already carries most of the signal.
14. **Errors and limitations.** Biggest misses are sudden events (crash-like drops), a holiday, a frozen feed. Rush hours are harder than off-peak. One network, one half-year; no incident data; weather observed not forecast; association not causation; the test run was not sealed.

## Five likely "small change" questions

1. *Predict one hour ahead instead of two.* Change `HORIZON` in `src/features.py` (the split gap should follow), rebuild with `02_features_split.py`, retrain. All numbers change.
2. *Keep an hour with only 6 of 12 readings.* `min_readings_per_hour` in `configs/dataset.json`, then re-run `01_build_dataset.py`. Expect fewer missing hours, noisier averages.
3. *Add a feature (for example rolling 6-hour mean).* Add it in `build_features` and to `FEATURES` in `src/features.py`; it must only use data up to *t*. Re-run stages 02 to 03. Do not look at test results to decide.
4. *Use 10 segments.* `n_segments` in `configs/dataset.json`, re-run from stage 01. Check coverage and neighbours again.
5. *Change the split to 70/15/15.* Fractions in `chronological_split` (`src/split.py`); keep the gap. Re-run from stage 02.

## The honest-disclosure question: "Did you touch the test set early?"

Yes, and I say so. Model selected on validation MAE (voting_ensemble, 2.551) on Oct 21, before any test run. On Oct 22, 04_final_test.py and 05_export_site.py were run once, earlier than planned, following an AI coding assistant's step. 03_train_select.py was re-run at 11:22 and reproduced the same selection (deterministic seed). No model, feature or hyperparameter change was made after test results existed. The selection rule was fixed in advance, so nothing was chosen using the test numbers, but the test block is no longer sealed, and that is listed as a limitation.

## What each file does

- `src/01_build_dataset.py`: raw file to hourly table, chooses segments, neighbours, weather, holidays (`load_raw.py`, `hourly.py`, `neighbours.py`, `weather.py`, `holidays_feat.py`).
- `src/features.py`: lags, rolling means, calendar fields, the 2-hour-ahead target.
- `src/02_features_split.py` with `split.py`: builds features and writes train/val/test with gaps.
- `src/baselines.py`: persistence and hour-of-week.
- `src/models.py`: all candidate models, `apply_params`, the voting ensemble.
- `src/03_train_select.py`: tunes on training folds, scores validation, writes `configs/final_model.json`.
- `src/04_final_test.py`: refits the frozen model on train + validation, scores test once, bootstrap interval (`uncertainty.py`, `evaluate.py`).
- `src/05_export_site.py`: writes the JSON the website reads (`docs/data/`).
- `src/tests/`: leakage and pipeline checks (8 tests).
- `notebooks/01` to `04`: data checks, baselines and models, validation and test, errors and limitations.
