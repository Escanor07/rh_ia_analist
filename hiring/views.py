import json
import time
from collections import defaultdict

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.db.models import Count, Q
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from hiring.auth import jwt_required
from hiring.models import CandidateChunk, CandidateDocument, GlobalStandard, MatchRun, MatchRunCandidate, Vacancy
from hiring.services.analytics.dates import days_between
from hiring.services.analytics.funnel import FunnelAnalyticsService
from hiring.services.matching.pipeline import MatchingPipeline
from hiring.services.matching.scorer import DEFAULT_WEIGHTS, calibrate, prepare_matching_weights
from hiring.services.pipeline_runner import get_status, start_ingest, start_sync_vacancies
from hiring.services.shared.embeddings import EmbeddingService
from hiring.services.shared.mysql_client import MySQLClient
from hiring.services.standards.evaluator import (
    compute_standards_scores,
    evaluate_candidate,
    get_attribute_catalog,
    load_active_standards,
)


def _parse_json_body(request):
    try:
        return (json.loads(request.body) if request.body else {}), None
    except json.JSONDecodeError:
        return None, JsonResponse({"error": "JSON inválido"}, status=400)


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


@jwt_required
@require_GET
def list_vacancies(request):
    qs = Vacancy.objects.order_by("-fecha_solicitud")
    return JsonResponse({"vacancies": [
        {"source_id": v.source_id, "profile_name": v.profile_name, "tipo_vacante": v.tipo_vacante,
         "fecha_solicitud": str(v.fecha_solicitud) if v.fecha_solicitud else None}
        for v in qs
    ]})


@jwt_required
@require_POST
def run_matching(request, source_id):
    try:
        vacancy = Vacancy.objects.get(source_id=source_id)
    except Vacancy.DoesNotExist:
        return JsonResponse({"error": "Vacante no encontrada"}, status=404)

    body, err = _parse_json_body(request)
    if err:
        return err

    top_n = int(body.get("top_n", 10))
    custom = {k: float(v) for k, v in (body.get("weights") or {}).items() if k in DEFAULT_WEIGHTS} or None
    weights = prepare_matching_weights(custom)

    standards = load_active_standards()
    t0 = time.time()

    same_sucursal = bool(body.get("same_sucursal", False))
    allowed_doc_ids: set[int] | None = None
    if same_sucursal and vacancy.sucursal_id:
        try:
            rows = MySQLClient().fetch_all(
                "SELECT id FROM gestor_rh_vacante WHERE sucursal_id = %s",
                (vacancy.sucursal_id,),
            )
            all_suc_vacante_ids = {r["id"] for r in rows}
        except Exception:
            all_suc_vacante_ids = set()

        if all_suc_vacante_ids:
            allowed_doc_ids = set(
                CandidateDocument.objects.filter(
                    source_vacante_id__in=all_suc_vacante_ids,
                    status="processed",
                ).values_list("id", flat=True)
            )

    # First pass without standards
    pipeline = MatchingPipeline(weights=weights, allowed_document_ids=allowed_doc_ids)
    results = pipeline.match_vacancy(vacancy, top_n=top_n * 3)

    # Second pass with standards scores integrated
    standards_scores: dict[int, float] = {}
    if standards and results:
        doc_ids_for_std = list({cs.document_id for cs in results})
        standards_scores = compute_standards_scores(standards, doc_ids_for_std)
        pipeline = MatchingPipeline(weights=weights, standards_score_by_doc=standards_scores, allowed_document_ids=allowed_doc_ids)
        results = pipeline.match_vacancy(vacancy, top_n=top_n * 3)

    elapsed = round(time.time() - t0, 2)

    doc_ids = list({cs.document_id for cs in results})
    cand_ids = list({cs.source_candidate_id for cs in results if cs.source_candidate_id})

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

    # System gates
    excluded = set()
    for cid, cst in status_by_cand.items():
        sid = cst.get("status_id")
        if sid == 8:
            excluded.add(cid)
        if sid == 5 and cst.get("vacante_id") == source_id:
            excluded.add(cid)
    for doc_id, doc in docs.items():
        if (doc.processing_meta_json or {}).get("quality") == "poor":
            for cs in results:
                if cs.document_id == doc_id and cs.source_candidate_id:
                    excluded.add(cs.source_candidate_id)

    vacancy_sections_info = [
        {"section_type": s.section_type, "content": s.content}
        for s in vacancy.sections.all().order_by("section_type")
    ]

    seen = {}
    for cs in results:
        if cs.source_candidate_id and cs.source_candidate_id in excluded:
            continue
        doc = docs.get(cs.document_id)
        if not doc:
            continue
        meta = (doc.processing_meta_json or {}).get("source", {})
        cst = status_by_cand.get(cs.source_candidate_id, {}) if cs.source_candidate_id else {}
        entry = _build_candidate_response(cs, meta, cst, doc, chunks_by_doc.get(cs.document_id, []), vacancy.source_id)
        key = str(cs.source_candidate_id) if cs.source_candidate_id else f"{meta.get('candidate_name', '')}|{meta.get('candidate_email', '')}"
        if key not in seen or entry["score"] > seen[key]["score"]:
            seen[key] = entry

    candidates = sorted(seen.values(), key=lambda c: (c["applied_to_vacancy"], c["score"]), reverse=True)[:top_n]
    for i, c in enumerate(candidates, 1):
        c["rank"] = i

    # Standards detail per candidate
    if standards:
        for c in candidates:
            ev = evaluate_candidate(standards, c["document_id"])
            c["standards_evaluation"] = {
                "all_filters_passed": ev.all_filters_passed,
                "results": [
                    {"name": r.name, "type": r.standard_type, "mode": r.eval_mode,
                     "score_100": r.score_100, "passed": r.passed, "value": r.value}
                    for r in ev.results
                ],
            }

    # Persist
    mr = MatchRun.objects.create(
        vacancy_source_id=vacancy.source_id, vacancy_name=vacancy.profile_name,
        candidates_evaluated=len(candidates),
        top_score=candidates[0]["score"] if candidates else 0,
        processing_time_seconds=elapsed,
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
        cst = c.get("candidate_status")
        if isinstance(cst, dict):
            if "vacante_id" in cst:
                cst["status_vacante_id"] = cst.pop("vacante_id")

    sucursal_nombre = None
    try:
        row = MySQLClient().fetch_one(
            "SELECT nombre FROM zero_dawn.golabs_core_sucursal WHERE id = %s",
            (vacancy.sucursal_id,),
        )
        sucursal_nombre = row.get("nombre") if row else None
    except Exception:
        pass

    return JsonResponse({
        "vacancy": {
            "source_id": vacancy.source_id, "profile_name": vacancy.profile_name,
            "tipo_vacante": vacancy.tipo_vacante, "sections": vacancy_sections_info,
            "sucursal_id": vacancy.sucursal_id, "sucursal_nombre": sucursal_nombre,
        },
        "matching": {
            "candidates": candidates, "processing_time_seconds": elapsed,
            "has_standards": bool(standards),
            "same_sucursal_applied": same_sucursal,
        },
    })


@jwt_required
@require_GET
def default_weights(request):
    return JsonResponse({"weights": DEFAULT_WEIGHTS})


@jwt_required
@require_GET
def dashboard(request):
    try:
        row = MySQLClient().fetch_one(
            """
            SELECT COUNT(*) AS total FROM gestor_rh_candidate_file d
            WHERE d.type_file_id = 1
              AND d.s3_url IS NOT NULL
              AND TRIM(d.s3_url) <> ''
              AND d.created_at >= %s
        """,
            (settings.DATA_CUTOFF_DATE,),
        )
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

    times, q = [], {"good": 0, "weak": 0, "poor": 0}
    for d in CandidateDocument.objects.filter(status="processed").iterator(chunk_size=500):
        meta = d.processing_meta_json or {}
        t = meta.get("pipeline", {}).get("processing_time_seconds")
        if t is not None:
            times.append(t)
        v = meta.get("quality", "unknown")
        if v in q:
            q[v] += 1

    rm = list(
        MatchRun.objects.order_by("-executed_at")[:5]
        .values("id", "vacancy_name", "candidates_evaluated", "top_score")
    )
    try:
        cache_key = f"hiring:dashboard_analytics:{settings.DATA_CUTOFF_DATE}"
        analytics = cache.get(cache_key)
        if analytics is None:
            analytics = FunnelAnalyticsService().get_all()
        cache.set(cache_key, analytics, settings.DASHBOARD_ANALYTICS_CACHE_SECONDS)
    except Exception as e:
        print(f"Error fetching dashboard analytics: {e}")
    return JsonResponse({
        "pipeline": {
            "cvs_indexados_percent": index_rate,
            "cvs_procesados": processed,
            "cvs_total_source": total_cvs_source,
            "cvs_pendientes": max(total_cvs_source - total_our_db, 0),
            "tiempo_promedio_seconds": round(sum(times) / len(times), 2) if times else 0,
            "quality": q, "vacantes_sincronizadas": Vacancy.objects.count(),
        },
        "matching": {
            "total_comparaciones": MatchRun.objects.count(),
            "recent": rm,
        },
        "analytics": analytics,
    })


@jwt_required
@require_GET
def vacancy_detail(request, source_id):
    db = MySQLClient()
    vacancy = db.fetch_one(
        """
        SELECT v.id, v.status_id, v.tipo_vacante, v.fecha_solicitud, v.authorized_at, v.fecha_rh,
               COALESCE(sv.descripcion,'') AS status_label,
               COALESCE(pp.nombre,'') AS perfil_nombre,
               COALESCE(pp.objetivo,'') AS perfil_objetivo
        FROM gestor_rh_vacante v
        LEFT JOIN gestor_rh_vacante_status sv ON sv.id = v.status_id
        LEFT JOIN gestor_rh_perfil_puesto pp ON pp.id = v.perfil_puesto_id
        WHERE v.id = %s
    """,
        (source_id,),
    )
    if not vacancy:
        return JsonResponse({"error": "Vacante no encontrada"}, status=404)

    candidates = db.fetch_all("""
        SELECT vc.id, CONCAT_WS(' ', vc.name, vc.paternal_last_name, vc.maternal_last_name) AS nombre, vc.correo, vc.status_id,
               COALESCE(cs.description,'') AS status_label
        FROM gestor_rh_candidate vc
        LEFT JOIN gestor_rh_candidate_status cs ON cs.id = vc.status_id
        WHERE vc.vacante_id = %s
        ORDER BY vc.status_id, nombre
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
        SELECT action, description, created_at FROM gestor_rh_vacante_history
        WHERE vacante_id = %s ORDER BY created_at DESC LIMIT 15
    """, (source_id,))

    runs = list(
        MatchRun.objects.filter(vacancy_source_id=source_id)
        .order_by("-executed_at")[:5]
        .values("id", "candidates_evaluated", "top_score", "processing_time_seconds", "executed_at")
    )
    for r in runs:
        r["executed_at"] = r["executed_at"].isoformat() if r["executed_at"] else None

    # Candidate pipeline from history table
    pipeline_data = FunnelAnalyticsService().get_vacancy_candidate_pipeline(source_id)

    return JsonResponse({
        "vacancy": {
            "source_id": source_id,
            "perfil": vacancy["perfil_nombre"],
            "objetivo": vacancy["perfil_objetivo"],
            "tipo": vacancy["tipo_vacante"],
            "status": vacancy["status_label"],
            "fecha_solicitud": str(vacancy["fecha_solicitud"]) if vacancy.get("fecha_solicitud") else None,
            "dias_sol_aut": days_between(vacancy.get("fecha_solicitud"), vacancy.get("authorized_at")),
            "dias_aut_rh": days_between(vacancy.get("authorized_at"), vacancy.get("fecha_rh")),
        },
        "candidates": {"total": len(candidates), "descartados_count": descartados_count, "by_status": by_status},
        "characteristics": [{"tipo": c["tipo"], "descripcion": c["descripcion"]} for c in characteristics],
        "history": [{"action": h["action"], "description": h.get("description", ""),
                     "created_at": str(h["created_at"])[:16] if h.get("created_at") else None} for h in history],
        "matching_runs": runs,
        "candidate_pipeline": pipeline_data,
    })


@jwt_required
@require_POST
def pipeline_ingest(request):
    body, err = _parse_json_body(request)
    if err:
        return err
    raw_bs = body.get("batch_size")
    batch_size = int(raw_bs) if raw_bs is not None else None
    if not start_ingest(batch_size=batch_size):
        return JsonResponse({"error": "Proceso corriendo"}, status=409)
    return JsonResponse({"status": "started", "task": "ingest"})


@jwt_required
@require_POST
def pipeline_sync(request):
    if not start_sync_vacancies():
        return JsonResponse({"error": "Proceso corriendo"}, status=409)
    return JsonResponse({"status": "started", "task": "sync_vacancies"})


@jwt_required
@require_GET
def pipeline_status(request):
    return JsonResponse(get_status())


# --- Standards API ---

@jwt_required
@require_GET
def list_standards(request):
    standards = GlobalStandard.objects.all()
    return JsonResponse({"standards": [_standard_to_dict(s) for s in standards]})


@jwt_required
@require_GET
def attribute_catalog(request):
    catalog = get_attribute_catalog()
    return JsonResponse({"catalog": {
        slug: {"name": v["name"], "description": v["description"], "config_schema": v["config_schema"]}
        for slug, v in catalog.items()
    }})


@jwt_required
@require_POST
def create_standard(request):
    body, err = _parse_json_body(request)
    if err:
        return err

    standard_type = body.get("standard_type", "text")
    name = (body.get("name") or "").strip()
    eval_mode = body.get("eval_mode", "score")
    weight = max(0.0, float(body.get("weight", 1.0)))

    if standard_type == "text":
        content = (body.get("content") or "").strip()
        if not name or not content:
            return JsonResponse({"error": "name y content son requeridos"}, status=400)
        embedding_service = EmbeddingService()
        result = embedding_service.embed_texts_with_usage([content])
        embedding = result["embeddings"][0] if result["embeddings"] else None
        standard = GlobalStandard.objects.create(
            name=name, standard_type="text", eval_mode=eval_mode,
            content=content, embedding=embedding, weight=weight, is_active=True,
        )
    elif standard_type == "attribute":
        slug = body.get("attribute_slug", "")
        config = body.get("attribute_config", {})
        if not name or not slug:
            return JsonResponse({"error": "name y attribute_slug son requeridos"}, status=400)
        standard = GlobalStandard.objects.create(
            name=name, standard_type="attribute", eval_mode=eval_mode,
            attribute_slug=slug, attribute_config=config,
            weight=weight, is_active=True,
        )
    else:
        return JsonResponse({"error": "standard_type inválido"}, status=400)

    return JsonResponse(_standard_to_dict(standard))


@jwt_required
@require_POST
def update_standard(request, standard_id):
    try:
        standard = GlobalStandard.objects.get(id=standard_id)
    except GlobalStandard.DoesNotExist:
        return JsonResponse({"error": "Estándar no encontrado"}, status=404)

    body, err = _parse_json_body(request)
    if err:
        return err

    re_embed = False
    if "name" in body:
        standard.name = (body["name"] or "").strip()
    if "eval_mode" in body and body["eval_mode"] in ("score", "filter", "informational"):
        standard.eval_mode = body["eval_mode"]
    if "weight" in body:
        standard.weight = max(0.0, float(body["weight"]))
    if "is_active" in body:
        standard.is_active = bool(body["is_active"])

    if standard.standard_type == "text" and "content" in body:
        new_content = (body["content"] or "").strip()
        if new_content and new_content != standard.content:
            standard.content = new_content
            re_embed = True
    if standard.standard_type == "attribute" and "attribute_config" in body:
        standard.attribute_config = body["attribute_config"]

    if re_embed:
        result = EmbeddingService().embed_texts_with_usage([standard.content])
        standard.embedding = result["embeddings"][0] if result["embeddings"] else None

    standard.save()
    return JsonResponse(_standard_to_dict(standard))


@jwt_required
@require_POST
def delete_standard(request, standard_id):
    try:
        standard = GlobalStandard.objects.get(id=standard_id)
    except GlobalStandard.DoesNotExist:
        return JsonResponse({"error": "Estándar no encontrado"}, status=404)
    standard.delete()
    return JsonResponse({"deleted": True})


def _standard_to_dict(s):
    return {
        "id": s.id, "name": s.name, "standard_type": s.standard_type,
        "eval_mode": s.eval_mode, "content": s.content,
        "attribute_slug": s.attribute_slug, "attribute_config": s.attribute_config,
        "weight": s.weight, "is_active": s.is_active, "has_embedding": s.embedding is not None,
    }


# --- Helpers ---

def _mysql_candidate_status_batch(candidate_ids):
    if not candidate_ids:
        return {}
    ph = ",".join(["%s"] * len(candidate_ids))
    sql = (
        "SELECT vc.id AS cid, vc.status_id, COALESCE(cs.description,'') AS status_label, "
        "vc.vacante_id, COALESCE(pp.nombre,'') AS vacante_perfil "
        "FROM gestor_rh_candidate vc "
        "LEFT JOIN gestor_rh_candidate_status cs ON cs.id=vc.status_id "
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
        out[cid] = {"status_id": r.get("status_id"), "status_label": sl, "vacante_id": r.get("vacante_id"), "vacante_perfil": r.get("vacante_perfil") or ""}
    return out


EDUCATION_LABELS = {
    "none": "Sin estudios", "secundaria": "Secundaria", "preparatoria": "Preparatoria",
    "tecnico": "Técnico", "licenciatura": "Licenciatura", "maestria": "Maestría", "doctorado": "Doctorado",
}
STABILITY_LABELS = {"alta": "Alta", "media": "Media", "baja": "Baja", "unknown": "—"}


def _build_candidate_response(cs, meta, cst, doc, chunk_rows, vacancy_source_id):
    secs = {}
    for c in chunk_rows:
        st = c["section_type"]
        secs[st] = secs.get(st, "") + ("\n" if st in secs else "") + c["content"]

    attrs = (doc.processing_meta_json or {}).get("attributes", {})
    stability = attrs.get("stability", {})

    return {
        "rank": 0, "document_id": cs.document_id,
        "source_candidate_id": cs.source_candidate_id,
        "source_vacante_id": doc.source_vacante_id,
        "candidate_name": meta.get("candidate_name", "—"),
        "candidate_email": meta.get("candidate_email", ""),
        "score": cs.score_100,
        "full_profile_score": round(calibrate(cs.full_profile_similarity) * 100),
        "candidate_status": cst,
        "applied_to_vacancy": bool(doc.source_vacante_id and doc.source_vacante_id == vacancy_source_id),
        "section_scores": [
            {"section_type": s.section_type, "label": s.label,
             "score_100": s.score_100, "matched": s.matched, "in_vacancy": s.weight > 0}
            for s in cs.section_scores
        ],
        "metadata": {
            "experience_years": attrs.get("experience_years"),
            "education_level": EDUCATION_LABELS.get(attrs.get("education_level", ""), "—"),
            "skills_count": len(attrs.get("skills_list", [])),
            "skills_preview": attrs.get("skills_list", [])[:10],
            "stability_level": STABILITY_LABELS.get(stability.get("level", "unknown"), "—"),
            "stability_months": stability.get("recent_avg_months", 0),
            "total_positions": stability.get("total_positions", 0),
            "languages": attrs.get("languages_detected", []),
        },
        "chunks_summary": secs,
    }
