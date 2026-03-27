from django.conf import settings
from django.db import models
from pgvector.django import HnswIndex, VectorField


class CandidateDocument(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSED = "processed", "Processed"
        FAILED = "failed", "Failed"

    source_key = models.TextField(unique=True)
    filename = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    source_candidate_id = models.IntegerField(null=True, blank=True,help_text="gestor_rh_vacante_candidato.id")
    source_vacante_id = models.IntegerField(null=True, blank=True,help_text="gestor_rh_vacante.id")
    processing_meta_json = models.JSONField(default=dict, blank=True)
    last_error = models.TextField(blank=True, default="")
    indexed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.filename} [{self.status}]"


class CandidateChunk(models.Model):
    class SectionType(models.TextChoices):
        GENERAL = "general", "General"
        SUMMARY = "summary", "Resumen / Perfil"
        EXPERIENCE = "experience", "Experiencia"
        EDUCATION = "education", "Educación"
        SKILLS = "skills", "Habilidades / Software"
        LANGUAGES = "languages", "Idiomas"
        CERTIFICATIONS = "certifications", "Certificaciones / Capacitación"

    document = models.ForeignKey(CandidateDocument, related_name="chunks", on_delete=models.CASCADE)
    chunk_index = models.PositiveIntegerField()
    section_type = models.CharField(max_length=30, choices=SectionType.choices, default=SectionType.GENERAL)
    content = models.TextField()
    embedding = VectorField(dimensions=settings.OPENAI_EMBEDDING_DIMENSIONS, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["document_id", "chunk_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "chunk_index"],
                name="uniq_candidate_chunk_document_index",
            ),
        ]
        indexes = [
            HnswIndex(
                name="cand_chunk_embedding_hnsw",
                fields=["embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
        ]

    def __str__(self):
        return f"{self.document_id} :: {self.section_type} :: chunk {self.chunk_index}"


class Vacancy(models.Model):
    source_id = models.IntegerField(unique=True, help_text="gestor_rh_vacante.id")
    profile_name = models.CharField(max_length=255, help_text="Nombre del perfil de puesto asociado")
    profile_source_id = models.IntegerField(null=True, blank=True, help_text="gestor_rh_perfil_puesto.id")
    tipo_vacante = models.CharField(max_length=50, blank=True, default="")
    status_id = models.IntegerField(null=True, blank=True)
    sucursal_id = models.IntegerField(null=True, blank=True)
    fecha_solicitud = models.DateField(null=True, blank=True)
    full_content = models.TextField(blank=True, default="")
    full_embedding = VectorField(dimensions=settings.OPENAI_EMBEDDING_DIMENSIONS, null=True, blank=True)
    snapshot_hash = models.CharField(max_length=64, blank=True, default="")
    synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_solicitud"]

    def __str__(self):
        return f"{self.profile_name} — Vacante #{self.source_id}"


class VacancySection(models.Model):
    class SectionType(models.TextChoices):
        EDUCATION = "education", "Educación"
        EXPERIENCE = "experience", "Experiencia"
        SKILLS = "skills", "Skills / Software"
        LANGUAGES = "languages", "Idiomas"
        CERTIFICATIONS = "certifications", "Capacitación"
        GENERAL = "general", "General / Adicionales"

    vacancy = models.ForeignKey(Vacancy, related_name="sections", on_delete=models.CASCADE)
    section_type = models.CharField(max_length=30, choices=SectionType.choices)
    content = models.TextField()
    embedding = VectorField(dimensions=settings.OPENAI_EMBEDDING_DIMENSIONS, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["vacancy", "section_type"],
                name="uniq_vacancy_section_type",
            )
        ]

    def __str__(self):
        return f"Vacante #{self.vacancy.source_id} :: {self.section_type}"


class MatchRun(models.Model):
    vacancy_source_id = models.IntegerField()
    vacancy_name = models.CharField(max_length=255)
    candidates_evaluated = models.IntegerField(default=0)
    top_score = models.IntegerField(default=0)
    processing_time_seconds = models.FloatField(default=0)
    weights_used = models.JSONField(default=dict, blank=True)
    executed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-executed_at"]

    def __str__(self):
        return f"Match #{self.id} — {self.vacancy_name}"


class MatchRunCandidate(models.Model):
    match_run = models.ForeignKey(MatchRun, related_name="results", on_delete=models.CASCADE)
    document = models.ForeignKey(CandidateDocument, on_delete=models.CASCADE)
    source_candidate_id = models.IntegerField(null=True, blank=True)
    candidate_name = models.CharField(max_length=255, blank=True, default="")
    rank = models.IntegerField()
    score = models.IntegerField()
    score_breakdown = models.JSONField(default=dict, blank=True)
    candidate_status_at_run = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        ordering = ["match_run", "rank"]

    def __str__(self):
        return f"#{self.rank} {self.candidate_name} ({self.score}%)"


class GlobalStandard(models.Model):
    class StandardType(models.TextChoices):
        TEXT = "text", "Texto"
        ATTRIBUTE = "attribute", "Atributo"

    class EvalMode(models.TextChoices):
        SCORE = "score", "Puntuación"
        FILTER = "filter", "Filtro"
        INFO = "informational", "Informativo"

    name = models.CharField(max_length=200)
    standard_type = models.CharField(max_length=20, choices=StandardType.choices, default=StandardType.TEXT)
    eval_mode = models.CharField(max_length=20, choices=EvalMode.choices, default=EvalMode.SCORE)

    content = models.TextField(blank=True, default="", help_text="Criterio en texto libre (tipo text)")
    embedding = VectorField(dimensions=settings.OPENAI_EMBEDDING_DIMENSIONS, null=True, blank=True)

    attribute_slug = models.CharField(
        max_length=50, blank=True, default="",
        help_text="Slug del atributo: stability, min_experience, min_education, cv_completeness",
    )
    attribute_config = models.JSONField(
        default=dict, blank=True,
        help_text="Config del atributo, ej: {min_level: media}, {min_years: 2}",
    )

    weight = models.FloatField(default=1.0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} [{self.standard_type}/{self.eval_mode}]"
