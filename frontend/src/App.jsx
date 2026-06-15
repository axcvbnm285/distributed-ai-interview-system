import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login        from "./pages/Login";
import Register     from "./pages/Register";
import Dashboard    from "./pages/Dashboard";
import InterviewRoom from "./pages/InterviewRoom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Login />} />
        <Route path="/register"  element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/room/:roomCode" element={<InterviewRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
