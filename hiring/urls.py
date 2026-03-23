from django.urls import path
from hiring import views

urlpatterns = [
    path("health/", views.health),
    path("api/vacancies/", views.list_vacancies),
    path("api/vacancies/<int:source_id>/match/", views.run_matching),
    path("api/vacancies/<int:source_id>/detail/", views.vacancy_detail),
    path("api/matching/weights/", views.default_weights),
    path("api/dashboard/", views.dashboard),
    path("api/pipeline/ingest/", views.pipeline_ingest),
    path("api/pipeline/sync/", views.pipeline_sync),
    path("api/pipeline/status/", views.pipeline_status),
]
