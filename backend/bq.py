import os
import uuid
from datetime import datetime, timezone
from google.cloud import bigquery

PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
DATASET = os.getenv("BQ_DATASET", "ops_tracking")
TASKS_TABLE = os.getenv("BQ_TASKS_TABLE", "tasks")
EVENTS_TABLE = os.getenv("BQ_EVENTS_TABLE", "events")

client = bigquery.Client(project=PROJECT)

def now_utc_iso():
    return datetime.now(timezone.utc).isoformat()

def _table(name: str) -> str:
    return f"{PROJECT}.{DATASET}.{name}"

def ensure_tables_exist():
    # Crea dataset si no existe (sin romper si ya está)
    ds_id = f"{PROJECT}.{DATASET}"
    try:
        client.get_dataset(ds_id)
    except Exception:
        client.create_dataset(bigquery.Dataset(ds_id), exists_ok=True)

    # tasks
    tasks_id = _table(TASKS_TABLE)
    tasks_schema = [
        bigquery.SchemaField("task_id", "STRING"),
        bigquery.SchemaField("unique_key", "STRING"),
        bigquery.SchemaField("source_file", "STRING"),
        bigquery.SchemaField("contratista", "STRING"),
        bigquery.SchemaField("ot", "STRING"),
        bigquery.SchemaField("ut", "STRING"),
        bigquery.SchemaField("desc_ot", "STRING"),
        bigquery.SchemaField("desc_op", "STRING"),
        bigquery.SchemaField("cuadrilla", "STRING"),
        bigquery.SchemaField("id_cuadrilla", "STRING"),
        bigquery.SchemaField("status", "STRING"),
        bigquery.SchemaField("created_at", "TIMESTAMP"),
        bigquery.SchemaField("updated_at", "TIMESTAMP"),
    ]
    try:
        client.get_table(tasks_id)
    except Exception:
        t = bigquery.Table(tasks_id, schema=tasks_schema)
        client.create_table(t)

    # events
    events_id = _table(EVENTS_TABLE)
    events_schema = [
        bigquery.SchemaField("event_id", "STRING"),
        bigquery.SchemaField("task_id", "STRING"),
        bigquery.SchemaField("unique_key", "STRING"),
        bigquery.SchemaField("ot", "STRING"),
        bigquery.SchemaField("cuadrilla", "STRING"),
        bigquery.SchemaField("id_cuadrilla", "STRING"),
        bigquery.SchemaField("event_type", "STRING"),
        bigquery.SchemaField("event_time", "TIMESTAMP"),
        bigquery.SchemaField("lat", "FLOAT"),
        bigquery.SchemaField("lon", "FLOAT"),
        bigquery.SchemaField("accuracy_m", "FLOAT"),
        bigquery.SchemaField("pause_reason", "STRING"),
        bigquery.SchemaField("comment", "STRING"),
        bigquery.SchemaField("photo_url", "STRING"),
        bigquery.SchemaField("created_at", "TIMESTAMP"),
    ]
    try:
        client.get_table(events_id)
    except Exception:
        t = bigquery.Table(events_id, schema=events_schema)
        client.create_table(t)

def upsert_tasks(rows: list[dict]) -> int:
    """
    Dedup real en BigQuery:
    - Cargamos a staging
    - MERGE a tabla final por unique_key
    """
    if not rows:
        return 0

    ensure_tables_exist()

    staging_name = f"_stg_tasks_{uuid.uuid4().hex}"
    staging_id = _table(staging_name)

    # crear staging con el mismo schema que tasks
    tasks_tbl = client.get_table(_table(TASKS_TABLE))
    stg_tbl = bigquery.Table(staging_id, schema=tasks_tbl.schema)
    stg_tbl.expires = datetime.now(timezone.utc).replace(microsecond=0)
    client.create_table(stg_tbl)

    # cargar JSON a staging
    load_job = client.load_table_from_json(
        rows,
        staging_id,
        job_config=bigquery.LoadJobConfig(
            write_disposition="WRITE_TRUNCATE"
        ),
    )
    load_job.result()

    # merge
    q = f"""
    MERGE `{_table(TASKS_TABLE)}` T
    USING `{staging_id}` S
    ON T.unique_key = S.unique_key
    WHEN NOT MATCHED THEN
      INSERT (task_id, unique_key, source_file, contratista, ot, ut, desc_ot, desc_op, cuadrilla, id_cuadrilla, status, created_at, updated_at)
      VALUES (S.task_id, S.unique_key, S.source_file, S.contratista, S.ot, S.ut, S.desc_ot, S.desc_op, S.cuadrilla, S.id_cuadrilla, S.status, S.created_at, S.updated_at)
    WHEN MATCHED THEN
      UPDATE SET
        source_file = S.source_file,
        status = S.status,
        updated_at = S.updated_at
    """
    client.query(q).result()

    # borrar staging
    client.delete_table(staging_id, not_found_ok=True)
    return len(rows)

def insert_event(row: dict):
    ensure_tables_exist()
    table_id = _table(EVENTS_TABLE)
    errors = client.insert_rows_json(table_id, [row])
    if errors:
        raise RuntimeError(f"BigQuery insert_event errors: {errors}")
    return True

def list_tasks_by_cuadrilla(cuadrilla: str, limit: int = 300):
    q = f"""
    SELECT task_id, unique_key, contratista, ot, ut, desc_ot, desc_op, cuadrilla, id_cuadrilla, source_file, status, created_at
    FROM `{_table(TASKS_TABLE)}`
    WHERE cuadrilla = @cuadrilla
    ORDER BY created_at DESC
    LIMIT {limit}
    """
    job = client.query(
        q,
        job_config=bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("cuadrilla", "STRING", cuadrilla)]
        ),
    )
    return [dict(r) for r in job.result()]

def get_task(task_id: str):
    q = f"""
    SELECT task_id, unique_key, contratista, ot, ut, desc_ot, desc_op, cuadrilla, id_cuadrilla, source_file, status, created_at
    FROM `{_table(TASKS_TABLE)}`
    WHERE task_id = @task_id
    LIMIT 1
    """
    job = client.query(
        q,
        job_config=bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("task_id", "STRING", task_id)]
        ),
    )
    rows = list(job.result())
    return dict(rows[0]) if rows else None

def dashboard_latest(limit: int = 800):
    q = f"""
    WITH ranked AS (
      SELECT
        e.*,
        ROW_NUMBER() OVER (PARTITION BY unique_key ORDER BY event_time DESC, created_at DESC) AS rn
      FROM `{_table(EVENTS_TABLE)}` e
    )
    SELECT
      unique_key, ot, cuadrilla, id_cuadrilla, event_type, event_time, pause_reason, comment, photo_url, lat, lon, accuracy_m
    FROM ranked
    WHERE rn = 1
    ORDER BY event_time DESC
    LIMIT {limit}
    """
    return [dict(r) for r in client.query(q).result()]
