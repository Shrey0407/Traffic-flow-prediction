# Contribution log

Major steps only. Code and text drafts produced by an AI assistant are listed in `AI_USE.md`; here I record my own decisions, runs and checks.

| Date | What I did | Output |
|---|---|---|
| 2026-10-18 | Chose PEMS-BAY as the dataset. Set up the project folder, ran the dataset build and chose 8 segments before any modelling. | Repository structure; hourly dataset; segment list |
| 2026-10-19 | Ran the raw-file checks (Notebook 01 Part A), the baselines and the tests. Baseline MAE (km/h): persistence val 5.366 / test 5.008; hour-of-week val 2.342 / test 2.436. | Notebook 01 Part A; `results/baseline_metrics.csv`; 8 tests passed |
| 2026-10-20 | Ran the data-quality checks and plots (Notebook 01 Part B); set up the website skeleton in `docs/`. | `results/data_quality/`; `docs/index.html` |
| 2026-10-21 | Turned on GitHub Pages. Ran `03_train_select.py`: validation MAE for 7 models. Added the feature `lag_168h` and retrained. The voting ensemble is the best trained model (validation MAE 2.551), but none beat hour-of-week (2.342). Decided to stop adding features to avoid fishing on validation. | `results/validation_metrics.csv`; `configs/final_model.json`; Notebook 02 |
| 2026-10-22 | Selected voting_ensemble by lowest validation MAE (rule fixed in advance). Ran `04_final_test.py` once, earlier than planned (disclosed in the README); the commit message "Freeze final model config ... before test run" was made after that run. Re-ran `03_train_select.py` and got the same selection. Test MAE: ensemble 2.558, hour-of-week 2.436, persistence 5.008. | `results/final_test_metrics.csv` |
| 2026-10-22 | Notebooks 03 and 04 (validation selection, test report, error analysis, five failure cases), site data export, first full website and README. Claude Code wrote most of the drafts; I ran them and checked the numbers against `results/*.csv` (see `AI_USE.md`). | `notebooks/03`, `notebooks/04`; `docs/`; `README.md` |
| 2026-11-06 | Asked for the website to become interactive so a reader can set values, check the data and see results. Ran `src/06_export_playground.py` to build the data behind it. | Interactive Lab (Playground, explorer, heatmap, game, discoveries); `docs/data/playground.json` |
| 2026-11-07 | Reviewed the site and decided the redesign: simpler Playground showing all methods, professional light/black theme, all figures redrawn as native charts. Re-ran the export, committed and pushed. | Final website in `docs/` |
