import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import UploadTasks from "./pages/UploadTasks";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import Dashboard from "./pages/Dashboard";
import Uploads from "./pages/Uploads"; // ✅ NUEVO

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/upload" element={<UploadTasks />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/task/:taskId" element={<TaskDetail />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/uploads" element={<Uploads />} /> {/* ✅ NUEVO */}
      </Routes>
    </BrowserRouter>
  );
}
