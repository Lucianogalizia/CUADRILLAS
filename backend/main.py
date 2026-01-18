import os
import uuid
import hashlib
from datetime import datetime, timezone
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
import pandas as pd

from models import CreateEvent
import bq
from storage import upload_photo

app = FastAPI(title="Seguimiento de Cuadrillas")

FRONT_DIST = os.getenv("FRONT_DIST", "/app/frontend/dist")
if os.path.isdir(FRONT_DIST):
    app.mount("/", StaticFiles(directory=FRONT_DIST, html=True), name="frontend")

def now_utc():
    return datetime.now(timezone.utc)

def make_task_ids(contratista: str, ot: str, ut: str, desc_op: str, id_cuadrilla: str) -> tuple[str, str]:
    """
    task_id determinístico por clave lógica -> evita duplicados.
    unique_key = contratista||ot||ut||desc_op||id_cuadrilla
    task_id = sha1(unique_key) (hex)
    """
    key = f"{(contratista or '').strip()}||{(ot or '').strip()}||{(ut or '').strip()}||{(desc_op or '').strip()}||{(id_cuadrilla or '').strip()}"
    task_id = hashlib.sha1(key.encode("utf-8")).hexdigest()
    return task_id, key

@app.get("/api/health")
def health():
    return {"ok": True, "ts": now_utc().isoformat()}

@app.post("/api/upload_tasks")
async def upload_tasks(files: list[UploadFile] = File(...)):
    """
    Recibe 1 o más Excels.
    Busca una hoja que tenga las columnas requeridas.
    Importa SOLO:
      Contratista, OT, UT, Descripción OT, Descripción OP, Cuadrilla, ID Cuadrilla
    """
    imported = 0

    required_aliases = {
        "Contratista": ["Contratista", "CONTRATISTA"],
        "OT": ["OT", "Ot", "Orden", "Orden de Trabajo"],
        "UT": ["UT", "Ubicac.técnica", "Ubicac. técnica", "Ubicac tecnica", "Ubicacion tecnica"],
        "Descripción OT": ["Descripción OT", "Descripcion OT", "Desc OT", "DESCRIPCION OT"],
        "Descripción OP": ["Descripción OP", "Descripcion OP", "Desc OP", "DESCRIPCION OP"],
        "Cuadrilla": ["Cuadrilla", "CUADRILLA"],
        "ID Cuadrilla": ["ID Cuadrilla", "Id Cuadrilla", "IDCUADRILLA", "ID_CUADRILLA", "ID CUADRILLA"],
    }

    def normalize_col(c: str) -> str:
        return str(c).strip()

    def pick_sheet_and_df(xls_bytes):
        from io import BytesIO
        bio = BytesIO(xls_bytes)
        xl = pd.ExcelFile(bio)
        for sh in xl.sheet_names:
            df = pd.read_excel(xl, sheet_name=sh, dtype=str)
            df.columns = [normalize_col(c) for c in df.columns]

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
        if not f.filename.lower().endswith((".xlsx", ".xls")):
            raise HTTPException(400, f"Archivo no soportado: {f.filename}")

        content = await f.read()
        sheet, df = pick_sheet_and_df(content)
        if df is None:
            raise HTTPException(
                400,
                f"No encontré una hoja con las columnas requeridas en {f.filename}. "
                f"Busqué: {list(required_aliases.keys())}"
            )

        df = df.fillna("").astype(str)
        for c in df.columns:
            df[c] = df[c].str.strip()

        # filtro mínimo
        df = df[df["OT"].str.len() > 0]
        df = df[df["Cuadrilla"].str.len() > 0]
        df = df[df["ID Cuadrilla"].str.len() > 0]

        rows = []
        for _, r in df.iterrows():
            task_id, unique_key = make_task_ids(
                r["Contratista"], r["OT"], r["UT"], r["Descripción OP"], r["ID Cuadrilla"]
            )
            rows.append({
                "task_id": task_id,
                "unique_key": unique_key,
                "source_file": f"{f.filename}::{sheet}",
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
    if not cuadrilla:
        raise HTTPException(400, "Falta cuadrilla")
    return {"tasks": bq.list_tasks_by_cuadrilla(cuadrilla)}

@app.get("/api/task/{task_id}")
def task(task_id: str):
    t = bq.get_task(task_id)
    if not t:
        raise HTTPException(404, "No existe task")
    return t

@app.post("/api/event")
async def create_event(payload: CreateEvent):
    # server time si no viene
    if payload.event_time:
        try:
            dt = datetime.fromisoformat(payload.event_time.replace("Z", "+00:00"))
            event_time = dt.astimezone(timezone.utc).isoformat()
        except Exception:
            raise HTTPException(400, "event_time inválido (usar ISO)")
    else:
        event_time = now_utc().isoformat()

    t = bq.get_task(payload.task_id)
    unique_key = t["unique_key"] if t and "unique_key" in t else None

    row = {
        "event_id": uuid.uuid4().hex,
        "task_id": payload.task_id,
        "unique_key": unique_key,
        "ot": payload.ot,
        "cuadrilla": payload.cuadrilla,
        "id_cuadrilla": payload.id_cuadrilla,
        "event_type": payload.event_type,
        "event_time": event_time,
        "lat": float(payload.lat),
        "lon": float(payload.lon),
        "accuracy_m": float(payload.accuracy_m) if payload.accuracy_m is not None else None,
        "pause_reason": payload.pause_reason,
        "comment": payload.comment,
        "photo_url": None,
        "created_at": now_utc().isoformat(),
    }
    bq.insert_event(row)
    return {"ok": True}

@app.post("/api/event_with_photo")
async def create_event_with_photo(
    task_id: str = Form(...),
    ot: str = Form(...),
    cuadrilla: str = Form(...),
    id_cuadrilla: str = Form(None),
    event_type: str = Form(...),
    lat: float = Form(...),
    lon: float = Form(...),
    accuracy_m: float = Form(None),
    pause_reason: str = Form(None),
    comment: str = Form(None),
    photo: UploadFile = File(...),
):
    photo_bytes = await photo.read()
    photo_url = upload_photo(photo_bytes, photo.content_type or "image/jpeg", photo.filename)

    t = bq.get_task(task_id)
    unique_key = t["unique_key"] if t and "unique_key" in t else None

    row = {
        "event_id": uuid.uuid4().hex,
        "task_id": task_id,
        "unique_key": unique_key,
        "ot": ot,
        "cuadrilla": cuadrilla,
        "id_cuadrilla": id_cuadrilla,
        "event_type": event_type,
        "event_time": now_utc().isoformat(),
        "lat": float(lat),
        "lon": float(lon),
        "accuracy_m": float(accuracy_m) if accuracy_m is not None else None,
        "pause_reason": pause_reason,
        "comment": comment,
        "photo_url": photo_url,
        "created_at": now_utc().isoformat(),
    }
    bq.insert_event(row)
    return {"ok": True, "photo_url": photo_url}

@app.get("/api/dashboard")
def dashboard():
    return {"rows": bq.dashboard_latest()}
