import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [cuadrilla, setCuadrilla] = useState("");
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Seguimiento de Cuadrillas</h1>
        <p className="text-zinc-300 mt-2">Ingresá tu <b>Cuadrilla</b>.</p>

        <input
          className="mt-5 w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-brandRed text-lg"
          placeholder="Ej: 1TER0004"
          value={cuadrilla}
          onChange={(e) => setCuadrilla(e.target.value)}
        />

        <button
          className="mt-5 w-full py-4 rounded-xl bg-brandRed hover:opacity-90 text-white font-semibold text-lg shadow-lg"
          onClick={() => {
            if (!cuadrilla.trim()) return;
            localStorage.setItem("cuadrilla", cuadrilla.trim());
            nav("/tasks");
          }}
        >
          Entrar
        </button>

        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold"
            onClick={() => nav("/upload")}
          >
            Subir Excel (Admin)
          </button>
          <button
            className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold"
            onClick={() => nav("/dashboard")}
          >
            Tablero
          </button>
        </div>
      </div>
    </div>
  );
}
