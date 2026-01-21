import json
import os
from typing import List, Dict, Any

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


# -----------------------------
# Uploads registry
# -----------------------------
def list_uploads() -> List[Dict[str, Any]]:
    uploads = _load(UPLOADS_REG)
    # orden más nuevo primero
    uploads.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
    return uploads


def get_upload(upload_id: str) -> Dict[str, Any] | None:
    uploads = _load(UPLOADS_REG)
    for u in uploads:
        if u.get("upload_id") == upload_id:
            return u
    return None


def create_upload(upload_row: Dict[str, Any]) -> None:
    uploads = _load(UPLOADS_REG)
    uploads.append(upload_row)
    _save(UPLOADS_REG, uploads)


def set_upload_active(upload_id: str, active: bool) -> bool:
    uploads = _load(UPLOADS_REG)
    changed = False
    for u in uploads:
        if u.get("upload_id") == upload_id:
            u["active"] = bool(active)
            changed = True
            break
    if changed:
        _save(UPLOADS_REG, uploads)
    return changed


def delete_upload(upload_id: str) -> Dict[str, Any] | None:
    """
    Borra:
      - el upload del registro
      - el archivo físico si existe
      - tareas asociadas
      - eventos asociados a esas tareas
    """
    uploads = _load(UPLOADS_REG)
    target = None
    keep = []

    for u in uploads:
        if u.get("upload_id") == upload_id:
            target = u
        else:
            keep.append(u)

    if target is None:
        return None

    _save(UPLOADS_REG, keep)

    # borrar archivo físico
    file_path = target.get("path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    # borrar tareas y eventos asociados
    removed_task_ids = _delete_tasks_by_upload(upload_id)
    _delete_events_by_task_ids(removed_task_ids)

    return target


def _active_upload_ids_set() -> set:
    uploads = _load(UPLOADS_REG)
    return {u.get("upload_id") for u in uploads if u.get("active", True) and u.get("upload_id")}


# -----------------------------
# Tasks
# -----------------------------
def upsert_tasks(rows: List[Dict[str, Any]]) -> int:
    tasks = _load(TASKS)
    added = 0

    for r in rows:
        # no duplicar por unique_key
        if not any(t.get("unique_key") == r.get("unique_key") for t in tasks):
            tasks.append(r)
            added += 1

    _save(TASKS, tasks)
    return added


def list_tasks_by_cuadrilla(cuadrilla: str) -> List[Dict[str, Any]]:
    tasks = _load(TASKS)
    cuadrilla_norm = str(cuadrilla).strip()
    active_ids = _active_upload_ids_set()

    out = []
    for t in tasks:
        if str(t.get("cuadrilla", "")).strip() != cuadrilla_norm:
            continue
        # si la tarea viene de un upload inactivo, NO se muestra
        upload_id = t.get("upload_id")
        if upload_id and upload_id not in active_ids:
            continue
        out.append(t)

    return out


def get_task(task_id: str) -> Dict[str, Any] | None:
    tasks = _load(TASKS)
    for t in tasks:
        if t.get("task_id") == task_id:
            return t
    return None


def _delete_tasks_by_upload(upload_id: str) -> List[str]:
    tasks = _load(TASKS)
    keep = []
    removed_ids = []

    for t in tasks:
        if t.get("upload_id") == upload_id:
            removed_ids.append(t.get("task_id"))
        else:
            keep.append(t)

    _save(TASKS, keep)
    return [x for x in removed_ids if x]


# -----------------------------
# Events
# -----------------------------
def insert_event(row: Dict[str, Any]) -> bool:
    events = _load(EVENTS)
    events.append(row)
    _save(EVENTS, events)
    return True


def list_events_by_task(task_id: str) -> List[Dict[str, Any]]:
    events = _load(EVENTS)
    ev = [e for e in events if e.get("task_id") == task_id]
    ev.sort(key=lambda x: x.get("event_time", ""))
    return ev


def _delete_events_by_task_ids(task_ids: List[str]) -> None:
    if not task_ids:
        return
    s = set(task_ids)
    events = _load(EVENTS)
    keep = [e for e in events if e.get("task_id") not in s]
    _save(EVENTS, keep)


def dashboard_latest() -> List[Dict[str, Any]]:
    """
    Devuelve el último evento por unique_key,
    pero SOLO si la tarea pertenece a un upload ACTIVO.
    """
    events = _load(EVENTS)
    tasks = _load(TASKS)
    active_ids = _active_upload_ids_set()

    # mapa unique_key -> upload_id (desde tasks)
    key_to_upload = {}
    for t in tasks:
        uk = t.get("unique_key")
        if uk:
            key_to_upload[uk] = t.get("upload_id")

    latest = {}
    for e in events:
        uk = e.get("unique_key")
        if not uk:
            continue

        upload_id = key_to_upload.get(uk)
        if upload_id and upload_id not in active_ids:
            continue

        if uk not in latest or e.get("event_time", "") > latest[uk].get("event_time", ""):
            latest[uk] = e

    return list(latest.values())
