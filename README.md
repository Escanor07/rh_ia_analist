# Hiring Intelligence — Lubtrac RH Module

External hiring intelligence module for Lubtrac's HR system. Indexes candidate CVs using AI, matches them against job profiles via vector similarity, and provides recruitment funnel analytics through a React dashboard.


## Setup

### Prerequisites

- Python 3.12+
- PostgreSQL with pgvector extension
- Node.js 20+
- Access to client's MySQL database (read-only)
- AWS credentials for S3 bucket
- OpenAI API key

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
cp .env.example .env   # fill in all values
pip install -r requirements.txt
python manage.py migrate
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # dev server on :5173, proxies /api to :8000
npm run build     # production build to dist/
```

### Running

```bash
python manage.py runserver   # API on :8000
```

## Management Commands

```bash
# Index CVs from client's MySQL/S3
python manage.py ingest_cv_batch --batch-size 50

# Index a single CV by document ID
python manage.py ingest_sample_cv --doc-id 1819

# Sync job vacancies from client's MySQL
python manage.py sync_vacancies
python manage.py sync_vacancies --source-id 42
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health/` | Health check (Postgres + pgvector) |
| GET | `/api/vacancies/` | List synced vacancies |
| POST | `/api/vacancies/<id>/match/` | Run matching for a vacancy |
| GET | `/api/vacancies/<id>/detail/` | Vacancy detail with candidates |
| GET | `/api/matching/weights/` | Default matching weights |
| GET | `/api/dashboard/` | Full dashboard data |
| POST | `/api/pipeline/ingest/` | Start CV ingestion (async) |
| POST | `/api/pipeline/sync/` | Start vacancy sync (async) |
| GET | `/api/pipeline/status/` | Pipeline execution status |

## Environment Variables

See `.env.example` for the full list. Key variables:

- `SECRET_KEY` — Django secret key
- `DB_*` — PostgreSQL connection
- `CLIENT_MYSQL_*` — Client MySQL connection (read-only)
- `S3_CV_BUCKET`, `AWS_*` — S3 bucket for CV files
- `OPENAI_API_KEY` — OpenAI API key
- `DATA_CUTOFF_DATE` — Only process data from this date onward

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
