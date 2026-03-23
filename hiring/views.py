import json
import time
from collections import defaultdict

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.db.models import Count, Q
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from hiring.models import CandidateChunk, CandidateDocument, MatchRun, MatchRunCandidate, Vacancy
from hiring.services.analytics.dates import days_between
from hiring.services.analytics.funnel import FunnelAnalyticsService
from hiring.services.matching.pipeline import MatchingPipeline
from hiring.services.matching.scorer import DEFAULT_WEIGHTS, prepare_matching_weights
from hiring.services.pipeline_runner import get_status, start_ingest, start_sync_vacancies
from hiring.services.shared.mysql_client import MySQLClient


def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT extversion FROM pg_extension WHERE extname='vector'")
            row = cursor.fetchone()
            pgvector = row[0] if row else "not installed"
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"
        pgvector = "unknown"
    return JsonResponse({"status": "ok", "postgres": db_status, "pgvector": pgvector})


@require_GET
def list_vacancies(request):
    qs = Vacancy.objects.order_by("-fecha_solicitud")
    return JsonResponse({"vacancies": [
        {"source_id": v.source_id, "profile_name": v.profile_name, "tipo_vacante": v.tipo_vacante,
         "fecha_solicitud": str(v.fecha_solicitud) if v.fecha_solicitud else None}
        for v in qs
    ]})


@require_POST
def run_matching(request, source_id):
    try:
        vacancy = Vacancy.objects.get(source_id=source_id)
    except Vacancy.DoesNotExist:
        return JsonResponse({"error": "Vacante no encontrada"}, status=404)

    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON inválido"}, status=400)

    top_n = int(body.get("top_n", 10))
    custom = {k: float(v) for k, v in (body.get("weights") or {}).items() if k in DEFAULT_WEIGHTS} or None
    weights = prepare_matching_weights(custom)
    weights_used = weights if weights is not None else dict(DEFAULT_WEIGHTS)

    t0 = time.time()
    results = MatchingPipeline(weights=weights).match_vacancy(vacancy, top_n=top_n * 2)
    elapsed = round(time.time() - t0, 2)

    doc_ids = list({cs.document_id for cs in results})
    cand_ids = list({cid for cid in (cs.source_candidate_id for cs in results) if cid})

    docs = {
        d.id: d
        for d in CandidateDocument.objects.filter(id__in=doc_ids).only(
            "id", "processing_meta_json", "source_vacante_id",
        )
    }
    chunks_by_doc = defaultdict(list)
    if doc_ids:
        for row in (
            CandidateChunk.objects.filter(document_id__in=doc_ids)
            .order_by("document_id", "chunk_index")
            .values("document_id", "section_type", "content")
        ):
            chunks_by_doc[row["document_id"]].append(row)

    status_by_cand = _mysql_candidate_status_batch(cand_ids)

    seen = {}
    for cs in results:
        doc = docs.get(cs.document_id)
        meta = (doc.processing_meta_json or {}).get("source", {}) if doc else {}
        cst = status_by_cand.get(cs.source_candidate_id, {}) if cs.source_candidate_id else {}
        entry = _match_candidate_row(
            cs, meta, cst, doc.source_vacante_id if doc else None,
            chunks_by_doc.get(cs.document_id, []),
        )
        key = str(cs.source_candidate_id) if cs.source_candidate_id else f"{meta.get('candidate_name', '')}|{meta.get('candidate_email', '')}"
        if key not in seen or entry["score"] > seen[key]["score"]:
            seen[key] = entry

    for c in seen.values():
        if c.get("source_vacante_id") and c["source_vacante_id"] == vacancy.source_id:
            c["applied_to_vacancy"] = True
            c["score"] = min(round(c["score"] * 1.10), 100)
        else:
            c["applied_to_vacancy"] = False

    candidates = sorted(seen.values(), key=lambda c: (c["applied_to_vacancy"], c["score"]), reverse=True)[:top_n]
    for i, c in enumerate(candidates, 1):
        c["rank"] = i

    mr = MatchRun.objects.create(
        vacancy_source_id=vacancy.source_id, vacancy_name=vacancy.profile_name,
        candidates_evaluated=len(candidates),
        top_score=candidates[0]["score"] if candidates else 0,
        processing_time_seconds=elapsed, weights_used=weights_used,
    )
    for c in candidates:
        MatchRunCandidate.objects.create(
            match_run=mr, document_id=c["document_id"],
            source_candidate_id=c.get("source_candidate_id"),
            candidate_name=c["candidate_name"], rank=c["rank"], score=c["score"],
            score_breakdown={s["section_type"]: s["score_100"] for s in c["section_scores"]},
            candidate_status_at_run=c.get("candidate_status", {}).get("status_label", ""),
        )

    for c in candidates:
        c.pop("source_vacante_id", None)

    return JsonResponse({
        "vacancy": {"source_id": vacancy.source_id, "profile_name": vacancy.profile_name},
        "matching": {"candidates": candidates, "processing_time_seconds": elapsed},
    })


@require_GET
def default_weights(request):
    return JsonResponse({"weights": DEFAULT_WEIGHTS})


@require_GET
def dashboard(request):
    try:
        row = MySQLClient().fetch_one("""
            SELECT COUNT(*) AS total FROM gestor_rh_candidato_documento
            WHERE nombre_documento = 'CV'
              AND url_documento IS NOT NULL
              AND TRIM(url_documento) <> ''
              AND fecha >= %s
        """, (settings.DATA_CUTOFF_DATE,))
        total_cvs_source = row.get("total", 0) if row else 0
    except Exception:
        total_cvs_source = 0

    stats = CandidateDocument.objects.aggregate(
        total_our_db=Count("id"),
        processed=Count("id", filter=Q(status="processed")),
    )
    processed, total_our_db = stats["processed"], stats["total_our_db"]
    denominator = max(total_cvs_source, total_our_db)
    index_rate = round((processed / denominator * 100), 1) if denominator > 0 else 0
    pending_to_index = max(total_cvs_source - total_our_db, 0)

    times, q = [], {"good": 0, "weak": 0, "poor": 0}
    for d in CandidateDocument.objects.filter(status="processed").iterator(chunk_size=500):
        meta = d.processing_meta_json or {}
        t = meta.get("pipeline", {}).get("processing_time_seconds")
        if t is not None:
            times.append(t)
        v = meta.get("quality", "unknown")
        if v in q:
            q[v] += 1
    avg_t = round(sum(times) / len(times), 2) if times else 0

    rm = list(
        MatchRun.objects.order_by("-executed_at")[:5]
        .values("id", "vacancy_name", "candidates_evaluated", "top_score")
    )

    cache_key = f"hiring:dashboard_analytics:{settings.DATA_CUTOFF_DATE}"
    analytics = cache.get(cache_key)
    if analytics is None:
        analytics = FunnelAnalyticsService().get_all()
        cache.set(cache_key, analytics, settings.DASHBOARD_ANALYTICS_CACHE_SECONDS)

    return JsonResponse({
        "pipeline": {
            "cvs_indexados_percent": index_rate,
            "cvs_procesados": processed,
            "cvs_total_source": total_cvs_source,
            "cvs_pendientes": pending_to_index,
            "tiempo_promedio_seconds": avg_t,
            "quality": q,
            "vacantes_sincronizadas": Vacancy.objects.count(),
        },
        "matching": {
            "total_comparaciones": MatchRun.objects.count(),
            "recent": rm,
        },
        "analytics": analytics,
    })


@require_GET
def vacancy_detail(request, source_id):
    db = MySQLClient()
    vacancy = db.fetch_one("""
        SELECT v.id, v.status_id, v.tipo_vacante, v.fecha_solicitud, v.fecha_autorizacion, v.fecha_rh,
               COALESCE(sv.descripcion,'') AS status_label,
               COALESCE(pp.nombre,'') AS perfil_nombre,
               COALESCE(pp.objetivo,'') AS perfil_objetivo
        FROM gestor_rh_vacante v
        LEFT JOIN gestor_rh_status_vacante sv ON sv.id = v.status_id
        LEFT JOIN gestor_rh_perfil_puesto pp ON pp.id = v.perfil_puesto_id
        WHERE v.id = %s
    """, (source_id,))
    if not vacancy:
        return JsonResponse({"error": "Vacante no encontrada"}, status=404)

    candidates = db.fetch_all("""
        SELECT vc.id, vc.nombre, vc.correo, vc.status_id,
               COALESCE(cs.descripcion,'') AS status_label
        FROM gestor_rh_vacante_candidato vc
        LEFT JOIN gestor_rh_candidato_status cs ON cs.id = vc.status_id
        WHERE vc.vacante_id = %s
        ORDER BY vc.status_id, vc.nombre
    """, (source_id,))

    by_status, descartados_count = {}, 0
    for c in candidates:
        if c.get("status_id") == 5:
            descartados_count += 1
        label = c["status_label"] or f"Status {c['status_id']}"
        by_status.setdefault(label, []).append({
            "id": c["id"], "nombre": c["nombre"], "correo": c.get("correo", ""),
        })

    characteristics = db.fetch_all(
        "SELECT tipo, descripcion FROM gestor_rh_vacante_caracteristica WHERE vacante_id = %s ORDER BY tipo, id",
        (source_id,),
    )
    history = db.fetch_all("""
        SELECT accion, descripcion, fecha FROM gestor_rh_vacante_historial
        WHERE vacante_id = %s ORDER BY fecha DESC LIMIT 15
    """, (source_id,))

    runs = list(
        MatchRun.objects.filter(vacancy_source_id=source_id)
        .order_by("-executed_at")[:5]
        .values("id", "candidates_evaluated", "top_score", "processing_time_seconds", "executed_at")
    )
    for r in runs:
        r["executed_at"] = r["executed_at"].isoformat() if r["executed_at"] else None

    return JsonResponse({
        "vacancy": {
            "source_id": source_id,
            "perfil": vacancy["perfil_nombre"],
            "objetivo": vacancy["perfil_objetivo"],
            "tipo": vacancy["tipo_vacante"],
            "status": vacancy["status_label"],
            "fecha_solicitud": str(vacancy["fecha_solicitud"]) if vacancy.get("fecha_solicitud") else None,
            "dias_sol_aut": days_between(vacancy.get("fecha_solicitud"), vacancy.get("fecha_autorizacion")),
            "dias_aut_rh": days_between(vacancy.get("fecha_autorizacion"), vacancy.get("fecha_rh")),
        },
        "candidates": {"total": len(candidates), "descartados_count": descartados_count, "by_status": by_status},
        "characteristics": [{"tipo": c["tipo"], "descripcion": c["descripcion"]} for c in characteristics],
        "history": [{"accion": h["accion"], "descripcion": h.get("descripcion", ""),
                     "fecha": str(h["fecha"])[:16] if h.get("fecha") else None} for h in history],
        "matching_runs": runs,
    })


@require_POST
def pipeline_ingest(request):
    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON inválido"}, status=400)
    raw_bs = body.get("batch_size")
    batch_size = int(raw_bs) if raw_bs is not None else None
    if not start_ingest(batch_size=batch_size):
        return JsonResponse({"error": "Proceso corriendo"}, status=409)
    return JsonResponse({"status": "started", "task": "ingest"})


@require_POST
def pipeline_sync(request):
    if not start_sync_vacancies():
        return JsonResponse({"error": "Proceso corriendo"}, status=409)
    return JsonResponse({"status": "started", "task": "sync_vacancies"})


@require_GET
def pipeline_status(request):
    return JsonResponse(get_status())


def _mysql_candidate_status_batch(candidate_ids):
    if not candidate_ids:
        return {}
    ph = ",".join(["%s"] * len(candidate_ids))
    sql = (
        "SELECT vc.id AS cid, vc.status_id, COALESCE(cs.descripcion,'') AS status_label, "
        "vc.vacante_id, COALESCE(pp.nombre,'') AS vacante_perfil "
        "FROM gestor_rh_vacante_candidato vc "
        "LEFT JOIN gestor_rh_candidato_status cs ON cs.id=vc.status_id "
        "LEFT JOIN gestor_rh_vacante v ON v.id=vc.vacante_id "
        "LEFT JOIN gestor_rh_perfil_puesto pp ON pp.id=v.perfil_puesto_id "
        f"WHERE vc.id IN ({ph})"
    )
    try:
        rows = MySQLClient().fetch_all(sql, tuple(candidate_ids))
    except Exception:
        return {}
    out = {}
    for r in rows:
        cid = int(r["cid"])
        sl = r.get("status_label") or ""
        if r.get("vacante_id"):
            label = f"{sl} en #{r['vacante_id']}"
            if r.get("vacante_perfil"):
                label = f"{sl} en #{r['vacante_id']} — {r['vacante_perfil']}"
        else:
            label = sl
        out[cid] = {"status_id": r.get("status_id"), "status_label": label}
    return out


def _match_candidate_row(cs, meta, cst, source_vacante_id, chunk_rows):
    secs = {}
    for c in chunk_rows:
        st = c["section_type"]
        secs[st] = secs.get(st, "") + ("\n" if st in secs else "") + c["content"]
    return {
        "rank": 0, "document_id": cs.document_id,
        "source_candidate_id": cs.source_candidate_id,
        "source_vacante_id": source_vacante_id,
        "candidate_name": meta.get("candidate_name", "—"),
        "candidate_email": meta.get("candidate_email", ""),
        "score": cs.score_100,
        "full_profile_score": round(cs.full_profile_similarity * 100),
        "candidate_status": cst,
        "section_scores": [
            {"section_type": s.section_type, "label": s.label, "score_100": s.score_100}
            for s in cs.section_scores if s.matched_chunks > 0
        ],
        "chunks_summary": secs,
    }
