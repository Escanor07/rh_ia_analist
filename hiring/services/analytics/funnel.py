import re
from dataclasses import dataclass
from datetime import datetime
from django.conf import settings
from hiring.services.analytics.dates import days_between
from hiring.services.shared.mysql_client import MySQLClient

DISCARD_PATTERNS = [
    ("Expectativa salarial", re.compile(r"percepci[oó]n econ[oó]mica|salari|sueldo|econ[oó]mica.*superior", re.I)),
    ("Otra oferta", re.compile(r"otra oferta|otra empresa|acepto.*otra|declin[oó]", re.I)),
    ("Inconsistencia documental", re.compile(r"inconsistencia|investigaci[oó]n|socioecon[oó]mico|document", re.I)),
    ("Abandono", re.compile(r"no continu[oó]|no respondi[oó]|no se present[oó]|sin respuesta|abandon|desisti", re.I)),
    ("Perfil no apto", re.compile(r"no cumple|no cuenta|perfil|experiencia.*enfocad|no apto", re.I)),
    ("Otro", re.compile(r".*")),
]

@dataclass(frozen=True)
class FunnelStage:
    key: str
    label: str
    aliases: tuple[str, ...]


# Canonical funnel stages. Aliases cover legacy Spanish actions and new client actions.
_FUNNEL_STAGES: tuple[FunnelStage, ...] = (
    FunnelStage("new_candidate", "Filtros RH", ("Nuevo Candidato", "Nuevo", "created")),
    FunnelStage("scheduled", "Agenda Entrevista", ("Se agenda la entrevista", "Agendar", "scheduled")),
    FunnelStage("interviewed", "Entrevistado", ("Entrevistado", "interview")),
    FunnelStage("final_candidate", "Finalista", ("Candidato Final", "Final", "final_candidate")),
    FunnelStage("offer", "Propuesta", ("propuesta", "offer")),
    FunnelStage("hired", "Contratado", ("Vacante Finalizada", "finished")),
)


class FunnelStageRegistry:
    def __init__(self, stages: tuple[FunnelStage, ...]):
        self.stages = stages
        self.by_key = {stage.key: stage for stage in stages}
        self.labels = tuple(stage.label for stage in stages)
        self.history_actions = tuple(dict.fromkeys(
            alias for stage in stages for alias in stage.aliases
        ))
        self.history_actions_sql_in = ", ".join(["%s"] * len(self.history_actions))
        self._action_to_key = {
            alias.strip().casefold(): stage.key
            for stage in stages
            for alias in stage.aliases
        }

    def resolve_key(self, action: str | None) -> str | None:
        return self._action_to_key.get((action or "").strip().casefold())

    def resolve_label(self, action: str | None) -> str:
        key = self.resolve_key(action)
        return self.by_key[key].label if key else (action or "—")


FUNNEL = FunnelStageRegistry(_FUNNEL_STAGES)


class FunnelAnalyticsService:
    def __init__(self):
        self.db = MySQLClient()
        self.cutoff = settings.DATA_CUTOFF_DATE

    def get_all(self) -> dict:
        with self.db.scoped_queries() as s:
            totals = s.fetch_one("""
                SELECT
                    (SELECT COUNT(*) FROM gestor_rh_candidate vc
                        INNER JOIN gestor_rh_vacante v ON v.id=vc.vacante_id WHERE v.fecha_solicitud >= %s) AS candidatos,
                    (SELECT COUNT(*) FROM gestor_rh_candidate vc
                        INNER JOIN gestor_rh_vacante v ON v.id=vc.vacante_id WHERE v.fecha_solicitud >= %s AND vc.status_id=5) AS descartados,
                    (SELECT COUNT(*) FROM gestor_rh_candidate vc
                        INNER JOIN gestor_rh_vacante v ON v.id=vc.vacante_id WHERE v.fecha_solicitud >= %s AND vc.status_id=8) AS contratados
            """, (self.cutoff,) * 3) or {}
            tc, th, td = totals.get("candidatos", 0), totals.get("contratados", 0), totals.get("descartados", 0)

            return {
                "totals": {
                    "candidatos": tc, "contratados": th, "descartados": td,
                    "conversion_rate": _pct(th, tc), "drop_off_rate": _pct(td, tc),
                },
                "candidate_funnel": self._candidate_funnel(s),
                "vacancy_sla": self._vacancy_sla(s),
                "discard_reasons": self._discard_reasons(s, 50),
                "all_vacancies": self._get_all_vacancies(s),
                "candidate_sla": self._candidate_sla(s),
                "turnover": self._turnover_stats(s),
            }

    def _candidate_funnel(self, s) -> dict:
        rows = s.fetch_all(f"""
            SELECT h.candidate_id, h.action
            FROM gestor_rh_candidate_history h
            INNER JOIN gestor_rh_candidate vc ON vc.id = h.candidate_id
            INNER JOIN gestor_rh_vacante v ON v.id = vc.vacante_id
            WHERE v.fecha_solicitud >= %s
            AND h.action IN ({FUNNEL.history_actions_sql_in})
        """, (self.cutoff, *FUNNEL.history_actions))

        stage_candidates: dict[str, set] = {
            stage.key: set()
            for stage in FUNNEL.stages
        }

        for r in rows:
            stage_key = FUNNEL.resolve_key(r.get("action"))

            if not stage_key:
                continue

            stage_candidates[stage_key].add(r["candidate_id"])

        all_cids = set().union(*stage_candidates.values()) if stage_candidates else set()
        total = len(all_cids)

        stages = []

        for stage in FUNNEL.stages:
            count = len(stage_candidates.get(stage.key, set()))

            if count > 0:
                stages.append({
                    "label": stage.label,
                    "count": count,
                    "pct": _pct(count, total),
                })

        return {"stages": stages, "total": total}

    def _vacancy_sla(self, s) -> dict:
        rows = s.fetch_all("""
            SELECT fecha_solicitud, authorized_at, fecha_rh
            FROM gestor_rh_vacante WHERE fecha_solicitud >= %s
        """, (self.cutoff,))
        sa, ar, sr = [], [], []
        for r in rows:
            d1 = days_between(r.get("fecha_solicitud"), r.get("authorized_at"))
            d2 = days_between(r.get("authorized_at"), r.get("fecha_rh"))
            d3 = days_between(r.get("fecha_solicitud"), r.get("fecha_rh"))
            if d1 is not None and d1 >= 0:
                sa.append(d1)
            if d2 is not None and d2 >= 0:
                ar.append(d2)
            if d3 is not None and d3 >= 0:
                sr.append(d3)
        return {
            "solicitud_autorizacion": {"promedio": _avg(sa), "medidos": len(sa)},
            "autorizacion_rh": {"promedio": _avg(ar), "medidos": len(ar)},
            "total_proceso": {"promedio": _avg(sr), "medidos": len(sr)},
        }

    def _discard_reasons(self, s, limit: int) -> dict:
        rows = s.fetch_all("""
            SELECT h.description
            FROM gestor_rh_vacante_history h
            LEFT JOIN gestor_rh_vacante v ON v.id=h.vacante_id
            WHERE h.action IN ('Actualización de candidato', 'candidato')
              AND (h.description LIKE '%%descarto%%' OR h.description LIKE '%%deshabilitado%%')
              AND v.fecha_solicitud >= %s
            ORDER BY h.created_at DESC LIMIT %s
        """, (self.cutoff, limit))
        cats = {}
        for r in rows:
            parts = r.get("description", "").split(" por ", 1)
            reason = parts[1].strip() if len(parts) > 1 else r.get("description", "")
            cat = _categorize(reason)
            cats[cat] = cats.get(cat, 0) + 1
        return {"by_category": cats}

    def _get_all_vacancies(self, s) -> list:
        rows = s.fetch_all("""
            SELECT v.id AS vid, COALESCE(pp.nombre,'') AS perfil,
                   COALESCE(sv.description,'') AS status, v.status_id,
                   v.fecha_solicitud,
                   (SELECT COUNT(*) FROM gestor_rh_candidate vc WHERE vc.vacante_id=v.id) AS candidatos,
                   (SELECT COUNT(*) FROM gestor_rh_candidate vc WHERE vc.vacante_id=v.id AND vc.status_id=5) AS descartados
            FROM gestor_rh_vacante v
            LEFT JOIN gestor_rh_perfil_puesto pp ON pp.id=v.perfil_puesto_id
            LEFT JOIN gestor_rh_vacante_status sv ON sv.id=v.status_id
            WHERE v.status_id != 10 AND v.fecha_solicitud >= %s
            ORDER BY v.fecha_solicitud DESC
        """, (self.cutoff,))
        return [{"vacante_id": r["vid"], "perfil": r["perfil"], "status": r["status"],
                 "candidatos": r["candidatos"], "descartados": r["descartados"],
                 "fecha": str(r["fecha_solicitud"]) if r.get("fecha_solicitud") else None}
                for r in rows]

    def _candidate_sla(self, s) -> dict:
        rows = s.fetch_all(f"""
            SELECT h.candidate_id, h.action, h.created_at
            FROM gestor_rh_candidate_history h
            INNER JOIN gestor_rh_candidate vc ON vc.id = h.candidate_id
            INNER JOIN gestor_rh_vacante v ON v.id = vc.vacante_id
            WHERE v.fecha_solicitud >= %s
            AND h.action IN ({FUNNEL.history_actions_sql_in})
            ORDER BY h.candidate_id, h.created_at
        """, (self.cutoff, *FUNNEL.history_actions))

        by_candidate: dict[int, list[tuple[str, object]]] = {}

        for r in rows:
            stage_key = FUNNEL.resolve_key(r.get("action"))

            if not stage_key:
                continue

            cid = r["candidate_id"]
            by_candidate.setdefault(cid, []).append((stage_key, r["created_at"]))

        transitions: dict[str, list[float]] = {}

        for cid, actions in by_candidate.items():
            for i in range(len(actions) - 1):
                from_stage_key, from_date = actions[i]
                to_stage_key, to_date = actions[i + 1]

                if from_stage_key == to_stage_key:
                    continue

                if from_date and to_date:
                    delta = (to_date - from_date).total_seconds() / 86400

                    if 0 <= delta <= 365:
                        from_label = FUNNEL.by_key[from_stage_key].label
                        to_label = FUNNEL.by_key[to_stage_key].label
                        key = f"{from_label} → {to_label}"

                        transitions.setdefault(key, []).append(delta)

        sla_stages = []

        for key, days_list in transitions.items():
            if len(days_list) >= 2:
                sla_stages.append({
                    "transition": key,
                    "avg_days": round(_avg(days_list), 1),
                    "count": len(days_list),
                })

        sla_stages.sort(key=lambda x: x["count"], reverse=True)

        return {"stages": sla_stages[:10]}

    def _turnover_stats(self, s) -> dict:
        rows = s.fetch_all("""
            SELECT ct.id, ct.reason, ct.type, ct.request_date, ct.termination_date,
                   ct.collaborator_id
            FROM gestor_rh_collaborator_termination ct
            ORDER BY ct.termination_date DESC
        """)

        if not rows:
            return {"total": 0, "by_type": {}, "reasons": []}

        by_type: dict[str, int] = {}
        reasons: dict[str, int] = {}

        for r in rows:
            t = (r.get("type") or "Otro").strip()
            by_type[t] = by_type.get(t, 0) + 1
            reason = (r.get("reason") or "").strip()
            if reason:
                reasons[reason] = reasons.get(reason, 0) + 1

        sorted_reasons = sorted(reasons.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            "total": len(rows),
            "by_type": by_type,
            "reasons": [{"reason": r, "count": c} for r, c in sorted_reasons],
        }

    def get_vacancy_candidate_pipeline(self, vacancy_id: int) -> dict:
        rows = self.db.fetch_all("""
            SELECT h.candidate_id, h.action, h.description, h.created_at,
                   vc.name AS candidato_nombre
            FROM gestor_rh_candidate_history h
            INNER JOIN gestor_rh_candidate vc ON vc.id = h.candidate_id
            WHERE vc.vacante_id = %s
            ORDER BY h.created_at ASC
        """, (vacancy_id,))

        by_candidate: dict[int, dict] = {}
        for r in rows:
            cid = r["candidate_id"]
            if cid not in by_candidate:
                by_candidate[cid] = {
                    "candidato_id": cid,
                    "nombre": r.get("candidato_nombre", ""),
                    "events": [],
                }
            by_candidate[cid]["events"].append({
                "accion": r["action"],
                "descripcion": r.get("description", ""),
                "fecha": str(r["created_at"])[:16] if r.get("created_at") else None,
            })

        # Compute SLA per candidate
        candidates = []
        for cid, data in by_candidate.items():
            events = data["events"]
            total_days = None
            if len(events) >= 2:
                first = events[0].get("fecha")
                last = events[-1].get("fecha")
                if first and last:
                    try:
                        t0 = datetime.fromisoformat(first.replace(" ", "T"))
                        t1 = datetime.fromisoformat(last.replace(" ", "T"))
                        total_days = round((t1 - t0).total_seconds() / 86400, 1)
                    except (ValueError, TypeError):
                        pass

            funnel_events = [
                e for e in events
                if FUNNEL.resolve_key(e.get("accion"))
            ]

            current_stage = (
                FUNNEL.resolve_label(funnel_events[-1]["accion"])
                if funnel_events
                else events[-1]["accion"] if events else "—"
            )

            candidates.append({
                "candidato_id": cid,
                "nombre": data["nombre"],
                "current_stage": current_stage,
                "total_events": len(events),
                "total_days": total_days,
                "events": events,
            })

        candidates.sort(key=lambda c: c["total_events"], reverse=True)

        stage_counts: dict[str, int] = {}
        for c in candidates:
            seen = set()

            for e in c["events"]:
                if not FUNNEL.resolve_key(e.get("accion")):
                    continue

                label = FUNNEL.resolve_label(e.get("accion"))
                seen.add(label)

            for label in seen:
                stage_counts[label] = stage_counts.get(label, 0) + 1

        total_candidates = len(candidates)
        conversion = []
        for stage_label in FUNNEL.labels:
            count = stage_counts.get(stage_label, 0)
            if count > 0:
                conversion.append({
                    "stage": stage_label,
                    "count": count,
                    "pct": _pct(count, total_candidates),
                })

        return {
            "candidates": candidates[:50],
            "conversion": conversion,
            "total_candidates": total_candidates,
        }


def _pct(p, t):
    return round(p / t * 100, 1) if t > 0 else 0.0


def _avg(v):
    return round(sum(v) / len(v), 1) if v else 0.0


def _categorize(t):
    for label, pat in DISCARD_PATTERNS:
        if pat.search(t):
            return label
    return "Otro"
