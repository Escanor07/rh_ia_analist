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
    path("api/standards/", views.list_standards),
    path("api/standards/catalog/", views.attribute_catalog),
    path("api/standards/create/", views.create_standard),
    path("api/standards/<int:standard_id>/", views.update_standard),
    path("api/standards/<int:standard_id>/delete/", views.delete_standard),
]
