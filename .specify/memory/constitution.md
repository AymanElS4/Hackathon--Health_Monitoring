<!--
Sync Impact Report
- Version change: 1.1.0 → 1.2.0
- Modified sections: Prototype Constraints — "no server" replaced by: a server is allowed only off
  the astronaut's critical path (sync + flight-surgeon view); the astronaut app MUST work with the
  backend down (materially expanded guidance → MINOR)
- Modified principles: none (VII. Offline by Default unchanged and reinforced)
- Added sections: none
- Removed sections: none
- Templates: none modified (dependent templates read this file at runtime)
- Follow-up TODOs: none
-->

# Base Vital Constitution

Base Vital is a prototype for Challenge 04, "Create Health Monitoring Software for Astronauts on
Space Missions", at NASA Space Apps Guayaquil 2026.

## Core Principles

### I. Simplicity First

When two solutions both work, choose the simpler one that still works without internet. This is a
weekend prototype: no speculative abstractions and no complexity for imagined future needs. Any
added complexity MUST be justified in the plan.

### II. Language Split

- The user interface and voice (prompts, speech, on-screen text) MUST be in Spanish.
- Code, comments, and technical documents MUST be in English.
- The video pitch MUST be in English with Spanish subtitles.

### III. No Phantom Scope

Nothing is implemented unless the spec asks for it. A new idea MUST be proposed (spec change or
note) and MUST NOT be built until it is in the spec.

### IV. Verifiable by a Non-Technical Person

Every success criterion MUST be checkable by a non-technical person using the app, without reading
code or logs.

### V. Respectful Data

- Only open, anonymized datasets (e.g., WESAD, PhysioNet, NASA) are allowed, and every data point
  MUST record its source.
- No keys, tokens, or secrets in the code.
- No data that can identify a real person.

### VI. Never Diagnose

The app helps decide; the flight surgeon has the final word. No message, label, or voice line may
state a diagnosis or recommend medication.

### VII. Offline by Default

Everything the astronaut uses MUST work with no network connection after the first load.

### VIII. Every Threshold Has a Source

A threshold or range MUST cite its source (guideline, standard, or paper), or be declared a
"team criterion". A team criterion MUST be shown in the app as "criterio del equipo, no clínico"
wherever its result is displayed. A threshold that has neither a cited source nor that declaration
MUST NOT be used.

### IX. Confirm Before Recording

Every number captured by voice MUST be repeated back to the user and confirmed before it is stored
or used in any calculation.

## Prototype Constraints

- No accounts and no per-user cost.
- A server is allowed only off the astronaut's critical path (data sync and the flight-surgeon
  view). The astronaut app MUST work fully with the backend down or unreachable; no astronaut
  feature may depend on it.
- Simulated station equipment MUST be declared as simulated in the UI or docs, with the dataset or
  range it is based on.
- Keep this constitution short and in plain language; detail belongs in specs and plans.

## Development Workflow

- Flow: constitution → specify → clarify → plan → tasks → analyze → implement.
- Every plan MUST include a Constitution Check against Principles I–IX; violations MUST be listed
  with justification or removed.
- A feature is done only when its acceptance criteria pass by using the app (Principle IV).

## Governance

- This constitution supersedes other practices for this project.
- Amendments are made via `/speckit-constitution`, recorded in the Sync Impact Report, and versioned
  with semantic versioning: MAJOR for removing or redefining a principle, MINOR for a new principle
  or section, PATCH for wording fixes.
- Specs, plans, tasks, and reviews MUST be checked for compliance; unresolved conflicts are fixed
  in the plan or spec, not by ignoring the constitution.

**Version**: 1.2.0 | **Ratified**: 2026-11-14 | **Last Amended**: 2026-11-15
