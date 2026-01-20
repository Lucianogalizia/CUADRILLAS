import { useEffect, useState } from "react";
import { getDashboard } from "../api";

function badge(type: string) {
  const base = "px-3 py-1 rounded-full text-xs font-semibold";
  if (type === "INICIO") return `${base} bg-green-600/20 text-green-200 border border-green-700/40`;
  if (type === "PAUSA") return `${base} bg-yellow-600/20 text-yellow-200 border border-yellow-700/40`;
  if (type === "FIN") return `${base} bg-blue-600/20 text-blue-200 border border-blue-700/40`;
  if (type === "LLEGADA") return `${base} bg-purple-600/20 text-purple-200 border border-purple-700/40`;
  return `${base} bg-zinc-800 text-zinc-200 border border-zinc-700`;
}

function mapsLink(r: any) {
  if (r?.lat == null || r?.lon == null) return null;
  return `https://www.google.com/maps?q=${r.lat},${r.lon}`;
}

export default function Dashboard() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    const tick = async () => {
      try {
        const out = await getDashboard();
        setRows(out.rows || []);
        setErr("");
      } catch (e: any) {
        setErr(e.message);
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-6xl mx-auto bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Tablero Operativo</h2>
            <p className="text-zinc-300">Último estado por tarea (fila importada).</p>
          </div>
          <div className="text-xs text-zinc-400">Actualiza cada 15s</div>
        </div>

        {err && <div className="mt-4 p-3 rounded-2xl bg-zinc-950 border border-red-900 text-red-200">{err}</div>}

        <div className="mt-5 overflow-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950">
              <tr className="text-left text-zinc-300">
                <th className="p-3">Cuadrilla</th>
                <th className="p-3">ID</th>
                <th className="p-3">OT</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Hora</th>
                <th className="p-3">Motivo</th>
                <th className="p-3">Ubicación</th>
                <th className="p-3">Foto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const link = mapsLink(r);
                return (
                  <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-950/40">
                    <td className="p-3 font-semibold">{r.cuadrilla}</td>
                    <td className="p-3">{r.id_cuadrilla || "-"}</td>
                    <td className="p-3">{r.ot}</td>
                    <td className="p-3"><span className={badge(r.event_type)}>{r.event_type}</span></td>
                    <td className="p-3 text-zinc-300">{String(r.event_time || "").replace("T"," ").replace("Z","")}</td>
                    <td className="p-3 text-zinc-300">{r.pause_reason || "-"}</td>
                    <td className="p-3 text-zinc-300">
                      {link ? (
                        <a className="text-brandRed underline" href={link} target="_blank" rel="noreferrer">
                          ver mapa {r.accuracy_m != null ? `(${Math.round(r.accuracy_m)}m)` : ""}
                        </a>
                      ) : "-"}
                    </td>
                    <td className="p-3">
                      {r.photo_url ? (
                        <a className="text-brandRed underline" href={r.photo_url} target="_blank" rel="noreferrer">ver</a>
                      ) : "-"}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td className="p-4 text-zinc-400" colSpan={8}>Sin eventos todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
