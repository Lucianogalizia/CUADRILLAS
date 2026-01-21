import { useEffect, useState } from "react";
import { uploadExcels, listUploads, disableUpload, enableUpload, deleteUpload } from "../api";

export default function UploadTasks() {
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const [uploads, setUploads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const out = await listUploads();
      setUploads(out.uploads || []);
      setErr("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onUpload() {
    setMsg("");
    setErr("");
    try {
      const out = await uploadExcels(files);
      setMsg(`✅ Importación OK. Filas procesadas: ${out.imported}`);
      setFiles([]);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function onToggle(u: any) {
    setMsg("");
    setErr("");
    try {
      if (u.active) {
        await disableUpload(u.upload_id);
        setMsg("✅ Excel dado de baja (no se considera en tareas/tablero).");
      } else {
        await enableUpload(u.upload_id);
        setMsg("✅ Excel reactivado.");
      }
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function onDelete(u: any) {
    const ok = window.confirm(
      `⚠️ Eliminar definitivamente:\n\n${u.filename}\n\nEsto borra el Excel, sus tareas y sus eventos.\n¿Confirmás?`
    );
    if (!ok) return;

    setMsg("");
    setErr("");
    try {
      await deleteUpload(u.upload_id);
      setMsg("✅ Eliminado definitivamente.");
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* SUBIR */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-2xl font-semibold">Subir Excel de Trabajos</h2>
          <p className="text-zinc-300 mt-2">Podés subir <b>más de un Excel</b>.</p>

          <input
            className="mt-5 block w-full text-zinc-200"
            type="file"
            multiple
            accept=".xlsx,.xls"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />

          <button
            className="mt-5 w-full py-4 rounded-xl bg-brandRed hover:opacity-90 font-semibold text-lg disabled:opacity-40"
            disabled={files.length === 0}
            onClick={onUpload}
          >
            Importar
          </button>

          {msg && <div className="mt-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800">{msg}</div>}
          {err && <div className="mt-4 p-3 rounded-xl bg-zinc-950 border border-red-900 text-red-200">{err}</div>}

          <div className="mt-6 text-sm text-zinc-400">
            Columnas requeridas: Contratista, OT, UT, Descripción OT, Descripción OP, Cuadrilla, ID Cuadrilla
          </div>
        </div>

        {/* LISTA EXCELS */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold">Excels cargados</h3>
              <p className="text-zinc-300 text-sm mt-1">
                Desde acá podés dar de baja / reactivar un Excel o eliminarlo definitivamente.
              </p>
            </div>

            <button
              className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-brandRed text-sm"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          <div className="mt-4 overflow-auto rounded-2xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950">
                <tr className="text-left text-zinc-300">
                  <th className="p-3">Estado</th>
                  <th className="p-3">Archivo</th>
                  <th className="p-3">Filas</th>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u, i) => (
                  <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-950/40">
                    <td className="p-3">
                      {u.active ? (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-600/20 text-green-200 border border-green-700/40">
                          ACTIVO
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-200 border border-zinc-700">
                          INACTIVO
                        </span>
                      )}
                    </td>

                    <td className="p-3 font-semibold">{u.filename}</td>
                    <td className="p-3 text-zinc-300">{u.rows_imported ?? "-"}</td>
                    <td className="p-3 text-zinc-300">
                      {String(u.uploaded_at || "").replace("T", " ").replace("Z", "")}
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="px-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-brandRed text-sm font-semibold"
                          onClick={() => onToggle(u)}
                        >
                          {u.active ? "Dar de baja" : "Reactivar"}
                        </button>

                        <button
                          className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-semibold"
                          onClick={() => onDelete(u)}
                        >
                          Eliminar definitivamente
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {uploads.length === 0 && (
                  <tr>
                    <td className="p-4 text-zinc-400" colSpan={5}>
                      Todavía no se importó ningún Excel.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            “Dar de baja” = no se usa en tareas/tablero (reversible). “Eliminar definitivamente” = borra todo (irreversible).
          </div>
        </div>
      </div>
    </div>
  );
}
