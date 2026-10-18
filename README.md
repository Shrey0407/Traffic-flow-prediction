# Traffic Flow Prediction: 2-hour-ahead speed forecasting (PEMS-BAY)

**Question.** Given what is known about a road segment at hour *t* (its recent speeds, the weather, and the
calendar), how fast will traffic move on that segment at hour *t* + 2?

- **Row unit:** one road sensor (segment) at one hour.
- **Target:** average speed (km/h) two hours later.
- **Metric:** MAE in km/h. Baselines to beat: persistence and the hour-of-week mean.
- **Data:** PEMS-BAY, Bay Area highway detectors (Caltrans PeMS), 5-minute speeds, via the DCRNN repository.
  Weather from Open-Meteo. Holidays from the Python `holidays` package.
- **City:** San Francisco Bay Area.
- **Live site:** *add the GitHub Pages link here*

## Setup (Windows PowerShell, from the project folder)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -c "import pandas, sklearn, xgboost, holidays, tables, pyarrow; print('ok')"
```

Python 3.11 recommended. Random seed: `random_state=0` everywhere.

## Data

Follow `data/raw/SOURCES.md`. Put these two files in `data/raw/` without renaming them:

- `pems-bay.h5` (Google Drive link in the DCRNN README, https://github.com/liyaguang/DCRNN)
- `graph_sensor_locations_bay.csv` (`data/sensor_graph/` folder of the DCRNN repository)

Raw and processed data are not committed. The weather CSV is downloaded and cached on the first build.

## Run order (from the repository root)

```powershell
python src/01_build_dataset.py     # Stage 2: hourly table, segments, neighbours, weather, holidays
python src/02_features_split.py    # Stage 3: features, 60/20/20 split with 2-hour gaps
python src/baselines.py            # Persistence and hour-of-week MAE (validation and test)
python src/03_train_select.py      # Stage 4: tune on training folds, select on validation
python src/04_final_test.py        # Stage 5: refit on train+val, ONE test run
python src/05_export_site.py       # Stage 6: JSON for the website
pytest src/tests                   # Leakage checks
```

Only run Stage 5 after `configs/final_model.json` is committed. The test set is used once.

Preview the website locally (the JSON needs a web server, `file://` will not work):

```powershell
cd docs
python -m http.server 8000      # then open http://localhost:8000
```

## Repository layout

```
configs/    dataset.json (edit), split.json and final_model.json (written by the stages)
data/       raw/ and processed/ (not committed)
src/        pipeline code; tests/ holds the leakage tests
notebooks/  01 data understanding, 02 baselines and models, 03 validation and test, 04 errors and limitations
results/    metrics, breakdowns, figures (data_quality/ feeds the website's Data page)
docs/       static website for GitHub Pages
```

## Design choices worth knowing

- **Hourly rule:** an hour with fewer than 9 of 12 valid 5-minute readings is set to missing.
- **Segments:** 8 sensors with at least 95% hourly coverage, spread evenly by longitude. The chosen IDs are
  written to `configs/dataset.json` and then frozen.
- **Neighbours:** the 3 nearest eligible sensors (haversine distance), speeds taken at the same hour *t*.
  Distance is not road connectivity, so this is a proxy.
- **Split:** chronological 60/20/20 with a 2-hour gap, so no row's target falls in the next block.
- **No leakage:** all features use hour *t* or earlier; preprocessing is fitted inside pipelines on training data only.

## Results

*Fill in after Stage 5: test MAE with 95% interval, skill versus persistence, and where the model fails.*

## AI use and contributions

See `AI_USE.md` and `CONTRIBUTION_LOG.md`.
