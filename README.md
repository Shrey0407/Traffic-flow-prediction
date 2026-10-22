# Traffic Flow Prediction: 2-hour-ahead speed forecasting (PEMS-BAY)

**Question.** Given what is known about a road segment at hour *t* (its recent speeds, the weather, and the
calendar), how fast will traffic move on that segment at hour *t* + 2?

- **Row unit:** one road sensor (segment) at one hour.
- **Target:** average speed (km/h) two hours later (`target_2h`).
- **Metric:** MAE in km/h (primary), RMSE, and skill = 1 - MAE_model / MAE_persistence. 95% intervals use a daily block bootstrap.
- **Baselines to beat:** persistence and the hour-of-week mean.
- **Data:** PEMS-BAY, Bay Area freeway detectors (Caltrans PeMS), 5-minute speeds, via the DCRNN repository.
  Weather from Open-Meteo. Holidays from the Python `holidays` package.
- **Live site:** https://shrey0407.github.io/traffic-flow-prediction/

## The honest finding

Test block 2017-05-26 to 2017-06-30 (6,872 rows). The selected model is the **voting_ensemble**
(random forest + XGBoost + decision tree), chosen as the lowest validation MAE among the trained models by a rule fixed in advance.

- It beats persistence by a wide margin: test MAE 2.558 vs 5.008 km/h, skill 0.489.
- It does **not** beat the hour-of-week mean: test MAE 2.558 vs 2.436 km/h
  (difference +0.122 km/h, 95% interval -0.001 to +0.232, which includes zero).
  On validation it is also worse (2.551 vs 2.342 km/h). No trained model beat hour-of-week on validation.
- The weekly pattern (segment, weekday, hour) already explains most of the predictable signal at this horizon.

Results table (km/h; "n/a": only the selected model and the two baselines were scored on test, by design):

| Model | Val MAE | Test MAE | Test RMSE | Skill vs persistence | 95% CI (test MAE) |
|---|---|---|---|---|---|
| linear | 4.977 | n/a | n/a | n/a | - |
| ridge | 4.977 | n/a | n/a | n/a | - |
| lasso | 4.950 | n/a | n/a | n/a | - |
| decision_tree | 2.907 | n/a | n/a | n/a | - |
| random_forest | 2.573 | n/a | n/a | n/a | - |
| xgboost | 2.615 | n/a | n/a | n/a | - |
| **voting_ensemble** (selected) | 2.551 | 2.558 | 5.239 | 0.489 | 2.251 to 2.854 |
| persistence | 5.366 | 5.008 | 10.906 | 0.000 | - |
| hour_of_week | 2.342 | 2.436 | 5.174 | 0.514 | - |

Values are read from `results/` and `docs/data/metrics.json` (written by `src/05_export_site.py`).

## Disclosure about the test run

Model selected on validation MAE (voting_ensemble, 2.551) on Oct 21, before any test run. On Oct 22, `04_final_test.py` and `05_export_site.py` were run once, earlier than planned, following an AI coding assistant's step. `03_train_select.py` was re-run at 11:22 and reproduced the same selection (deterministic seed). No model, feature or hyperparameter change was made after test results existed.

Because the test run was not sealed, the test numbers are reported as they are and listed as a limitation.

## Setup (Windows PowerShell, from the project folder)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -c "import pandas, sklearn, xgboost, holidays, tables, pyarrow; print('ok')"
```

Python 3.11 or newer. Random seed: `random_state=0` everywhere.
**pandas must be below 3** (`requirements.txt` pins it): pandas 3 cannot read `pems-bay.h5` through PyTables.

## Data

Follow `data/raw/SOURCES.md`. Put these two files in `data/raw/` without renaming them:

- `pems-bay.h5` (Google Drive link in the DCRNN README, https://github.com/liyaguang/DCRNN)
- `graph_sensor_locations_bay.csv` (`data/sensor_graph/` folder of the DCRNN repository)

`data/raw/` and `data/processed/` are **not in Git**. The weather CSV is downloaded and cached on the first build.

## Run order (from the repository root)

```powershell
python src/01_build_dataset.py     # Stage 2: hourly table, segments, neighbours, weather, holidays
python src/02_features_split.py    # Stage 3: features, 60/20/20 split with 2-hour gaps
python src/baselines.py            # Persistence and hour-of-week MAE (validation and test)
python src/03_train_select.py      # Stage 4: tune on training folds, select on validation
python src/04_final_test.py        # Stage 5: refit on train+val, ONE test run
python src/05_export_site.py       # Stage 6: JSON for the website
pytest src/tests                   # Leakage checks (8 tests)
```

Run Stage 5 once, after `configs/final_model.json` is frozen. Notebooks 01 to 04 document each step; 03 and 04 only read saved results for the test block.

Preview the website locally (the JSON needs a web server, `file://` will not work):

```powershell
python -m http.server 8000 --directory docs      # then open http://localhost:8000
```

## Repository layout

```
configs/    dataset.json (edit), split.json and final_model.json (written by the stages)
data/       raw/ and processed/ (not committed)
src/        pipeline code; tests/ holds the leakage tests
notebooks/  01 data understanding, 02 baselines and models, 03 validation and test, 04 errors and limitations
results/    metrics, breakdowns, figures (data_quality/ feeds the website's Data page)
docs/       static website for GitHub Pages (index.html, css/, js/, img/, data/)
```

## Design choices worth knowing

- **Hourly rule:** an hour with fewer than 9 of 12 valid 5-minute readings is set to missing. Zero speeds are treated as missing.
- **Segments:** 8 sensors with at least 95% hourly coverage, spread by longitude. The chosen IDs are in `configs/dataset.json` and frozen.
- **Neighbours:** the 3 nearest eligible sensors (haversine distance), speeds taken at the same hour *t*. Distance is not road connectivity, so this is a proxy.
- **Split:** chronological 60/20/20 with a 2-hour gap (20,584 train / 6,848 validation / 6,872 test rows).
- **No leakage:** all features use hour *t* or earlier; imputation and scaling are fitted inside pipelines on training data only.
- **Selection rule:** lowest validation MAE among trained models; baselines are not candidates.

## Limitations (summary)

One network and one half-year; sensor quality (zeros as missing, a network-wide feed outage on 2017-06-15, a frozen feed on segment 400100); no incident or event data; weather is observed at *t*, not forecast; distribution shift across seasons; association, not causation; the test run was not sealed; and no trained model beat hour-of-week. Details are on the website and in notebook 04.

## AI use and contributions

An AI assistant (Claude) was used for planning, scaffolding, explanations and drafting. See `AI_USE.md` for what it did and how each output was checked, and `CONTRIBUTION_LOG.md` for the dated log.

## Citations

Li, Y., Yu, R., Shahabi, C., Liu, Y. (2018). Diffusion Convolutional Recurrent Neural Network: Data-Driven Traffic Forecasting. ICLR 2018. Caltrans PeMS. Open-Meteo historical weather API. `holidays`, scikit-learn, XGBoost, Chart.js.
