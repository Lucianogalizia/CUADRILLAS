import uuid
import hashlib
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
import pandas as pd

from models import CreateEvent
import local_db as bq

app = FastAPI(title="Seguimiento de Cuadrillas - Modo Local")

import os
FRONT_DIST = os.environ.get("FRONT_DIST", "/app/frontend/dist")
try:
    app.mount("/", StaticFiles(directory=FRONT_DIST, html=True), name="frontend")
except:
    pass


def now_utc():
    return datetime.now(timezone.utc)


def make_task_ids(contratista, ot, ut, desc_op, id_cuadrilla):
    key = f"{(contratista or '').strip()}||{(ot or '').strip()}||{(ut or '').strip()}||{(desc_op or '').strip()}||{(id_cuadrilla or '').strip()}"
    task_id = hashlib.sha1(key.encode("utf-8")).hexdigest()
    return task_id, key


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/upload_tasks")
async def upload_tasks(files: list[UploadFile] = File(...)):
    imported = 0

    required_aliases = {
        "Contratista": ["Contratista"],
        "OT": ["OT"],
        "UT": ["UT"],
        "Descripción OT": ["Descripción OT", "Descripcion OT"],
        "Descripción OP": ["Descripción OP", "Descripcion OP"],
        "Cuadrilla": ["Cuadrilla"],
        "ID Cuadrilla": ["ID Cuadrilla", "Id Cuadrilla"]
    }

    def pick_sheet_and_df(content):
        from io import BytesIO
        bio = BytesIO(content)
        xl = pd.ExcelFile(bio)

        for sh in xl.sheet_names:
            df = pd.read_excel(xl, sheet_name=sh, dtype=str)
            df.columns = [str(c).strip() for c in df.columns]

            colmap = {}
            for canon, aliases in required_aliases.items():
                found = None
                for a in aliases:
                    if a in df.columns:
                        found = a
                        break
                if not found:
                    colmap = None
                    break
                colmap[canon] = found

            if colmap:
                out = df[[colmap[k] for k in required_aliases.keys()]].copy()
                out.columns = list(required_aliases.keys())
                return sh, out

        return None, None

    for f in files:
        content = await f.read()

        sheet, df = pick_sheet_and_df(content)

        if df is None:
            raise HTTPException(
                400,
                f"No encontré columnas requeridas en {f.filename}"
            )

        df = df.fillna("").astype(str)
        df = df[df["OT"].str.len() > 0]
        df = df[df["Cuadrilla"].str.len() > 0]
        df = df[df["ID Cuadrilla"].str.len() > 0]

        rows = []

        for _, r in df.iterrows():
            task_id, unique_key = make_task_ids(
                r["Contratista"],
                r["OT"],
                r["UT"],
                r["Descripción OP"],
                r["ID Cuadrilla"]
            )

            rows.append({
                "task_id": task_id,
                "unique_key": unique_key,
                "source_file": f.filename,
                "contratista": r["Contratista"],
                "ot": r["OT"],
                "ut": r["UT"],
                "desc_ot": r["Descripción OT"],
                "desc_op": r["Descripción OP"],
                "cuadrilla": r["Cuadrilla"],
                "id_cuadrilla": r["ID Cuadrilla"],
                "status": "ABIERTO",
                "created_at": now_utc().isoformat(),
                "updated_at": now_utc().isoformat(),
            })

        imported += bq.upsert_tasks(rows)

    return {"imported": imported}


@app.get("/api/tasks")
def tasks(cuadrilla: str):
    return {"tasks": bq.list_tasks_by_cuadrilla(cuadrilla)}


@app.get("/api/task/{task_id}")
def task(task_id: str):
    t = bq.get_task(task_id)
    if not t:
        raise HTTPException(404, "No existe task")
    return t


@app.post("/api/event")
async def create_event(payload: CreateEvent):
    event_time = now_utc().isoformat()

    t = bq.get_task(payload.task_id)
    unique_key = t["unique_key"] if t else None

    row = {
        "event_id": uuid.uuid4().hex,
        "task_id": payload.task_id,
        "unique_key": unique_key,
        "ot": payload.ot,
        "cuadrilla": payload.cuadrilla,
        "id_cuadrilla": payload.id_cuadrilla,
        "event_type": payload.event_type,
        "event_time": event_time,
        "lat": payload.lat,
        "lon": payload.lon,
        "accuracy_m": payload.accuracy_m,
        "pause_reason": payload.pause_reason,
        "comment": payload.comment,
        "photo_url": None,
        "created_at": now_utc().isoformat(),
    }

    bq.insert_event(row)
    return {"ok": True}


@app.get("/api/dashboard")
def dashboard():
    return {"rows": bq.dashboard_latest()}

