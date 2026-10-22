# AI tool use

| Date | Tool | What it was used for | How I checked the output |
|---|---|---|---|
| 2026-10-18 | Claude (Anthropic) | Planned the Week 1 schedule; explained METR-LA vs PEMS-BAY; generated the repository scaffold and first-draft pipeline code (`src/`), tests, notebooks and website starter files from the course guide | Ran each script, ran `pytest src/tests` (8 passed), compared outputs with the guide, read the notebook outputs |
| 2026-10-19 | Claude (Anthropic) | Explained the Notebook 01 Part A checks and gave the code cells; fixed a pandas index-printing error and a string-vs-int sensor id KeyError in A4 | I ran the cells, checked the outputs against expected values (shape, DST gap, zero share, units) and wrote the notes |
| 2026-10-20 | Claude (Anthropic) | Explained the data-quality checks and gave code for Notebook 01 Part B and the website skeleton; diagnosed the pandas 3 / pytables read error and pinned pandas<3 | Ran the cells, checked the outputs (missing hours, duplicates, timezone, frozen feed on segment 400100) and wrote the notes |
| 2026-10-21 | Claude (Anthropic) | Explained the Day 4 plan and how to read the validation table; helped fix GitHub Pages 404 and the VS Code kernel choice; drafted the Saw/Means notes in Notebook 02 | Ran `03_train_select.py` myself, compared the printed MAE table with `validation_metrics.csv`, checked no MAE was suspiciously low (leakage) and that test data was not opened |
| 2026-10-22 | Claude Code | Checked the reported bug in `03_train_select.py` / `04_final_test.py`: `apply_params` and `cfg["ensemble_members"]` were already in the code, so nothing was changed (the suggested `str(v)` change would have broken `apply_params`). Then ran `04_final_test.py` and `05_export_site.py` once. | Read the diff of `configs/final_model.json`; confirmed `ensemble_members` is a list; dry-ran model construction on training rows only before the test run. **Disclosure:** the test run was earlier than planned (see README). |
| 2026-10-22 | Claude Code | Wrote and executed Notebook 03 (validation selection, disclosed single test run, paired bootstrap) and Notebook 04 (error breakdowns, five failure cases, limitations) | Check that every number in the `Saw` lines equals `results/*.csv`; open the notebooks and re-run top to bottom; confirm Part A never reads test data and Part B refits nothing |
| 2026-10-22 | Claude Code | Extended `src/05_export_site.py` (3-decimal metrics, split details, paired difference, failure cases; no separate persistence file) and re-ran it on the existing test results | Open `docs/data/*.json`; compare `metrics.json` with `results/final_test_metrics.csv` and `validation_metrics.csv` |
| 2026-10-22 | Claude Code | Rebuilt the website (`docs/index.html`, `css/style.css`, `js/main.js`): all 12 sections, two interactions, numbers read from JSON | Open the site on `localhost:8000` and on the live URL; compare the table with the CSV; try both interactions; check the console for errors |
| 2026-10-22 | Claude Code | Rewrote `README.md` (numbers generated from the result files), pinned `requirements.txt`, tested a clean virtual environment (`pytest src/tests`, import check) | Read the README against `results/`; run the install steps yourself on a clean folder if you can |
| 2026-10-22 | Claude Code | Drafted `VIVA_PREP.md` | Read it end to end and rewrite any answer in your own words; you must be able to explain each one without the file |
| | | | |

Add one row per use. Be specific about what the tool did and what you did to verify it.

Statement: *Complete this in your own words once you have checked everything.* For example: "I checked every
result in this project. AI tools were used as described above. I can explain every part of the pipeline."
