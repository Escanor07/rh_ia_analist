# Hiring Intelligence — Lubtrac

AI-powered recruitment module integrated into Lubtrac's HR system. Indexes candidate CVs using vector embeddings, ranks them against job profiles via 3-layer similarity scoring, and provides recruitment funnel analytics.

---

## Stack

| Component | Technology |
|---|---|
| Backend | Django 6 · Python 3.12 |
| Database | PostgreSQL + pgvector |
| Client DB | MySQL (read-only) |
| File Storage | AWS S3 |
| Text Extraction | Docling |
| LLM Classification | OpenAI gpt-4.1-mini |
| Embeddings | OpenAI text-embedding-3-large (2000 dims) |
| Frontend | React 19 · Vite · Tailwind CSS v4 |

---

## Quick Start

```bash
# Backend
python -m venv .venv && source .venv/bin/activate
cp .env.example .env          # fill in all required values
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver    # :8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                   # :5173, proxies /api → :8000
```

### Required `.env` values

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (must have pgvector extension) |
| `MYSQL_*` | Client's MySQL credentials (read-only access) |
| `AWS_*` | S3 credentials for CV PDF downloads |
| `OPENAI_API_KEY` | OpenAI API key (gpt-4.1-mini + text-embedding-3-large) |
| `DATA_CUTOFF_DATE` | Earliest date for analytics queries (e.g. `2024-01-01`) |
| `DASHBOARD_ANALYTICS_CACHE_SECONDS` | Cache TTL for dashboard (default: 120) |

---

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full technical reference.

---

## Management Commands

```bash
# Index new CVs from client MySQL/S3 (run periodically)
python manage.py ingest_cv_batch --batch-size 50

# Re-index a specific document by ID (useful for debugging failed records)
python manage.py ingest_sample_cv --doc-id 1819

# Sync job vacancies from client MySQL (re-embeds if description changed)
python manage.py sync_vacancies
```

---

## API Reference

All endpoints except `/health/` and `/api/auth/login/` require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login/` | Login — returns JWT token (8h lifetime) |
| `GET` | `/health/` | Health check (public) |
| `GET` | `/api/vacancies/` | List synced vacancies |
| `POST` | `/api/vacancies/<id>/match/` | Run matching — see body below |
| `GET` | `/api/vacancies/<id>/detail/` | Vacancy detail with pipeline |
| `GET` | `/api/matching/weights/` | Default section weights |
| `GET` | `/api/dashboard/` | Full dashboard analytics |
| `POST` | `/api/pipeline/ingest/` | Start CV ingestion job |
| `POST` | `/api/pipeline/sync/` | Start vacancy sync job |
| `GET` | `/api/pipeline/status/` | Current pipeline job status |
| `GET` | `/api/standards/` | List global standards |
| `GET` | `/api/standards/catalog/` | Attribute rule catalog |
| `POST` | `/api/standards/create/` | Create a standard |
| `POST` | `/api/standards/<id>/` | Update a standard |
| `POST` | `/api/standards/<id>/delete/` | Delete a standard |

### POST `/api/vacancies/<id>/match/`

```json
{
  "top_n": 10,
  "same_sucursal": false,
  "weights": {
    "skills": 0.30,
    "experience": 0.30,
    "education": 0.10,
    "certifications": 0.10,
    "languages": 0.10,
    "general": 0.05,
    "summary": 0.05
  }
}
```

`same_sucursal: true` restricts the vector search to candidates who applied to vacancies at the same branch (`sucursal_id`) as the target vacancy. The filter runs **before** the vector search, not after — it narrows the pgvector index scan directly.

---

## Data Sources

This module reads (never writes) from two external systems:

**Client MySQL (`gestor_rh_*` tables):**
- `gestor_rh_vacante` — vacancies
- `gestor_rh_perfil_puesto` — job profiles
- `gestor_rh_vacante_caracteristica` — job requirements
- `gestor_rh_vacante_history` — vacancy change history
- `gestor_rh_candidate` — candidates
- `gestor_rh_candidate_file` — CV document records with S3 keys
- `gestor_rh_candidate_status` — candidate status labels
- `gestor_rh_candidate_history` — candidate stage history
- `gestor_rh_collaborator_termination` — turnover records

**Client MySQL (`zero_dawn.*` views):**
- `zero_dawn.golabs_core_sucursal` — branch name/location lookup
- `zero_dawn.golabs_colaborador` — active employee records (reserved for future use)

**AWS S3:** CV PDF files referenced by `gestor_rh_candidate_file.s3_url`
