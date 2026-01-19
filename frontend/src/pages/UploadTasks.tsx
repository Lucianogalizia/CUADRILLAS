import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadExcels } from "../api";

export default function UploadTasks() {
  const navigate = useNavigate();

  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState<string>("");

  async function onUpload() {
    setMsg("");
    try {
      const out = await uploadExcels(files);
      setMsg(`✅ Importación OK. Filas procesadas: ${out.imported}`);

      // ✅ Volver automático (dejá 1.2s para que el usuario vea el OK)
      setTimeout(() => {
        navigate("/tasks"); // <- si querés ir al dashboard: "/dashboard" | si querés login: "/"
      }, 1200);

    } catch (e: any) {
      setMsg(`❌ Error: ${e.message}`);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-2xl mx-auto bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-2xl font-semibold">Subir Excel de Trabajos</h2>
        <p className="text-zinc-300 mt-2">
          Podés subir <b>más de un Excel</b>.
        </p>

        <input
          className="mt-5 block w-full text-zinc-200"
          type="file"
          multiple
          accept=".xlsx,.xls"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />

        <button
          className="mt-5 w-full py-4 rounded-xl bg-brandRed hover:opacity-90 font-semibold text-lg"
          disabled={files.length === 0}
          onClick={onUpload}
        >
          Importar
        </button>

        {msg && (
          <div className="mt-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            {msg}
          </div>
        )}

        <div className="mt-6 text-sm text-zinc-400">
          Columnas requeridas: Contratista, OT, UT, Descripción OT, Descripción OP, Cuadrilla, ID Cuadrilla
        </div>
      </div>
    </div>
  );
}
