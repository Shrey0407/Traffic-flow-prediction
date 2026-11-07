# Contribution log

Dated record of what I did. The code and text drafts that an AI assistant produced are listed in `AI_USE.md`; here I record my own decisions, runs and checks.

| Date | What I did | Output |
|---|---|---|
| 2026-10-18 | Chose PEMS-BAY as the dataset. Set up the project folder from the generated scaffold. | Repository structure |
| 2026-10-18 | Ran the dataset build and chose 8 segments before any modelling. | Hourly dataset, segment list |
| 2026-10-19 | Ran Notebook 01 Part A (raw file checks), the baselines and the tests. | Notebook 01 Part A; `results/baseline_metrics.csv`; 8 tests passed |
| 2026-10-19 | Recorded baseline MAE (km/h): persistence val 5.366 / test 5.008; hour-of-week val 2.342 / test 2.436. | `results/baseline_metrics.csv` |
| 2026-10-20 | Ran the data-quality checks and plots (Notebook 01 Part B); set up the website skeleton in `docs/`; pinned pandas<3. | `results/data_quality/`; `docs/index.html`; commit "Day 3" |
| 2026-10-21 | Turned on GitHub Pages (main, /docs). Ran `03_train_select.py`: validation MAE for 7 models. Added the feature `lag_168h` (speed at the same hour last week) and retrained. The voting ensemble is the best trained model (validation MAE 2.551; random forest 2.573), but none beat hour-of-week (2.342). Decided to stop adding features to avoid fishing on validation. Filled Notebook 02. | `results/validation_metrics.csv`; `configs/final_model.json`; `results/val_model_comparison.png`; Notebook 02 |
| 2026-10-22 | Selected voting_ensemble by lowest validation MAE (rule fixed in advance) and kept `configs/final_model.json`. Ran `04_final_test.py` once, earlier than planned, on a Claude Code step (disclosed in the README). Re-ran `03_train_select.py` at 11:22 and got the same selection. | `configs/final_model.json`; `results/final_test_metrics.csv` (test MAE 2.558, hour-of-week 2.436, persistence 5.008) |
| 2026-10-22 | Notebooks 03 and 04 (validation selection, test report, error analysis, five failure cases), site data export, first website, README and a clean-environment check. Claude Code wrote most of the drafts; I ran them, checked the numbers against `results/*.csv` and reviewed the notebooks and site (see `AI_USE.md`). | `notebooks/03`, `notebooks/04`; `docs/`; `README.md`; `results/errors_by_*.csv` |
| 2026-10-22 | Noted a mistake in the commit history: the commit "Freeze final model config (voting_ensemble) before test run" was made after the test run (test files 11:18, config re-written 11:22). The README gives the correct order. | git log |
| 2026-11-06 | Asked for the website to become interactive so a reader can set values, check the data and see results. Chose the features to keep and ran `src/06_export_playground.py` to build `docs/data/playground.json`. Reviewed the first interactive version and listed what to change. | `docs/`; `docs/data/playground.json`; `src/06_export_playground.py` |
| 2026-11-07 | Reviewed the site in screenshots and decided the changes: remove the quiz, slider and paired chart; show all methods in the Playground with its controls above the results; use a professional light/black theme; fix figure labels and legends; remove the heatmap slider and the on-page disclosure. Re-ran the export, committed and pushed. Kept personal study notes out of the repository. | `docs/` (live site); this log; `AI_USE.md` |
