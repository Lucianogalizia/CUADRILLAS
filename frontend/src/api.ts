const API = "/api";

export async function uploadExcels(files: File[]) {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  const res = await fetch(`${API}/upload_tasks`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listTasks(cuadrilla: string) {
  const res = await fetch(`${API}/tasks?cuadrilla=${encodeURIComponent(cuadrilla)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTask(taskId: string) {
  const res = await fetch(`${API}/task/${encodeURIComponent(taskId)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ✅ NUEVO: historial de eventos por tarea
export async function getTaskEvents(taskId: string) {
  const res = await fetch(`${API}/task/${encodeURIComponent(taskId)}/events`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getDashboard() {
  const res = await fetch(`${API}/dashboard`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendEvent(payload: any) {
  const res = await fetch(`${API}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendEventWithPhoto(form: FormData) {
  const res = await fetch(`${API}/event_with_photo`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
