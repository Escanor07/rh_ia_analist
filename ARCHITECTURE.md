# Architecture Reference

This document explains every layer of the system for the next developer picking this up.

---

## 1. Ingestion Pipeline

```
gestor_rh_candidato_documento (MySQL)
    ↓ source key (S3 path)
S3 → download PDF to /tmp
    ↓
Docling → extract text (OCR if needed)
    ↓
CVClassifier (gpt-4.1-mini) → JSON with:
    sections: {summary, experience, education, skills, languages, certifications, general}
    attributes: {experience_years, education_level, skills_list, positions[], stability_level}
    quality: good | weak | poor
    ↓
_sanitize_json() → removes \u0000 null bytes (PostgreSQL jsonb rejects them)
    ↓
CandidateChunker → splits each section into ≤500 token chunks
    ↓
EmbeddingService (text-embedding-3-large, 2000 dims) → one embedding per chunk
    ↓
PostgreSQL: CandidateDocument + CandidateChunk[]
```

**Quality levels:**

- `good` — well-structured CV, reliable extraction
- `weak` — minimal content, low confidence
- `poor` — unreadable/corrupted PDF, excluded from matching automatically

---

## 2. Vacancy Sync

```
gestor_rh_vacante (status_id=4, active only)
    + gestor_rh_perfil_puesto
    + gestor_rh_vacante_caracteristica
    ↓
Content enrichment per section:
    "Puesto: Auxiliar de Almacén (Reemplazo) - Req de Experiencia: • Descarga de producto"
    (adds job context to each requirement before embedding)
    ↓
EmbeddingService → section embeddings + full_profile embedding
    ↓
SHA-256 hash of all characteristics → skip if unchanged
    ↓
PostgreSQL: Vacancy + VacancySection[]
```

**Important:** Only `status_id=4` vacancies are synced. This is intentional — we only need active job profiles for matching. Analytics queries read historical data directly from MySQL.

---

## 3. Matching Algorithm

When `POST /api/vacancies/<id>/match/` is called:

### Step 0 — Sucursal pre-filter (optional)

If `same_sucursal=true`:

```python
# Query MySQL for ALL vacancies at this branch (any status, including closed)
all_suc_ids = SELECT id FROM gestor_rh_vacante WHERE sucursal_id = X
# Get document IDs of candidates who applied to those vacancies
allowed_doc_ids = CandidateDocument.filter(source_vacante_id__in=all_suc_ids)
```

This set is passed into the searcher so pgvector only scans those documents.

### Step 1 — System gates (automatic exclusions)

- `status_id=8` (hired/active employee) → excluded always
- `status_id=5` (discarded) AND `vacante_id == current vacancy` → excluded for this vacancy only
- `quality=poor` → excluded always

### Step 2 — Vector search (pgvector cosine distance)

For each vacancy section: top-30 nearest chunks  
For full profile: top-40 nearest chunks  
Both respect `allowed_document_ids` if set.

### Step 3 — Scoring (3 layers)

```
Layer 1: General Affinity (55%)
    best cosine similarity between vacancy.full_embedding
    and any chunk of the candidate
    calibrated: raw [0.25–0.72] → display [0–100]

Layer 2: Section Match (30%)
    for each section the vacancy HAS:
        take the best chunk similarity for that section type
        calibrate and weight by DEFAULT_WEIGHTS
    average over vacancy sections only

Layer 3: Global Standards (15%)
    text standards: embedding similarity vs candidate chunks
    attribute standards: rule evaluation on processing_meta_json.attributes
    
    if no active standards: redistributed → 65% layer1 + 35% layer2

FINAL = (L1 × 0.55) + (L2 × 0.30) + (L3 × 0.15)   → 0–100
```

**Score thresholds for UI colors:**

```
≥ 70  → green   (strong match)
≥ 45  → amber   (moderate match)
< 45  → red     (weak match)
```

---

## 4. Global Standards

Two types, created by HR users from the Standards page:

**Text standard:**
The user writes a natural language description.
An embedding is generated and stored on `GlobalStandard.embedding`.
During matching, it's compared against all candidate chunks via cosine similarity.

**Attribute standard:**
Evaluated against `processing_meta_json.attributes` (pre-computed during ingestion).
Available attributes:

- `stability` — laboral stability: `baja | media | alta` (computed from job tenure)
- `min_experience` — years of experience
- `min_education` — education level (ordinal: none < secundaria < ... < doctorado)
- `cv_completeness` — number of non-empty sections in the CV

**Eval modes:**

- `score` → contributes to Layer 3 score
- `filter` → shows ✓/✗ in UI, does not affect numeric score
- `informational` → displays computed value only

---

## 5. Analytics (Dashboard)

All analytics read directly from client MySQL — no data is written back.
Analytics results are cached in Django's cache backend (default: memcache/local-memory).

`FunnelAnalyticsService.get_all()` returns:

- `totals` — candidatos, contratados, descartados, conversion_rate, drop_off_rate
- `candidate_funnel` — stage-by-stage counts from `gestor_rh_candidato_historial`
- `vacancy_sla` — days Sol→Aut, Aut→RRHH, total (from vacancy date fields)
- `candidate_sla` — avg transition time between stages per candidate
- `discard_reasons` — categorized from `gestor_rh_vacante_historial` descriptions
- `turnover` — from `gestor_rh_collaborator_termination`
- `all_vacancies` — table data for the dashboard vacancies list

---

## 6. Frontend Structure

```
frontend/src/
├── layout/          — AppShell, Sidebar, PipelineStatusBar
├── context/         — PipelineContext (pipeline job state + polling)
├── lib/             — api.js (all fetch calls), matching.js (section config, score colors)
├── components/      — shared: MetricCard, SectionCard, PageLoader, EmptyState
└── pages/
    ├── dashboard/
    ├── matching/
    ├── standards/
    └── vacancy-detail/
```

