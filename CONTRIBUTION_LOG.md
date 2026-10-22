# Contribution log

Keep this dated and honest. You will use it in the viva to describe your own work.

| Date | Hours | What I did | Output |
|---|---|---|---|
| 2026-10-18 | | Chose PEMS-BAY. Set up the project folder from the generated scaffold. | Repository structure |
| 2026-10-18 | | Ran the dataset build and chose 8 segments. | Hourly dataset, segment list |
| 2026-10-19 | | Notebook 01 Part A (raw file checks), baselines, pytest. | Notebook 01 Part A; `results/baseline_metrics.csv`; 8 tests passed |
| 2026-10-19 | | Recorded baseline MAE (km/h): persistence val 5.366 / test 5.008; hour-of-week val 2.342 / test 2.436. | `results/baseline_metrics.csv` |
| 2026-10-20 | | Data-quality checks and plots (Notebook 01 Part B); website skeleton in `docs/`; pinned pandas<3. | `results/data_quality/`; `docs/index.html`; commit "Day 3" |
| 2026-10-21 | | Turned on GitHub Pages (main, /docs). Ran `03_train_select.py`: validation MAE for 7 models. Random forest is best trained model (2.595), none beat hour-of-week (2.342). Filled Notebook 02. | `results/validation_metrics.csv`; `configs/final_model.json` (not frozen yet); `results/val_model_comparison.png`; Notebook 02 |
| 2026-10-22 to 2026-10-24 | | **DRAFT: Shrey to edit to reflect what he did himself.** Froze the model (voting_ensemble, selected on validation). Ran the final test once (earlier than planned, disclosed). Notebooks 03 and 04 (validation selection, test report, error analysis, five failure cases). Exported site data. Website with two interactions. README, clean-environment check, viva notes. | `configs/final_model.json`; `results/final_test_metrics.csv`; `results/errors_by_*.csv`; `docs/`; `README.md`; `VIVA_PREP.md` |
| | | | |
