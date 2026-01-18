import json
import os

BASE = "local_data"
TASKS = os.path.join(BASE, "tasks.json")
EVENTS = os.path.join(BASE, "events.json")

os.makedirs(BASE, exist_ok=True)

def _load(path):
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def upsert_tasks(rows):
    tasks = _load(TASKS)

    for r in rows:
        if not any(t["unique_key"] == r["unique_key"] for t in tasks):
            tasks.append(r)

    _save(TASKS, tasks)
    return len(rows)

def insert_event(row):
    events = _load(EVENTS)
    events.append(row)
    _save(EVENTS, events)
    return True

def list_tasks_by_cuadrilla(cuadrilla):
    tasks = _load(TASKS)
    return [t for t in tasks if t["cuadrilla"] == cuadrilla]

def get_task(task_id):
    tasks = _load(TASKS)
    for t in tasks:
        if t["task_id"] == task_id:
            return t
    return None

def dashboard_latest():
    events = _load(EVENTS)

    latest = {}
    for e in events:
        k = e.get("unique_key")
        if not k:
            continue

        if k not in latest:
            latest[k] = e
        else:
            if e["event_time"] > latest[k]["event_time"]:
                latest[k] = e

    return list(latest.values())
