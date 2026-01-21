import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import UploadTasks from "./pages/UploadTasks";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import Dashboard from "./pages/Dashboard";
import TopNav from "./components/TopNav";

export default function App() {
  return (
    <BrowserRouter>
      <TopNav />

      <div className="pt-2">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/upload" element={<UploadTasks />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/task/:taskId" element={<TaskDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

