from django.core.management.base import BaseCommand

from hiring.services.matching.vacancy_sync import VacancySyncService


class Command(BaseCommand):
    help = "Sync vacancies from MySQL of the client (vacancy + vacancy_characteristic)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--source-id",
            type=int,
            default=None,
            help="Sync only a specific vacancy by its ID in MySQL",
        )

    def handle(self, *args, **options):
        source_id = options["source_id"]
        service = VacancySyncService()

        if source_id:
            self.stdout.write(f"Syncing vacancy source_id={source_id}...")
            result = service.sync_by_source_id(source_id)

            for key, value in result.items():
                self.stdout.write(f"  {key}={value}")

            action = result.get("action")
            if action == "not_found":
                self.stdout.write(self.style.ERROR("Vacancy not found in MySQL"))
            elif action == "skipped":
                self.stdout.write(self.style.WARNING("Vacancy without characteristics, skipped"))
            else:
                self.stdout.write(self.style.SUCCESS("Sync complete"))
        else:
            self.stdout.write("Syncing all active vacancies...")
            result = service.sync_all()

            self.stdout.write(self.style.SUCCESS("Sync complete"))
            for key, value in result.items():
                self.stdout.write(f"  {key}={value}")
