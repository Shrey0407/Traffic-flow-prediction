# AI tool use

| Date | Tool | What it was used for | How I checked the output |
|---|---|---|---|
| 2026-10-18 | Claude (Anthropic) | Planned the Week 1 schedule; explained METR-LA vs PEMS-BAY; generated the repository scaffold and first-draft pipeline code (`src/`), tests, notebooks and website starter files from the course guide | Ran each script, ran `pytest src/tests` (8 passed), compared outputs with the guide, read the notebook outputs |
| 2026-10-19 | Claude (Anthropic) | Explained the Notebook 01 Part A checks and gave the code cells; fixed a pandas index-printing error and a string-vs-int sensor id KeyError in A4 | I ran the cells, checked the outputs against expected values (shape, DST gap, zero share, units) and wrote the notes |
| 2026-10-20 | Claude (Anthropic) | Explained the data-quality checks and gave code for Notebook 01 Part B and the website skeleton; diagnosed the pandas 3 / pytables read error and pinned pandas<3 | Ran the cells, checked the outputs (missing hours, duplicates, timezone, frozen feed on segment 400100) and wrote the notes |
| 2026-10-21 | Claude (Anthropic) | Explained the Day 4 plan and how to read the validation table; helped fix GitHub Pages 404 and the VS Code kernel choice; drafted the Saw/Means notes in Notebook 02 | Ran `03_train_select.py` myself, compared the printed MAE table with `validation_metrics.csv`, checked no MAE was suspiciously low (leakage) and that test data was not opened |
| | | | |

Add one row per use. Be specific about what the tool did and what you did to verify it.

Statement: *Complete this in your own words once you have checked everything.* For example: "I checked every
result in this project. AI tools were used as described above. I can explain every part of the pipeline."
