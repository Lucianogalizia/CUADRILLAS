import { useEffect, useState } from "react";
import { listUploads, disableUpload, enableUpload } from "../api";

export default function Uploads() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function refresh() {
    try {
      const out = await listUploads();
      setRows(out.uploads || []);
      setErr("");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggle(u: any) {
    setMsg("");
    try {
      if (u.active) await disableUpload(u.upload_id);
      else await enableUpload(u.upload_id);
      await refresh();
      setMsg("✅ OK");
      setTimeout(() => setMsg(""), 1200);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-5xl mx-auto bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-2xl font-semibold">Excels Importados</h2>
        <p className="text-zinc-300 mt-1">
          Activá / desactivá un Excel para que el sistema lo considere o lo ignore.
        </p>

        {err && (
          <div className="mt-4 p-3 rounded-2xl bg-zinc-950 border border-red-900 text-red-200">
            {err}
          </div>
        )}
        {msg && (
          <div className="mt-4 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
            {msg}
          </div>
        )}

        <div className="mt-5 overflow-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-left text-zinc-300">
                <th className="p-3">Estado</th>
                <th className="p-3">Archivo</th>
                <th className="p-3">Filas importadas</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u, i) => (
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
                  <td className="p-3 text-zinc-300">{String(u.uploaded_at || "").replace("T", " ").replace("Z", "")}</td>
                  <td className="p-3">
                    <button
                      className="px-4 py-2 rounded-xl bg-brandRed hover:opacity-90 font-semibold"
                      onClick={() => toggle(u)}
                    >
                      {u.active ? "Dar de baja" : "Re-activar"}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
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
          Nota: Al desactivar un Excel, las tareas de ese archivo dejan de aparecer en “Tareas” y en el “Dashboard”.
        </div>
      </div>
    </div>
  );
}
