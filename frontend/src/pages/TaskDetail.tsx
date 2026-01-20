import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getTask, sendEvent, sendEventWithPhoto } from "../api";
import { getGeo } from "../util";

type LastGeo = { lat: number; lon: number; acc?: number | null; time: string; type: string };

export default function TaskDetail() {
  const { taskId } = useParams();
  const cuadrilla = localStorage.getItem("cuadrilla") || "";
  const [task, setTask] = useState<any>(null);
  const [msg, setMsg] = useState<string>("");
  const [pauseReason, setPauseReason] = useState<string>("Espera repuesto");
  const [comment, setComment] = useState<string>("");
  const [photo, setPhoto] = useState<File | null>(null);

  // ✅ para mostrar en pantalla la última ubicación registrada desde acá
  const [lastGeo, setLastGeo] = useState<LastGeo | null>(null);

  useEffect(() => {
    (async () => {
      const t = await getTask(String(taskId));
      setTask(t);
    })();
  }, [taskId]);

  async function fire(type: string) {
    setMsg("⏳ Tomando ubicación...");
    try {
      const geo = await getGeo();

      // guardo para mostrarla
      setLastGeo({
        lat: geo.lat,
        lon: geo.lon,
        acc: geo.acc,
        time: new Date().toISOString(),
        type
      });

      // si hay foto, usamos endpoint multipart
      if (photo) {
        const fd = new FormData();
        fd.append("task_id", task.task_id);
        fd.append("ot", task.ot);
        fd.append("cuadrilla", cuadrilla);
        fd.append("id_cuadrilla", task.id_cuadrilla || "");
        fd.append("event_type", type);
        fd.append("lat", String(geo.lat));
        fd.append("lon", String(geo.lon));
        if (geo.acc != null) fd.append("accuracy_m", String(geo.acc));
        if (type === "PAUSA") fd.append("pause_reason", pauseReason);
        if (comment.trim()) fd.append("comment", comment.trim());
        fd.append("photo", photo);

        await sendEventWithPhoto(fd);
        setMsg(`✅ ${type} registrado (con foto)`);
      } else {
        await sendEvent({
          task_id: task.task_id,
          ot: task.ot,
          cuadrilla,
          id_cuadrilla: task.id_cuadrilla || null,
          event_type: type,
          lat: geo.lat,
          lon: geo.lon,
          accuracy_m: geo.acc,
          pause_reason: type === "PAUSA" ? pauseReason : null,
          comment: comment.trim() || null
        });
        setMsg(`✅ ${type} registrado`);
      }
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    }
  }

  if (!task) return <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">Cargando...</div>;

  const bigBtn = "w-full py-5 rounded-2xl font-bold text-xl shadow-lg";

  const mapsUrl =
    lastGeo ? `https://www.google.com/maps?q=${lastGeo.lat},${lastGeo.lon}` : "";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-2xl mx-auto bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
        <div className="text-sm text-zinc-400">
          Cuadrilla: {cuadrilla} • ID: {task.id_cuadrilla}
        </div>
        <div className="text-2xl font-semibold mt-1">OT {task.ot}</div>
        <div className="text-zinc-300 mt-2">{task.desc_op}</div>
        <div className="text-zinc-400 text-sm mt-2">
          UT: {task.ut} • Contratista: {task.contratista}
        </div>

        {/* ✅ Mostrar coordenadas registradas */}
        <div className="mt-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
          <div className="font-semibold">📌 Última ubicación registrada</div>
          {lastGeo ? (
            <div className="mt-2 text-sm text-zinc-300 space-y-1">
              <div>
                Evento: <span className="font-semibold">{lastGeo.type}</span>
              </div>
              <div>
                Lat/Lon:{" "}
                <span className="font-mono">
                  {lastGeo.lat.toFixed(6)}, {lastGeo.lon.toFixed(6)}
                </span>
              </div>
              <div>
                Precisión:{" "}
                {lastGeo.acc != null ? `${Math.round(lastGeo.acc)} m` : "-"}
              </div>
              <div className="pt-1">
                <a className="text-brandRed underline" href={mapsUrl} target="_blank" rel="noreferrer">
                  Ver en Google Maps
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-zinc-400">
              Todavía no registraste un evento con ubicación en esta pantalla.
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3">
          <button className={`${bigBtn} bg-zinc-800 hover:bg-zinc-700`} onClick={() => fire("LLEGADA")}>
            📍 LLEGADA
          </button>
          <button className={`${bigBtn} bg-brandRed hover:opacity-90`} onClick={() => fire("INICIO")}>
            ▶ INICIAR TRABAJO
          </button>

          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
            <div className="font-semibold">⏸ PAUSA</div>
            <select
              className="mt-3 w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800"
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
            >
              <option>Espera repuesto</option>
              <option>Espera grúa</option>
              <option>Clima</option>
              <option>HSE / Permisos</option>
              <option>Problema operativo</option>
              <option>Otro</option>
            </select>
            <button className={`${bigBtn} mt-3 bg-zinc-800 hover:bg-zinc-700`} onClick={() => fire("PAUSA")}>
              ⏸ PAUSAR
            </button>
          </div>

          <button className={`${bigBtn} bg-zinc-800 hover:bg-zinc-700`} onClick={() => fire("REANUDADO")}>
            🔄 REANUDAR
          </button>

          <button className={`${bigBtn} bg-zinc-800 hover:bg-zinc-700`} onClick={() => fire("FIN")}>
            ✅ FINALIZAR
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <textarea
            className="w-full p-4 rounded-2xl bg-zinc-950 border border-zinc-800"
            placeholder="Comentario (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
            <div className="font-semibold">📷 Foto (opcional)</div>
            <input
              className="mt-2"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            />
            <div className="text-xs text-zinc-400 mt-2">
              Si seleccionás foto, el evento se manda con foto automáticamente.
            </div>
          </div>
        </div>

        {msg && <div className="mt-5 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">{msg}</div>}
      </div>
    </div>
  );
}
