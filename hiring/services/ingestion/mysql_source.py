from dataclasses import dataclass
from django.conf import settings
from hiring.services.shared.mysql_client import MySQLClient


@dataclass
class SourceCVRecord:
    doc_id: int
    candidate_id: int | None
    collaborator_id: int | None
    vacante_id: int | None
    candidate_name: str
    candidate_email: str
    candidate_phone: str
    upload_date: str | None
    source_key: str


class MySQLSourceService:
    BASE_QUERY = """
        SELECT
            d.id AS doc_id,
            d.candidate_id,
            d.created_by_id,
            d.created_at AS upload_date,
            d.s3_url AS source_key,
            COALESCE(CONCAT_WS(' ', vc.name, vc.paternal_first_name, vc.maternal_first_name), '') AS candidate_name,
            COALESCE(vc.correo, '') AS candidate_email,
            COALESCE(vc.celular, '') AS candidate_phone,
            vc.vacante_id
        FROM gestor_rh_candidate_file d
        INNER JOIN gestor_rh_candidate_type_file tf ON tf.id = d.type_file_id
        LEFT JOIN gestor_rh_candidate vc
            ON vc.id = d.candidate_id
        WHERE (tf.name = 'CV' OR tf.name = 'Curriculum vitae')
          AND d.s3_url IS NOT NULL
          AND TRIM(d.s3_url) <> ''
          AND d.created_at >= %s
    """

    ORDER_BY = " ORDER BY d.created_at DESC, d.id DESC"

    def __init__(self):
        self.db = MySQLClient()

    def fetch_cv_records(self, limit: int | None = None) -> list[SourceCVRecord]:
        query = self.BASE_QUERY + self.ORDER_BY
        params = (settings.DATA_CUTOFF_DATE,)

        if limit is not None:
            query += " LIMIT %s"
            params = (settings.DATA_CUTOFF_DATE, limit)

        rows = self.db.fetch_all(query, params)
        return [self._map_row(row) for row in rows]

    def fetch_cv_record_by_doc_id(self, doc_id: int) -> SourceCVRecord | None:
        query = self.BASE_QUERY + " AND d.id = %s LIMIT 1"
        rows = self.db.fetch_all(query, (settings.DATA_CUTOFF_DATE, doc_id))

        if not rows:
            return None

        return self._map_row(rows[0])

    def _map_row(self, row: dict) -> SourceCVRecord:
        return SourceCVRecord(
            doc_id=row["doc_id"],
            candidate_id=row["candidate_id"],
            collaborator_id=row["created_by_id"],
            vacante_id=row.get("vacante_id"),
            candidate_name=row["candidate_name"],
            candidate_email=row["candidate_email"],
            candidate_phone=row["candidate_phone"],
            upload_date=str(row["upload_date"]) if row["upload_date"] else None,
            source_key=row["source_key"],
        )
