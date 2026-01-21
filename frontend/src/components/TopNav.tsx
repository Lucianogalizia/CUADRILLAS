import { Link, useLocation, useNavigate } from "react-router-dom";

function NavBtn({ to, label }: { to: string; label: string }) {
  const loc = useLocation();
  const active = loc.pathname === to;

  return (
    <Link
      to={to}
      className={[
        "px-4 py-2 rounded-xl border text-sm font-semibold transition",
        active
          ? "bg-zinc-950 border-brandRed text-zinc-100"
          : "bg-zinc-900/40 border-zinc-800 text-zinc-200 hover:border-brandRed",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function TopNav() {
  const navigate = useNavigate();
  const cuadrilla = localStorage.getItem("cuadrilla") || "";

  return (
    <div className="sticky top-0 z-50 backdrop-blur bg-zinc-950/70 border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2 rounded-xl bg-zinc-900/40 border border-zinc-800 text-sm font-semibold text-zinc-200 hover:border-brandRed"
            onClick={() => navigate(-1)}
          >
            ← Atrás
          </button>

          <NavBtn to="/" label="Inicio" />
          <NavBtn to="/upload" label="Subir Excel" />
          <NavBtn to="/tasks" label="Tareas" />
          <NavBtn to="/dashboard" label="Tablero" />
        </div>

        <div className="text-xs text-zinc-400">
          {cuadrilla ? `Cuadrilla: ${cuadrilla}` : "Sin cuadrilla"}
        </div>
      </div>
    </div>
  );
}
