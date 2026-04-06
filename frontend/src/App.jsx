import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatPage from "./pages/ChatPage";
import DashboardPage from "./pages/DashboardPage";
import ExpertPanelPage from "./pages/ExpertPanelPage";
import GrievancePage from "./pages/GrievancePage";
import LoginPage from "./pages/LoginPage";
import UploadPage from "./pages/UploadPage";
import { useAuth } from "./context/AuthContext";

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/chat" replace /> : <LoginPage />}
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Layout>
              <ChatPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedRoute roles={["admin"]}>
            <Layout>
              <UploadPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={["admin", "expert"]}>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/grievances"
        element={
          <ProtectedRoute>
            <Layout>
              <GrievancePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/experts"
        element={
          <ProtectedRoute roles={["admin", "expert"]}>
            <Layout>
              <ExpertPanelPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={user ? "/chat" : "/login"} replace />} />
    </Routes>
  );
}

export default App;
