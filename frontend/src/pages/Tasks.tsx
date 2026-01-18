import { useEffect, useState } from "react";
import { listTasks } from "../api";
import { useNavigate } from "react-router-dom";

export default function Tasks() {
  const nav = useNavigate();
  const cuadrilla = localStorage.getItem("cuadrilla") || "";
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const out = await listTasks(cuadrilla);
        setRows(out.tasks || []);
      } catch (e:any) {
        setErr(e.message);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-2xl font-semibold">Tareas – {cuadrilla}</h2>
          <p className="text-zinc-300 mt-1">Elegí una fila (OP) para operar.</p>

          {err && <div className="mt-4 p-3 rounded-xl bg-zinc-950 border border-red-900 text-red-200">{err}</div>}

          <div className="mt-5 grid gap-3">
            {rows.map((t) => (
              <button
                key={t.task_id}
                className="text-left p-4 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-brandRed transition"
                onClick={() => nav(`/task/${t.task_id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">OT {t.ot} • ID {t.id_cuadrilla}</div>
                  <div className="text-xs text-zinc-400">{t.source_file}</div>
                </div>
                <div className="text-zinc-300 mt-1">{t.desc_op}</div>
                <div className="text-zinc-400 text-sm mt-1">UT: {t.ut} • Contratista: {t.contratista}</div>
              </button>
            ))}
            {rows.length === 0 && (
              <div className="text-zinc-400">No hay tareas para esta cuadrilla (o no se importó Excel).</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
