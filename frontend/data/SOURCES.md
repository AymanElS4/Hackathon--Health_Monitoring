# Data and threshold sources

Each entry records its status. Dataset licenses are verified in T008 and threshold sources in T009;
until an entry is verified, its use is provisional.

## Datasets and assets

### WESAD (UCI)

- URL: https://archive.ics.uci.edu/dataset/465/wesad+wearable+stress+and+affect+detection (original page: https://ubi29.informatik.uni-siegen.de/usi/data_wesad.html)
- License/Reference: owners' terms (original page, accessed 2026-11-15): "You may use this data for
  scientific, non-commercial purposes, provided that you give credit to the owners when publishing
  any work based on this data." UCI states no license of its own and points to the original page.
  Citation: Schmidt P., Reiss A., Duerichen R., Marberger C., Van Laerhoven K., "Introducing WESAD,
  a Multimodal Dataset for Wearable Stress and Affect Detection", ICMI 2018; dataset DOI
  10.24432/C57K5T. Download: 2.5 GB zipped.
- Used for: derived resting heart-rate series in `frontend/data/wesad-hr.json`, used as the simulated pulse oximeter input.
- Obligations: non-commercial use only; credit the owners (README, pitch video credits).
- Status: verified (2026-11-15)

### PhysioNet Sleep-EDF Expanded

- URL: https://physionet.org/content/sleep-edfx/1.0.0/
- License/Reference: Open Data Commons Attribution License v1.0 (ODC-By), open access (accessed
  2026-11-15). Required citation: Kemp B., Zwinderman A.H., Tuk B., Kamphuisen H.A.C., Oberyé
  J.J.L., "Analysis of a sleep-dependent neuronal feedback loop: the slow-wave microcontinuity of
  the EEG", IEEE-BME 47(9):1185–1194, 2000 (plus the standard PhysioNet citation). Total size
  8.1 GB; only a few hypnogram files are needed.
- Used for: 14 nightly total-sleep values in `frontend/data/sleep-history.json`.
- Obligations: attribution.
- Status: verified (2026-11-15)

### MakeHuman base mesh

- URL: https://www.makehumancommunity.org/
- License/Reference: license to verify (expected CC0 for exports).
- Used for: adult female base mesh for `frontend/public/models/body.glb`.
- Status: to verify

### vosk-model-small-es-0.42

- URL: https://alphacephei.com/vosk/models
- License/Reference: Apache 2.0, as listed for this model on https://alphacephei.com/vosk/models
  (accessed 2026-11-15). The README inside the archive says only "Copyright 2022-2050 AC
  Technologies LLC" and has no license text.
- Used for: offline Spanish speech recognition (`frontend/public/models/vosk/`).
- Status: verified (2026-11-15)

### Simulated device values (no external dataset)

- Used for: blood pressure 112/72, SpO₂ 98 %, body temperature 36.7 °C, nominal pulse 68 bpm when
  no WESAD series is available (fixed per demo scenario in `frontend/src/config/demoScenarios.ts`), plus
  seeded history variation (HR ±3, BP ±4/±3, temp ±0.2, SpO₂ ±1).
- Status: simulated, shown in the app as "equipo simulado".

## Threshold sources (RN1)

Each value below is a range from `specs/001-chequeo-diario-voz-cuerpo/spec.md`, rule RN1.
If a verified source gives a different value, RN1 is corrected first (T009).

### AHA/ACC 2025 High Blood Pressure Guideline

- URL: primary guideline text not accessed (publisher pages blocked automated access); checked
  through guideline summaries (e.g., https://www.2minutemedicine.com/guidelines/high-blood-pressure/),
  accessed 2026-11-15.
- License/Reference: 2025 AHA/ACC High Blood Pressure Guideline. Categories unchanged from 2017:
  normal < 120 and < 80; elevated 120–129 and < 80; stage 1 130–139 or 80–89; stage 2 ≥ 140 or ≥ 90.
- Used for: blood pressure bands. Below 120/80 green; 120–139 or 80–89 amber (elevated + stage 1);
  140 or higher, or 90 or higher, red (stage 2). Values match.
- Status: verified (secondary) 2026-11-15 — primary guideline text still to be checked by hand.

### American Heart Association, "All About Heart Rate"

- URL: https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse
- License/Reference: American Heart Association consumer page, "All About Heart Rate (Pulse)".
- Used for: resting pulse. 60–100 green; 50–59 or 101–110 amber; below 50 with symptoms, or above 110, red. Below 50 without symptoms is amber.
- Verified text (heart.org, via search excerpt; direct fetch returned 403; 2026-11-15): "a normal
  resting heart rate is between 60 and 100 beats per minute".
- Status: green band 60–100 verified (secondary: official-page excerpt, direct fetch blocked). The
  amber bands (50–59, 101–110) and red (> 110, < 50 with symptoms) are a team criterion (decision
  2026-11-15), shown in the app as "criterio del equipo, no clínico".

### AASM/SRS Joint Consensus Statement on adult sleep duration (Watson et al., 2015)

- URL: https://www.aasm.org/resources/pdf/adultsleepdurationconsensus.pdf
- License/Reference: Watson NF et al., 2015, AASM/SRS joint consensus statement on adult sleep duration.
- Used for: sleep. 7 h or more green; 6–6.9 h amber; below 6 h red only after 3 consecutive nights (one or two nights below 6 h is amber).
- Verified text (2026-11-15): "Adults should sleep 7 or more hours per night on a regular basis to
  promote optimal health." Watson NF et al., J Clin Sleep Med 2015;11(6):591–592.
- Status: green band ≥ 7 h verified. The red rule (< 6 h for 3 consecutive nights) is a team
  criterion (decision 2026-11-15), shown in the app as "criterio del equipo, no clínico".

### WHO Pulse Oximetry Training Manual (2011)

- URL: https://cdn.who.int/media/docs/default-source/patient-safety/pulse-oximetry/who-ps-pulse-oxymetry-training-manual-en.pdf
- License/Reference: World Health Organization, Pulse Oximetry Training Manual, 2011.
- Used for: SpO₂. 95 % or higher green; 90–94 % amber; below 90 % red.
- Verified text (PDF, ISBN 978 92 4 150113 2, 2026-11-15): "The oxygen saturation in healthy
  patients of any age should be 95% or above"; "If SpO2 is 94% or lower, the patient is hypoxic and
  needs to be treated quickly"; "SpO2 of < 90% is a clinical emergency".
- Status: verified (2026-11-15); values match.

### MedlinePlus, "Body temperature norms"

- URL: https://medlineplus.gov/ency/article/001982.htm
- License/Reference: MedlinePlus (U.S. National Library of Medicine), "Body temperature norms".
- Used for: normal body temperature. 36.1–37.2 °C is the normal range; the 37.3–37.9 °C band sits between this normal range and the CDC fever threshold.
- Verified text (page reviewed 1/1/2025; accessed 2026-11-15): normal range "from 97°F (36.1°C) to
  99°F (37.2°C)".
- Status: verified (2026-11-15); values match.

### CDC, "Definitions of Signs, Symptoms, and Conditions of Ill Travelers"

- URL: https://www.cdc.gov/port-health/php/definitions-symptoms-reportable-illness/index.html
- License/Reference: U.S. Centers for Disease Control and Prevention, "Definitions of Signs, Symptoms, and Conditions of Ill Travelers".
- Used for: fever. 38.0 °C or higher is red.
- Verified text (page last reviewed 2024-05-15; accessed 2026-11-15): fever is "a measured
  temperature of 100.4°F [38°C] or greater".
- Status: verified (2026-11-15); values match.

### Mayo Clinic, "Hypothermia — Symptoms and causes"

- URL: https://www.mayoclinic.org/diseases-conditions/hypothermia/symptoms-causes/syc-20352682
- License/Reference: Mayo Clinic, "Hypothermia: Symptoms and causes".
- Used for: hypothermia. Below 35.0 °C is red. The 35.0–36.0 °C band is "in doubt" and is measured again (RN1).
- Verified text (mayoclinic.org via search excerpt; direct fetch returned 403; 2026-11-15):
  "core body temperature drops below 95 degrees Fahrenheit (35 degrees Celsius). It is a medical
  emergency."
- Status: verified (secondary: official-page excerpt, direct fetch blocked) 2026-11-15 — value
  matches; confirm on the live page by hand. The 35.0–36.0 °C "in doubt" band is a measurement
  rule, not a clinical threshold.

## Team criteria (no external source)

### Mood thresholds

- URL: none. The thresholds are a team criterion with no external source.
- License/Reference: team criterion, declared in the app as "criterio del equipo, no clínico".
- Used for: mood. 4–5 green; 3 amber; 2 or below is red after 2 consecutive days (RN1).
- Status: team criterion (constitution v1.1.0, principle VIII); shown in the app as "criterio del
  equipo, no clínico".
