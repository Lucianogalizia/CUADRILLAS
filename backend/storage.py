import os, uuid
from google.cloud import storage

PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
BUCKET = os.getenv("GCS_BUCKET")

storage_client = storage.Client(project=PROJECT)

def upload_photo(file_bytes: bytes, content_type: str, filename_hint: str = "photo"):
    if not BUCKET:
        raise RuntimeError("Falta GCS_BUCKET en variables de entorno.")
    bucket = storage_client.bucket(BUCKET)

    ext = ""
    if filename_hint and "." in filename_hint:
        ext0 = filename_hint.split(".")[-1].lower().strip()
        if ext0:
            ext = f".{ext0}"

    blob_name = f"events/{uuid.uuid4().hex}{ext}"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(file_bytes, content_type=content_type or "image/jpeg")

    # MVP: público. Luego lo pasamos a Signed URL si querés.
    blob.make_public()
    return blob.public_url
