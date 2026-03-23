import re
from django.conf import settings
from hiring.services.analytics.dates import days_between
from hiring.services.shared.mysql_client import MySQLClient

CANDIDATE_FUNNEL_STATUS_IDS = (1, 2, 3, 4, 6, 7, 8)
VACANCY_FUNNEL_STATUS_IDS = tuple(range(1, 10))
DISCARD_PATTERNS = [
    ("Expectativa salarial", re.compile(r"percepci[oó]n econ[oó]mica|salari|sueldo|econ[oó]mica.*superior", re.I)),
    ("Otra oferta", re.compile(r"otra oferta|otra empresa|acepto.*otra|declin[oó]", re.I)),
    ("Inconsistencia documental", re.compile(r"inconsistencia|investigaci[oó]n|socioecon[oó]mico|document", re.I)),
    ("Abandono", re.compile(r"no continu[oó]|no respondi[oó]|no se present[oó]|sin respuesta|abandon|desisti", re.I)),
    ("Perfil no apto", re.compile(r"no cumple|no cuenta|perfil|experiencia.*enfocad|no apto", re.I)),
    ("Otro", re.compile(r".*")),
]


class FunnelAnalyticsService:
    def __init__(self):
        self.db = MySQLClient()
        self.cutoff = settings.DATA_CUTOFF_DATE

    def get_all(self) -> dict:
        with self.db.scoped_queries() as s:
            totals = s.fetch_one("""
                SELECT
                    (SELECT COUNT(*) FROM gestor_rh_vacante_candidato vc
                        INNER JOIN gestor_rh_vacante v ON v.id=vc.vacante_id WHERE v.fecha_solicitud >= %s) AS candidatos,
                    (SELECT COUNT(*) FROM gestor_rh_vacante_candidato vc
                        INNER JOIN gestor_rh_vacante v ON v.id=vc.vacante_id WHERE v.fecha_solicitud >= %s AND vc.status_id=5) AS descartados,
                    (SELECT COUNT(*) FROM gestor_rh_vacante_candidato vc
                        INNER JOIN gestor_rh_vacante v ON v.id=vc.vacante_id WHERE v.fecha_solicitud >= %s AND vc.status_id=8) AS contratados
            """, (self.cutoff,) * 3) or {}
            tc, th, td = totals.get("candidatos", 0), totals.get("contratados", 0), totals.get("descartados", 0)

            return {
                "totals": {
                    "candidatos": tc, "contratados": th, "descartados": td,
                    "conversion_rate": _pct(th, tc), "drop_off_rate": _pct(td, tc),
                },
                "candidate_funnel": self._candidate_funnel(s),
                "vacancy_funnel": self._vacancy_funnel(s),
                "vacancy_sla": self._vacancy_sla(s),
                "discard_reasons": self._discard_reasons(s, 30),
                "active_vacancies": self._get_active_vacancies(s),
            }

    def _candidate_funnel(self, s) -> dict:
        rows = s.fetch_all("""
            SELECT cs.id AS sid, cs.descripcion AS label, COUNT(vc.id) AS total
            FROM gestor_rh_candidato_status cs
            LEFT JOIN (gestor_rh_vacante_candidato vc
                INNER JOIN gestor_rh_vacante v ON v.id=vc.vacante_id AND v.fecha_solicitud >= %s
            ) ON vc.status_id=cs.id
            GROUP BY cs.id, cs.descripcion ORDER BY cs.id
        """, (self.cutoff,))
        labels = {r["sid"]: r["label"] for r in rows}
        counts = {r["sid"]: r["total"] for r in rows}
        total = sum(counts.get(sid, 0) for sid in CANDIDATE_FUNNEL_STATUS_IDS) + counts.get(5, 0)

        stages = []
        for sid in CANDIDATE_FUNNEL_STATUS_IDS:
            c = counts.get(sid, 0)
            stages.append({
                "status_id": sid, "label": labels.get(sid, ""),
                "count": c,
                "pct_of_total": _pct(c, total) if total > 0 else 0,
            })

        return {"stages": stages, "descartados": counts.get(5, 0), "propuestas": counts.get(9, 0)}

    def _vacancy_funnel(self, s) -> dict:
        rows = s.fetch_all("""
            SELECT sv.id AS sid, sv.descripcion AS label, COUNT(v.id) AS total
            FROM gestor_rh_status_vacante sv
            LEFT JOIN gestor_rh_vacante v ON v.status_id=sv.id AND v.fecha_solicitud >= %s
            GROUP BY sv.id, sv.descripcion ORDER BY sv.id
        """, (self.cutoff,))
        labels = {r["sid"]: r["label"] for r in rows}
        counts = {r["sid"]: r["total"] for r in rows}
        stages = [
            {"status_id": sid, "label": labels.get(sid, ""), "count": counts.get(sid, 0)}
            for sid in VACANCY_FUNNEL_STATUS_IDS
        ]
        return {"stages": stages}

    def _vacancy_sla(self, s) -> dict:
        rows = s.fetch_all("""
            SELECT fecha_solicitud, fecha_autorizacion, fecha_rh
            FROM gestor_rh_vacante WHERE fecha_solicitud >= %s
        """, (self.cutoff,))
        sa, ar, sr = [], [], []
        for r in rows:
            d1 = days_between(r.get("fecha_solicitud"), r.get("fecha_autorizacion"))
            d2 = days_between(r.get("fecha_autorizacion"), r.get("fecha_rh"))
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
            SELECT h.descripcion
            FROM gestor_rh_vacante_historial h
            LEFT JOIN gestor_rh_vacante v ON v.id=h.vacante_id
            WHERE h.accion='Actualización de candidato' AND h.descripcion LIKE '%%descarto%%'
              AND v.fecha_solicitud >= %s
            ORDER BY h.fecha DESC LIMIT %s
        """, (self.cutoff, limit))
        cats = {}
        for r in rows:
            parts = r.get("descripcion", "").split(" por ", 1)
            reason = parts[1].strip() if len(parts) > 1 else r.get("descripcion", "")
            cat = _categorize(reason)
            cats[cat] = cats.get(cat, 0) + 1
        return {"by_category": cats}

    def _get_active_vacancies(self, s) -> list:
        rows = s.fetch_all("""
            SELECT v.id AS vid, COALESCE(pp.nombre,'') AS perfil,
                   COALESCE(sv.descripcion,'') AS status,
                   (SELECT COUNT(*) FROM gestor_rh_vacante_candidato vc WHERE vc.vacante_id=v.id) AS candidatos,
                   (SELECT COUNT(*) FROM gestor_rh_vacante_candidato vc WHERE vc.vacante_id=v.id AND vc.status_id=5) AS descartados
            FROM gestor_rh_vacante v
            LEFT JOIN gestor_rh_perfil_puesto pp ON pp.id=v.perfil_puesto_id
            LEFT JOIN gestor_rh_status_vacante sv ON sv.id=v.status_id
            WHERE v.status_id BETWEEN 2 AND 8 AND v.fecha_solicitud >= %s
            ORDER BY v.status_id, v.fecha_solicitud DESC
        """, (self.cutoff,))
        return [{"vacante_id": r["vid"], "perfil": r["perfil"], "status": r["status"],
                 "candidatos": r["candidatos"], "descartados": r["descartados"]} for r in rows]


def _pct(p, t): return round(p / t * 100, 1) if t > 0 else 0.0


def _avg(v): return round(sum(v) / len(v), 1) if v else 0.0


def _categorize(t):
    for label, pat in DISCARD_PATTERNS:
        if pat.search(t):
            return label
    return "Otro"
