# Data sources

- Dataset: PEMS-BAY (speed table and sensor locations)
- Origin: Caltrans Performance Measurement System (PeMS), Bay Area detectors, 5-minute readings, speed in mph
- Distributed with: DCRNN repository, https://github.com/liyaguang/DCRNN (data section of the README)
- Downloaded: 2026-10-18
- Files:
  - `pems-bay.h5` (135,930,936 bytes, about 130 MB) from the Google Drive link in the DCRNN README
  - `graph_sensor_locations_bay.csv` (9,750 bytes, about 9.5 KB) from `data/sensor_graph/` in the DCRNN repository
- Licence / citation: cite the DCRNN paper and the PeMS source as the repository states.
  - Li, Y., Yu, R., Shahabi, C., Liu, Y. (2018). Diffusion Convolutional Recurrent Neural Network:
    Data-Driven Traffic Forecasting. ICLR 2018.
  - Weather: Open-Meteo Historical Weather API (https://open-meteo.com), downloaded by `src/weather.py`
    and cached as `data/raw/weather_<start>_<end>.csv`.

Raw files are not committed to Git (see `.gitignore`). This note is.
