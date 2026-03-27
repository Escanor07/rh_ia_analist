# Hiring Intelligence — Lubtrac RH Module

External hiring intelligence module for Lubtrac's HR system. Indexes candidate CVs using AI, matches them against job profiles via vector similarity with 3-layer scoring, and provides recruitment funnel analytics through a React dashboard.

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

## Matching Architecture

```
Score Final = (Afinidad General × 55%) + (Secciones × 30%) + (Estándares × 15%)

Afinidad General: Full profile embedding de vacante vs CV completo
Secciones:        Section-by-section con embeddings enriquecidos
Estándares:       Criterios de texto del usuario comparados por similitud vectorial
```

System gates (pre-matching): CV quality filter, exclusion of discarded/collaborator candidates.

## Setup

```bash
# Backend
python -m venv .venv && source .venv/bin/activate
cp .env.example .env   # fill in values
pip install -r requirements.txt
python manage.py migrate

# Frontend
cd frontend && npm install
npm run dev       # :5173, proxies /api to :8000
```

## Management Commands

```bash
# Index CVs from client MySQL/S3
python manage.py ingest_cv_batch --batch-size 50
python manage.py ingest_sample_cv --doc-id 1819

# Sync vacancies (enriched embeddings)
python manage.py sync_vacancies
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health/` | Health check |
| GET | `/api/vacancies/` | List synced vacancies |
| POST | `/api/vacancies/<id>/match/` | Run matching |
| GET | `/api/vacancies/<id>/detail/` | Vacancy detail |
| GET | `/api/matching/weights/` | Default section weights |
| GET | `/api/dashboard/` | Dashboard data |
| POST | `/api/pipeline/ingest/` | Start CV ingestion |
| POST | `/api/pipeline/sync/` | Start vacancy sync |
| GET | `/api/pipeline/status/` | Pipeline status |
| GET | `/api/standards/` | List global standards |
| POST | `/api/standards/create/` | Create standard |
| POST | `/api/standards/<id>/` | Update standard |
| POST | `/api/standards/<id>/delete/` | Delete standard |
