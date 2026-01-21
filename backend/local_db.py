import json
import os
from datetime import datetime, timezone

BASE = "local_data"
TASKS = os.path.join(BASE, "tasks.json")
EVENTS = os.path.join(BASE, "events.json")

UPLOADS_DIR = os.path.join(BASE, "uploads")
UPLOADS_REG = os.path.join(BASE, "uploads.json")

os.makedirs(BASE, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)


def _load(path):
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def now_utc_iso():
    return datetime.now(timezone.utc).isoformat()


# -------------------------
# Uploads registry
# -------------------------
def add_upload(upload_id: str, filename: str, stored_path: str, rows_imported: int):
    uploads = _load(UPLOADS_REG)
    uploads.append(
        {
            "upload_id": upload_id,
            "filename": filename,
            "stored_path": stored_path,
            "uploaded_at": now_utc_iso(),
            "active": True,
            "rows_imported": int(rows_imported or 0),
        }
    )
    _save(UPLOADS_REG, uploads)
    return True


def list_uploads():
    uploads = _load(UPLOADS_REG)
    uploads.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
    return uploads


def set_upload_active(upload_id: str, active: bool):
    uploads = _load(UPLOADS_REG)
    found = False
    for u in uploads:
        if u.get("upload_id") == upload_id:
            u["active"] = bool(active)
            u["updated_at"] = now_utc_iso()
            found = True
            break
    if found:
        _save(UPLOADS_REG, uploads)
    return found


def _active_upload_ids_set():
    uploads = _load(UPLOADS_REG)
    return set([u["upload_id"] for u in uploads if u.get("active") is True])


# -------------------------
# Tasks
# -------------------------
def upsert_tasks(rows):
    tasks = _load(TASKS)

    inserted = 0
    for r in rows:
        if not any(t.get("unique_key") == r.get("unique_key") for t in tasks):
            tasks.append(r)
            inserted += 1

    _save(TASKS, tasks)
    return inserted


def list_tasks_by_cuadrilla(cuadrilla):
    tasks = _load(TASKS)
    active_ids = _active_upload_ids_set()

    cu = str(cuadrilla).strip()

    out = []
    for t in tasks:
        if str(t.get("cuadrilla", "")).strip() != cu:
            continue

        # si tiene upload_id y ese upload está inactivo => NO mostrar
        upid = t.get("upload_id")
        if upid and upid not in active_ids:
            continue

        out.append(t)
    return out


def get_task(task_id):
    tasks = _load(TASKS)
    for t in tasks:
        if t.get("task_id") == task_id:
            return t
    return None


# -------------------------
# Events
# -------------------------
def insert_event(row):
    events = _load(EVENTS)
    events.append(row)
    _save(EVENTS, events)
    return True


def dashboard_latest():
    events = _load(EVENTS)
    tasks = _load(TASKS)
    active_ids = _active_upload_ids_set()

    task_upload = {t.get("task_id"): t.get("upload_id") for t in tasks}

    latest = {}
    for e in events:
        task_id = e.get("task_id")

        # filtrar eventos por upload activo (si aplica)
        upid = task_upload.get(task_id)
        if upid and upid not in active_ids:
            continue

        k = e.get("unique_key")
        if not k:
            continue

        if k not in latest:
            latest[k] = e
        else:
            if e.get("event_time", "") > latest[k].get("event_time", ""):
                latest[k] = e

    return list(latest.values())


# ✅ historial de eventos por task_id (ordenado por event_time)
def list_events_by_task(task_id: str):
    events = _load(EVENTS)
    ev = [e for e in events if e.get("task_id") == task_id]
    ev.sort(key=lambda x: x.get("event_time", ""))
    return ev
