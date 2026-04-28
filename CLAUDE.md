# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

AI-powered recruitment module for Lubtrac's HR system. Indexes candidate CVs via vector embeddings, ranks them against job profiles using a 3-layer similarity scoring algorithm, and provides recruitment funnel analytics. Backend is Django + PostgreSQL/pgvector; frontend is React + Vite.

## Commands

### Backend

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in required values
python manage.py migrate
python manage.py runserver    # :8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev    # :5173, proxies /api → :8000
npm run build
```

### Management Commands

```bash
python manage.py ingest_cv_batch --batch-size 50   # index CVs from MySQL/S3
python manage.py ingest_sample_cv --doc-id 1819    # re-index one CV by ID
python manage.py sync_vacancies                    # sync active vacancies from MySQL
```

No test suite or linter config exists in this repo.

## Architecture

### Data Flow

Two read-only external sources feed into the system:
- **Client MySQL** (`gestor_rh_*` tables, `zero_dawn.*` views) — vacancies, job profiles, candidate records, stage history, branch lookups
- **AWS S3** — CV PDF files referenced by `gestor_rh_candidato_documento.url_documento`

The module never writes to these external systems. It stores derived data (embeddings, match results, standards) in its own PostgreSQL database with the pgvector extension.

### Ingestion Pipeline (`hiring/services/ingestion/`)

6-step process triggered via `POST /api/pipeline/ingest/` or `ingest_cv_batch` command:
1. Fetch unindexed document records from client MySQL (`mysql_source.py`)
2. Download PDF from S3 to `/tmp` (`s3_storage.py`)
3. Extract text with Docling (`extractor.py`)
4. Classify sections via OpenAI gpt-4.1-mini (`cv_classifier.py` → structured JSON output)
5. Chunk text into ≤500 token segments (`chunker.py`)
6. Generate embeddings with `text-embedding-3-large` (2000 dims) and store in PostgreSQL (`pipeline.py`)

CV quality is tagged as `good`, `weak`, or `poor` — `poor` CVs are excluded from matching entirely.

### Matching Algorithm (`hiring/services/matching/`)

Three weighted layers, totaling 100%:

| Layer | Weight | Mechanism |
|---|---|---|
| General affinity | 55% | Best cosine similarity between vacancy `full_embedding` and any candidate chunk |
| Section match | 30% | Best chunk per section type, weighted by `DEFAULT_WEIGHTS` (skills=0.30, experience=0.30, education=0.10, …) |
| Global standards | 15% | Text embeddings + attribute rules evaluated on `processing_meta_json.attributes` |

Raw cosine similarity [0.25–0.72] is calibrated to [0–100]. Score thresholds in the frontend: red < 45, amber ≥ 45, green ≥ 70 (`frontend/src/lib/matching.js`).

`same_sucursal=true` filters the pgvector scan *before* the vector search, restricting candidates to those who applied at the same `sucursal_id` as the target vacancy.

**Candidate exclusion rules:**
- `status_id=8` (hired/active): always excluded
- `status_id=5` (discarded): excluded per-vacancy only

### Standards System (`hiring/services/standards/`)

Two standard types:
- **Text standards:** User writes a description → embedded → cosine similarity during matching
- **Attribute standards:** Rules evaluated against `processing_meta_json.attributes` fields (`stability`, `min_experience`, `min_education`, `cv_completeness`)

Three modes: `score` (affects ranking), `filter` (UI-only gate), `informational` (displays value without affecting score).

### Analytics (`hiring/services/analytics/`)

`FunnelAnalyticsService` reads client MySQL directly (not PostgreSQL). All queries respect `DATA_CUTOFF_DATE`. Dashboard results are cached for 120s (configurable via `DASHBOARD_ANALYTICS_CACHE_SECONDS`).

### Frontend Architecture (`frontend/src/`)

- `App.jsx` defines routes; `layout/AppShell.jsx` wraps all pages with `Sidebar` + `PipelineStatusBar`
- `context/PipelineContext.jsx` polls `GET /api/pipeline/status/` every 3 seconds while a job is running
- `lib/api.js` contains all fetch calls — add new API calls here
- Pages are feature-organized under `pages/`: `dashboard/`, `matching/`, `standards/`, `vacancy-detail/`

### Key Models (`hiring/models.py`)

| Model | Purpose |
|---|---|
| `CandidateDocument` | One row per indexed CV; holds `quality_label`, `processing_meta_json`, `sucursal_id` |
| `CandidateChunk` | One row per text chunk; holds `embedding` vector + `section_type` |
| `Vacancy` / `VacancySection` | Synced from MySQL; holds `full_embedding` and per-section embeddings |
| `GlobalStandard` | User-defined scoring/filter rules |
| `MatchRun` / `MatchRunCandidate` | Stored results of each matching run |

### Django App Layout

```
config/          — settings, root urls, middleware (CORS allow-all)
hiring/
  models.py      — all PostgreSQL models
  views.py       — all API endpoints (~570 lines)
  urls.py        — hiring app routes
  services/      — ingestion/, matching/, standards/, analytics/, shared/
  management/commands/  — CLI management commands
  migrations/
frontend/        — React app (separate process)
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (requires pgvector extension) |
| `CLIENT_MYSQL_*` | Read-only MySQL credentials for client data |
| `AWS_*` / `S3_CV_BUCKET` | S3 credentials for CV PDF downloads |
| `OPENAI_API_KEY` | gpt-4.1-mini (classification) + text-embedding-3-large (embeddings) |
| `DATA_CUTOFF_DATE` | Earliest date for analytics queries (e.g. `2024-01-01`) |
| `DASHBOARD_ANALYTICS_CACHE_SECONDS` | Dashboard cache TTL (default: 120) |

## Conventions

- Spanish naming throughout: `sucursal`, `vacante`, `candidato`, `perfil_puesto` — match existing naming when adding code
- All business logic lives in `hiring/services/`; `views.py` should stay thin
- The module is strictly read-only with respect to the client MySQL and S3 — never add write operations there
- `ARCHITECTURE.md` at the repo root contains deeper technical reference for the ingestion and matching pipelines
