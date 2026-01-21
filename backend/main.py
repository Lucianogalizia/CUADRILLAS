import os
import uuid
import hashlib
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
import pandas as pd

from backend.models import CreateEvent
import backend.local_db as bq

app = FastAPI(title="Seguimiento de CUADRILLAS - Modo Local")


def now_utc():
    return datetime.now(timezone.utc)


def make_task_ids(contratista, ot, ut, desc_op, id_cuadrilla):
    key = (
        f"{(contratista or '').strip()}||"
        f"{(ot or '').strip()}||"
        f"{(ut or '').strip()}||"
        f"{(desc_op or '').strip()}||"
        f"{(id_cuadrilla or '').strip()}"
    )
    task_id = hashlib.sha1(key.encode("utf-8")).hexdigest()
    return task_id, key


@app.get("/api/health")
def health():
    return {"ok": True}


# ----------------------------
# Uploads: list / disable / enable / delete
# ----------------------------
@app.get("/api/uploads")
def uploads():
    return {"uploads": bq.list_uploads()}


@app.post("/api/uploads/{upload_id}/disable")
def disable_upload(upload_id: str):
    ok = bq.set_upload_active(upload_id, False)
    if not ok:
        raise HTTPException(404, "No existe upload")
    return {"ok": True}


@app.post("/api/uploads/{upload_id}/enable")
def enable_upload(upload_id: str):
    ok = bq.set_upload_active(upload_id, True)
    if not ok:
        raise HTTPException(404, "No existe upload")
    return {"ok": True}


@app.delete("/api/uploads/{upload_id}")
def delete_upload(upload_id: str):
    deleted = bq.delete_upload(upload_id)
    if not deleted:
        raise HTTPException(404, "No existe upload")
    return {"ok": True, "deleted": deleted}


# ----------------------------
# Import Excel -> tasks + upload registry
# ----------------------------
@app.post("/api/upload_tasks")
async def upload_tasks(files: list[UploadFile] = File(...)):
    imported_total = 0

    required_aliases = {
        "Contratista": ["Contratista"],
        "OT": ["OT"],
        "UT": ["UT"],
        "Descripción OT": ["Descripción OT", "Descripcion OT"],
        "Descripción OP": ["Descripción OP", "Descripcion OP"],
        "Cuadrilla": ["Cuadrilla"],
        "ID Cuadrilla": ["ID Cuadrilla", "Id Cuadrilla"],
    }

    def pick_sheet_and_df(content: bytes):
        from io import BytesIO

        def norm(s: str) -> str:
            if s is None:
                return ""
            s = str(s).strip().lower()
            s = (
                s.replace("á", "a")
                .replace("é", "e")
                .replace("í", "i")
                .replace("ó", "o")
                .replace("ú", "u")
                .replace("ü", "u")
            )
            s = " ".join(s.split())
            return s

        required_norm = {
            canon: [norm(a) for a in aliases]
            for canon, aliases in required_aliases.items()
        }

        bio = BytesIO(content)
        xl = pd.ExcelFile(bio)

        for sh in xl.sheet_names:
            raw = pd.read_excel(xl, sheet_name=sh, header=None, dtype=str).fillna("")

            max_scan_rows = min(80, len(raw))
            header_row_idx = None
            header_colmap = None

            for i in range(max_scan_rows):
                row_vals = [norm(v) for v in raw.iloc[i].tolist()]

                colmap = {}
                ok = True
                for canon, aliases in required_norm.items():
                    found_j = None
                    for j, cell in enumerate(row_vals):
                        if cell in aliases:
                            found_j = j
                            break
                    if found_j is None:
                        ok = False
                        break
                    colmap[canon] = found_j

                if ok:
                    header_row_idx = i
                    header_colmap = colmap
                    break

            if header_row_idx is None:
                continue

            data = raw.iloc[header_row_idx + 1 :].copy()
            data.columns = list(range(data.shape[1]))

            out = data[[header_colmap[k] for k in required_aliases.keys()]].copy()
            out.columns = list(required_aliases.keys())
            out = out.fillna("").astype(str)

            mask_any = (
                (out["OT"].str.strip().str.len() > 0)
                | (out["Cuadrilla"].str.strip().str.len() > 0)
                | (out["ID Cuadrilla"].str.strip().str.len() > 0)
            )
            out = out[mask_any].copy()

            if not out.empty:
                out = out.reset_index(drop=True)

            return sh, out

        return None, None

    for f in files:
        content = await f.read()

        # 1) Guardar archivo físico
        upload_id = uuid.uuid4().hex
        safe_name = (f.filename or "upload.xlsx").replace("/", "_").replace("\\", "_")
        upload_dir = Path("local_data") / "uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)
        saved_path = str(upload_dir / f"{upload_id}__{safe_name}")

        with open(saved_path, "wb") as out:
            out.write(content)

        # 2) Parsear excel
        sheet, df = pick_sheet_and_df(content)

        if df is None:
            # si falla, borramos el archivo físico guardado
            try:
                os.remove(saved_path)
            except Exception:
                pass
            raise HTTPException(400, f"No encontré columnas requeridas en {f.filename}")

        df = df.fillna("").astype(str)
        df = df[df["OT"].str.strip().str.len() > 0]
        df = df[df["Cuadrilla"].str.strip().str.len() > 0]
        df = df[df["ID Cuadrilla"].str.strip().str.len() > 0]

        # 3) Registrar el upload (ACTIVO por defecto)
        bq.create_upload(
            {
                "upload_id": upload_id,
                "filename": safe_name,
                "path": saved_path,
                "sheet": sheet,
                "rows_imported": int(len(df)),
                "uploaded_at": now_utc().isoformat(),
                "active": True,
            }
        )

        # 4) Generar tasks con upload_id
        rows = []
        for _, r in df.iterrows():
            task_id, unique_key = make_task_ids(
                r["Contratista"],
                r["OT"],
                r["UT"],
                r["Descripción OP"],
                r["ID Cuadrilla"],
            )

            now = now_utc().isoformat()
            rows.append(
                {
                    "task_id": task_id,
                    "unique_key": unique_key,
                    "upload_id": upload_id,  # ✅ clave
                    "source_file": safe_name,
                    "contratista": r["Contratista"],
                    "ot": r["OT"],
                    "ut": r["UT"],
                    "desc_ot": r["Descripción OT"],
                    "desc_op": r["Descripción OP"],
                    "cuadrilla": r["Cuadrilla"],
                    "id_cuadrilla": r["ID Cuadrilla"],
                    "status": "ABIERTO",
                    "created_at": now,
                    "updated_at": now,
                }
            )

        imported_total += bq.upsert_tasks(rows)

    return {"imported": imported_total}


@app.get("/api/tasks")
def tasks(cuadrilla: str):
    return {"tasks": bq.list_tasks_by_cuadrilla(cuadrilla)}


@app.get("/api/task/{task_id}")
def task(task_id: str):
    t = bq.get_task(task_id)
    if not t:
        raise HTTPException(404, "No existe task")
    return t


@app.get("/api/task/{task_id}/events")
def task_events(task_id: str):
    return {"events": bq.list_events_by_task(task_id)}


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


# ==========================================================
# IMPORTANTE:
# Montar el frontend AL FINAL para no "pisar" /api/*
# ==========================================================
FRONT_DIST = os.environ.get("FRONT_DIST", "/app/frontend/dist")
try:
    app.mount("/", StaticFiles(directory=FRONT_DIST, html=True), name="frontend")
except Exception:
    pass
