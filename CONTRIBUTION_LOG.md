# Contribution log

Keep this dated and honest. You will use it in the viva to describe your own work.

| Date | Hours | What I did | Output |
|---|---|---|---|
| 2026-10-18 | | Chose PEMS-BAY. Set up the project folder from the generated scaffold. | Repository structure |
| 2026-10-18 | | Ran the dataset build and chose 8 segments. | Hourly dataset, segment list |
| 2026-10-19 | | Notebook 01 Part A (raw file checks), baselines, pytest. | Notebook 01 Part A; `results/baseline_metrics.csv`; 8 tests passed |
| 2026-10-19 | | Recorded baseline MAE (km/h): persistence val 5.366 / test 5.008; hour-of-week val 2.342 / test 2.436. | `results/baseline_metrics.csv` |
| 2026-10-20 | | Data-quality checks and plots (Notebook 01 Part B); website skeleton in `docs/`; pinned pandas<3. | `results/data_quality/`; `docs/index.html`; commit "Day 3" |
| 2026-10-21 | | Turned on GitHub Pages (main, /docs). Ran `03_train_select.py`: validation MAE for 7 models. Added feature lag_168h (speed same hour last week) and retrained. Voting ensemble is the best trained model (validation MAE 2.551; random forest 2.573), but none beat hour-of-week (2.342). Decided to stop adding features to avoid fishing on validation. Filled Notebook 02. | `results/validation_metrics.csv`; `configs/final_model.json` (not frozen yet); `results/val_model_comparison.png`; Notebook 02 |
| 2026-10-22 | | Selected voting_ensemble by lowest validation MAE (rule fixed in advance) and kept `configs/final_model.json`. Ran `04_final_test.py` once, earlier than planned, on a Claude Code step (disclosed in README). Re-ran `03_train_select.py` at 11:22: same selection. | `configs/final_model.json`; `results/final_test_metrics.csv` (test MAE 2.558, hour-of-week 2.436, persistence 5.008) |
| 2026-10-22 | | Notebooks 03 and 04 (validation selection, test report, error analysis, five failure cases), site data export, full website with two interactions, README, clean-environment check, viva notes. Most of this was written by Claude Code and checked by me (see `AI_USE.md`). **Shrey: edit this row to say what you did yourself, and fill in the hours.** | `notebooks/03`, `notebooks/04`; `docs/`; `README.md`; `VIVA_PREP.md`; `results/errors_by_*.csv` |
| 2026-10-22 | | Note on commit history: the commit "Freeze final model config (voting_ensemble) before test run" was made AFTER the test run (test files 11:18, config re-written 11:22). The message is wrong; the README disclosure gives the correct order. | git log |
| | | | |
