import hashlib
import logging
from dataclasses import dataclass, field

from django.db import transaction
from django.utils import timezone

from hiring.models import Vacancy, VacancySection
from hiring.services.shared.embeddings import EmbeddingService
from hiring.services.shared.mysql_client import MySQLClient

logger = logging.getLogger(__name__)


CHARACTERISTIC_TYPE_MAP: dict[str, str] = {
    "educación": "education",
    "educacion": "education",
    "experiencia": "experience",
    "responsabilidades": "experience",
    "software": "skills",
    "idiomas": "languages",
    "capacitación": "certifications",
    "capacitacion": "certifications",
    "adicionales": "general",
}

SECTION_LABELS: dict[str, str] = {
    "education": "Educación",
    "experience": "Experiencia y Responsabilidades",
    "skills": "Software y Herramientas",
    "languages": "Idiomas",
    "certifications": "Capacitación",
    "general": "Adicionales",
}

TRIVIAL_VALUES = {"n/a", "na", "ninguno", "ninguna", "no aplica", "-", ".", ""}

@dataclass
class RawCharacteristic:
    tipo: str
    descripcion: str


@dataclass
class RawVacancy:
    source_id: int
    profile_name: str
    profile_source_id: int | None
    objective: str
    tipo_vacante: str
    status_id: int | None
    sucursal_id: int | None
    fecha_solicitud: str | None
    characteristics: list[RawCharacteristic] = field(default_factory=list)


class VacancySyncService:
    VACANTES_QUERY = """
        SELECT
            v.id,
            v.tipo_vacante,
            v.status_id,
            v.sucursal_id,
            v.fecha_solicitud,
            v.perfil_puesto_id,
            COALESCE(pp.nombre, '') AS perfil_nombre,
            COALESCE(pp.objetivo, '') AS perfil_objetivo
        FROM gestor_rh_vacante v
        LEFT JOIN gestor_rh_perfil_puesto pp ON pp.id = v.perfil_puesto_id
        WHERE v.status_id = 4
        ORDER BY v.fecha_solicitud DESC
    """

    SINGLE_VACANTE_QUERY = """
        SELECT
            v.id,
            v.tipo_vacante,
            v.status_id,
            v.sucursal_id,
            v.fecha_solicitud,
            v.perfil_puesto_id,
            COALESCE(pp.nombre, '') AS perfil_nombre,
            COALESCE(pp.objetivo, '') AS perfil_objetivo
        FROM gestor_rh_vacante v
        LEFT JOIN gestor_rh_perfil_puesto pp ON pp.id = v.perfil_puesto_id
        WHERE v.id = %s
    """

    # skill.type=2 → 'software' (tools/herramientas), type=1 → 'adicionales' (knowledge/skills).
    PROFILE_SECTIONS_QUERY = """
        SELECT r.name AS descripcion, 'responsabilidades' AS tipo
        FROM gestor_rh_perfil_puesto_responsibility r
        WHERE r.perfil_puesto_id = %s

        UNION ALL

        SELECT s.name AS descripcion,
               CASE s.type WHEN 2 THEN 'software' ELSE 'adicionales' END AS tipo
        FROM gestor_rh_perfil_puesto_skill s
        WHERE s.perfil_puesto_id = %s

        UNION ALL

        SELECT k.name AS descripcion, 'adicionales' AS tipo
        FROM gestor_rh_perfil_puesto_kpi k
        WHERE k.perfil_puesto_id = %s AND k.active = 1

        UNION ALL

        SELECT gc.name AS descripcion, 'adicionales' AS tipo
        FROM gestor_rh_perfil_puesto_competence ppc
        JOIN gestor_rh_competencia gc ON gc.id = ppc.competencia_id
        WHERE ppc.perfil_puesto_id = %s AND ppc.activated = 1
    """

    PROFILE_SECTIONS_BULK_QUERY = """
        SELECT v.id AS vacante_id, r.name AS descripcion, 'responsabilidades' AS tipo
        FROM gestor_rh_vacante v
        JOIN gestor_rh_perfil_puesto_responsibility r ON r.perfil_puesto_id = v.perfil_puesto_id
        WHERE v.status_id = 4 AND v.perfil_puesto_id IS NOT NULL

        UNION ALL

        SELECT v.id AS vacante_id, s.name AS descripcion,
               CASE s.type WHEN 2 THEN 'software' ELSE 'adicionales' END AS tipo
        FROM gestor_rh_vacante v
        JOIN gestor_rh_perfil_puesto_skill s ON s.perfil_puesto_id = v.perfil_puesto_id
        WHERE v.status_id = 4 AND v.perfil_puesto_id IS NOT NULL

        UNION ALL

        SELECT v.id AS vacante_id, k.name AS descripcion, 'adicionales' AS tipo
        FROM gestor_rh_vacante v
        JOIN gestor_rh_perfil_puesto_kpi k ON k.perfil_puesto_id = v.perfil_puesto_id
        WHERE v.status_id = 4 AND v.perfil_puesto_id IS NOT NULL AND k.active = 1

        UNION ALL

        SELECT v.id AS vacante_id, gc.name AS descripcion, 'adicionales' AS tipo
        FROM gestor_rh_vacante v
        JOIN gestor_rh_perfil_puesto_competence ppc ON ppc.perfil_puesto_id = v.perfil_puesto_id
        JOIN gestor_rh_competencia gc ON gc.id = ppc.competencia_id
        WHERE v.status_id = 4 AND v.perfil_puesto_id IS NOT NULL AND ppc.activated = 1

        ORDER BY vacante_id, tipo
    """

    def __init__(self):
        self.db = MySQLClient()
        self.embedding_service = EmbeddingService()

    def sync_all(self) -> dict:
        raw_vacancies = self._fetch_all_vacancies()
        logger.info("Vacancies found: %d", len(raw_vacancies))

        created, updated, unchanged, skipped = 0, 0, 0, 0
        for raw in raw_vacancies:
            if not raw.characteristics:
                skipped += 1
                continue

            result = self._sync_single(raw)
            if result == "created":
                created += 1
            elif result == "updated":
                updated += 1
            else:
                unchanged += 1

        return {
            "total": len(raw_vacancies),
            "created": created,
            "updated": updated,
            "unchanged": unchanged,
            "skipped_no_characteristics": skipped,
        }

    def sync_by_source_id(self, source_id: int) -> dict:
        raw = self._fetch_single(source_id)
        if raw is None:
            return {"action": "not_found", "source_id": source_id}

        if not raw.characteristics:
            return {"action": "skipped", "reason": "no_characteristics", "source_id": source_id}

        result = self._sync_single(raw)
        vacancy = Vacancy.objects.get(source_id=source_id)

        return {
            "action": result,
            "vacancy_id": vacancy.id,
            "source_id": source_id,
            "profile_name": vacancy.profile_name,
            "sections_count": vacancy.sections.count(),
        }

    # --- Fetch from MySQL ---

    def _fetch_all_vacancies(self) -> list[RawVacancy]:
        rows = self.db.fetch_all(self.VACANTES_QUERY)

        # Pull all profile sections in one bulk query, grouped by vacante_id.
        all_sections = self.db.fetch_all(self.PROFILE_SECTIONS_BULK_QUERY)

        chars_by_vacante: dict[int, list[RawCharacteristic]] = {}
        for row in all_sections:
            desc = (row.get("descripcion") or "").strip()
            if self._is_trivial(desc):
                continue
            vid = row["vacante_id"]
            chars_by_vacante.setdefault(vid, []).append(
                RawCharacteristic(tipo=(row.get("tipo") or "").strip(), descripcion=desc)
            )

        vacancies = []
        for row in rows:
            v = self._map_row(row)
            v.characteristics = chars_by_vacante.get(v.source_id, [])
            vacancies.append(v)
        return vacancies

    def _fetch_single(self, source_id: int) -> RawVacancy | None:
        row = self.db.fetch_one(self.SINGLE_VACANTE_QUERY, (source_id,))
        if row is None:
            return None
        v = self._map_row(row)
        v.characteristics = self._fetch_characteristics(v.profile_source_id)
        return v

    def _fetch_characteristics(self, perfil_puesto_id: int | None) -> list[RawCharacteristic]:
        if not perfil_puesto_id:
            return []
        rows = self.db.fetch_all(
            self.PROFILE_SECTIONS_QUERY,
            (perfil_puesto_id, perfil_puesto_id, perfil_puesto_id, perfil_puesto_id),
        )
        return [
            RawCharacteristic(
                tipo=(row.get("tipo") or "").strip(),
                descripcion=(row.get("descripcion") or "").strip(),
            )
            for row in rows
            if not self._is_trivial((row.get("descripcion") or "").strip())
        ]

    def _is_trivial(self, text: str) -> bool:
        return text.lower().strip().rstrip(".") in TRIVIAL_VALUES

    def _map_row(self, row: dict) -> RawVacancy:
        return RawVacancy(
            source_id=row["id"],
            profile_name=(row.get("perfil_nombre") or "").strip(),
            profile_source_id=row.get("perfil_puesto_id"),
            objective=(row.get("perfil_objetivo") or "").strip(),
            tipo_vacante=(row.get("tipo_vacante") or "").strip(),
            status_id=row.get("status_id"),
            sucursal_id=row.get("sucursal_id"),
            fecha_solicitud=str(row["fecha_solicitud"]) if row.get("fecha_solicitud") else None,
        )

    # --- Build content ---

    def _build_sections_content(self, raw: RawVacancy) -> dict[str, str]:
        grouped: dict[str, list[str]] = {}

        for ch in raw.characteristics:
            section_type = CHARACTERISTIC_TYPE_MAP.get(ch.tipo.lower(), "general")
            grouped.setdefault(section_type, []).append(ch.descripcion)

        sections: dict[str, str] = {}
        for section_type, descriptions in grouped.items():
            content = "\n".join(f"• {desc}" for desc in descriptions)
            sections[section_type] = content

        return sections

    def _build_enriched_section(self, raw: RawVacancy, section_type: str, raw_content: str) -> str:
        label = SECTION_LABELS.get(section_type, section_type.title())
        tipo_label = f" ({raw.tipo_vacante})" if raw.tipo_vacante else ""

        header = f"Puesto: {raw.profile_name}{tipo_label}"
        if raw.objective:
            header += f"\nObjetivo del puesto: {raw.objective}"

        return f"{header}\nRequisito de {label}:\n{raw_content}"

    def _build_full_content(self, raw: RawVacancy, sections: dict[str, str]) -> str:
        parts = [f"Puesto: {raw.profile_name}"]
        if raw.tipo_vacante:
            parts[0] += f" ({raw.tipo_vacante})"
        if raw.objective:
            parts.append(f"Objetivo: {raw.objective}")

        for section_type, content in sorted(sections.items()):
            label = SECTION_LABELS.get(section_type, section_type.title())
            parts.append(f"{label}:\n{content}")

        return "\n\n".join(parts)

    def _compute_hash(self, full_content: str, sections: dict[str, str]) -> str:
        sections_text = "|".join(f"{k}:{v}" for k, v in sorted(sections.items()))
        combined = f"{full_content}||{sections_text}"
        return hashlib.sha256(combined.encode("utf-8")).hexdigest()

    # --- Sync logic ---

    def _sync_single(self, raw: RawVacancy) -> str:
        sections_content = self._build_sections_content(raw)
        full_content = self._build_full_content(raw, sections_content)
        content_hash = self._compute_hash(full_content, sections_content)

        existing = Vacancy.objects.filter(source_id=raw.source_id).first()

        if existing and existing.snapshot_hash == content_hash:
            return "unchanged"

        # Build enriched texts for embedding
        texts_to_embed = [full_content]
        section_types_order = list(sections_content.keys())
        for st in section_types_order:
            enriched = self._build_enriched_section(raw, st, sections_content[st])
            texts_to_embed.append(enriched)

        embed_result = self.embedding_service.embed_texts_with_usage(texts_to_embed)
        embeddings = embed_result["embeddings"]

        full_embedding = embeddings[0]
        section_embeddings = {
            st: embeddings[i + 1]
            for i, st in enumerate(section_types_order)
        }

        action = "updated" if existing else "created"

        with transaction.atomic():
            vacancy = existing or Vacancy(source_id=raw.source_id)
            vacancy.profile_name = raw.profile_name
            vacancy.profile_source_id = raw.profile_source_id
            vacancy.tipo_vacante = raw.tipo_vacante
            vacancy.status_id = raw.status_id
            vacancy.sucursal_id = raw.sucursal_id
            vacancy.fecha_solicitud = raw.fecha_solicitud
            vacancy.full_content = full_content
            vacancy.full_embedding = full_embedding
            vacancy.snapshot_hash = content_hash
            vacancy.synced_at = timezone.now()
            vacancy.save()

            vacancy.sections.all().delete()

            for st in section_types_order:
                VacancySection.objects.create(
                    vacancy=vacancy,
                    section_type=st,
                    content=sections_content[st],
                    embedding=section_embeddings[st],
                )

        logger.info(
            "Vacancy #%d '%s' [%s]: %d sections",
            raw.source_id, raw.profile_name, action, len(section_types_order),
        )

        return action
