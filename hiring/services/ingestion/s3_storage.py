import os
import tempfile
from dataclasses import dataclass

import boto3
from botocore.exceptions import ClientError
from django.conf import settings


@dataclass
class DownloadedFile:
    source_key: str
    local_path: str
    filename: str
    size_bytes: int


class S3StorageService:
    def __init__(self) -> None:
        self.bucket = settings.S3_CV_BUCKET
        self.client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_DEFAULT_REGION,
        )

    def download_to_temp(self, source_key: str) -> DownloadedFile:
        source_key = (source_key or "").strip()
        if not source_key:
            raise ValueError("source_key is required")

        filename = os.path.basename(source_key) or "document.pdf"

        suffix = ""
        if "." in filename:
            suffix = filename[filename.rfind("."):]

        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp_file.close()

        try:
            self.client.download_file(self.bucket, source_key, tmp_file.name)
        except ClientError as exc:
            if os.path.exists(tmp_file.name):
                os.unlink(tmp_file.name)
            raise RuntimeError(
                f"Failed to download s3://{self.bucket}/{source_key}: {exc}"
            ) from exc

        size_bytes = os.path.getsize(tmp_file.name)

        return DownloadedFile(
            source_key=source_key,
            local_path=tmp_file.name,
            filename=filename,
            size_bytes=size_bytes,
        )