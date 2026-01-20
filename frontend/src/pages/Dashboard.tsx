import { useEffect, useState } from "react";
import { getDashboard, getTaskEvents } from "../api";

function badge(type: string) {
  const base = "px-3 py-1 rounded-full text-xs font-semibold";
  if (type === "INICIO") return `${base} bg-green-600/20 text-green-200 border border-green-700/40`;
  if (type === "PAUSA") return `${base} bg-yellow-600/20 text-yellow-200 border border-yellow-700/40`;
  if (type === "REANUDADO") return `${base} bg-cyan-600/20 text-cyan-200 border border-cyan-700/40`;
  if (type === "FIN") return `${base} bg-blue-600/20 text-blue-200 border border-blue-700/40`;
  if (type === "LLEGADA") return `${base} bg-purple-600/20 text-purple-200 border border-purple-700/40`;
  return `${base} bg-zinc-800 text-zinc-200 border border-zinc-700`;
}

function mapsLink(lat: any, lon: any) {
  if (lat == null || lon == null) return null;
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

function fmtAr(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Rio_Gallegos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ✅ Duración entre estados (prev -> curr)
function diffLabel(prevIso?: string, currIso?: string) {
  if (!prevIso || !currIso) return "";
  const a = new Date(prevIso).getTime();
  const b = new Date(currIso).getTime();
  if (!isFinite(a) || !isFinite(b)) return "";
  const ms = b - a;
  if (ms <= 0) return "";

  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  if (h <= 0) return `+${m}m`;
  if (m === 0) return `+${h}h`;
  return `+${h}h ${String(m).padStart(2, "0")}m`;
}

export default function Dashboard() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState("");

  // ✅ acordeón
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [eventsByTask, setEventsByTask] = useState<Record<string, any[]>>({});
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);

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

  async function toggleRow(taskId: string) {
    if (!taskId) return;

    // cerrar si ya está abierto
    if (openTaskId === taskId) {
      setOpenTaskId(null);
      return;
    }

    setOpenTaskId(taskId);

    // si ya lo tengo cacheado, no vuelvo a pedir
    if (eventsByTask[taskId]) return;

    setLoadingTaskId(taskId);
    try {
      const out = await getTaskEvents(taskId);
      const evs = (out.events || []).slice();

      // por las dudas, ordeno por event_time asc
      evs.sort((a: any, b: any) => String(a?.event_time || "").localeCompare(String(b?.event_time || "")));

      setEventsByTask((prev) => ({ ...prev, [taskId]: evs }));
    } catch (e: any) {
      setEventsByTask((prev) => ({ ...prev, [taskId]: [{ __error: e.message }] }));
    } finally {
      setLoadingTaskId(null);
    }
  }

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

        {err && (
          <div className="mt-4 p-3 rounded-2xl bg-zinc-950 border border-red-900 text-red-200">
            {err}
          </div>
        )}

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
                const taskId = String(r.task_id || "");
                const isOpen = openTaskId === taskId;
                const rowLink = mapsLink(r.lat, r.lon);
                const evs = taskId ? eventsByTask[taskId] : null;

                return (
                  <>
                    {/* fila principal */}
                    <tr
                      key={`row-${i}`}
                      className="border-t border-zinc-800 hover:bg-zinc-950/40 cursor-pointer"
                      onClick={() => toggleRow(taskId)}
                      title="Click para ver historial"
                    >
                      <td className="p-3 font-semibold">{r.cuadrilla}</td>
                      <td className="p-3">{r.id_cuadrilla || "-"}</td>
                      <td className="p-3">{r.ot}</td>
                      <td className="p-3">
                        <span className={badge(r.event_type)}>{r.event_type}</span>
                      </td>
                      <td className="p-3 text-zinc-300">{fmtAr(r.event_time)}</td>
                      <td className="p-3 text-zinc-300">{r.pause_reason || "-"}</td>

                      {/* links no deben disparar toggle */}
                      <td className="p-3 text-zinc-300" onClick={(e) => e.stopPropagation()}>
                        {rowLink ? (
                          <a className="text-brandRed underline" href={rowLink} target="_blank" rel="noreferrer">
                            ver mapa {r.accuracy_m != null ? `(${Math.round(r.accuracy_m)}m)` : ""}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        {r.photo_url ? (
                          <a className="text-brandRed underline" href={r.photo_url} target="_blank" rel="noreferrer">
                            ver
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>

                    {/* fila desplegable */}
                    {isOpen && (
                      <tr key={`open-${i}`} className="border-t border-zinc-800 bg-zinc-950/30">
                        <td colSpan={8} className="p-4">
                          <div className="text-sm font-semibold mb-2">Historial (con duración entre estados)</div>

                          {loadingTaskId === taskId && (
                            <div className="text-zinc-400 text-sm">Cargando historial…</div>
                          )}

                          {!loadingTaskId && evs && evs.length === 1 && (evs[0] as any)?.__error && (
                            <div className="text-red-200 text-sm">
                              ❌ Error cargando historial: {(evs[0] as any).__error}
                            </div>
                          )}

                          {!loadingTaskId && evs && evs.length > 0 && !(evs[0] as any)?.__error && (
                            <div className="grid gap-2">
                              {evs.map((e: any, idx: number) => {
                                const prev = idx > 0 ? evs[idx - 1] : null;
                                const delta = diffLabel(prev?.event_time, e?.event_time);
                                const link = mapsLink(e.lat, e.lon);

                                return (
                                  <div key={idx} className="p-3 rounded-xl border border-zinc-800 bg-zinc-950">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={badge(e.event_type)}>{e.event_type}</span>
                                        {delta && (
                                          <span className="text-xs text-zinc-400">
                                            {prev?.event_type ? `${prev.event_type} → ${e.event_type} ${delta}` : delta}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-xs text-zinc-400">{fmtAr(e.event_time)}</span>
                                    </div>

                                    {(e.pause_reason || e.comment) && (
                                      <div className="text-xs text-zinc-400 mt-1">
                                        {e.pause_reason ? `Motivo: ${e.pause_reason}` : ""}
                                        {e.pause_reason && e.comment ? " • " : ""}
                                        {e.comment ? `Nota: ${e.comment}` : ""}
                                      </div>
                                    )}

                                    <div className="mt-1 text-xs text-zinc-400 flex gap-3 flex-wrap">
                                      {link ? (
                                        <a className="text-brandRed underline" href={link} target="_blank" rel="noreferrer">
                                          ver mapa {e.accuracy_m != null ? `(${Math.round(e.accuracy_m)}m)` : ""}
                                        </a>
                                      ) : (
                                        <span>- sin ubicación -</span>
                                      )}

                                      {e.photo_url ? (
                                        <a className="text-brandRed underline" href={e.photo_url} target="_blank" rel="noreferrer">
                                          ver foto
                                        </a>
                                      ) : (
                                        <span>- sin foto -</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {!loadingTaskId && (!evs || evs.length === 0) && (
                            <div className="text-zinc-400 text-sm">Sin eventos todavía.</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td className="p-4 text-zinc-400" colSpan={8}>
                    Sin eventos todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          Tip: click en una fila para desplegar el historial y ver la duración entre estados.
        </div>
      </div>
    </div>
  );
}
