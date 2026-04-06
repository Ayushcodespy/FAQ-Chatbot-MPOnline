import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

const initialRegisterState = {
  username: "",
  email: "",
  password: "",
};

function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [mode, setMode] = useState("login");
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState(initialRegisterState);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login" ? loginData : registerData;
      const { data } = await api.post(endpoint, payload);
      setSession(data.access_token, data.user);
      navigate("/chat");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div>
          <p className="eyebrow">AI + RAG</p>
          <h2>MPOnline FAQ Chatbot</h2>
          <p className="muted">
            Upload service documents, answer only from evidence, and escalate uncertain
            cases to human experts.
          </p>
        </div>

        <div className="tab-row">
          <button
            className={mode === "login" ? "tab active" : "tab"}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === "register" ? "tab active" : "tab"}
            onClick={() => setMode("register")}
            type="button"
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          {mode === "register" ? (
            <>
              <input
                placeholder="Username"
                value={registerData.username}
                onChange={(event) =>
                  setRegisterData((current) => ({ ...current, username: event.target.value }))
                }
                required
              />
              <input
                placeholder="Email"
                type="email"
                value={registerData.email}
                onChange={(event) =>
                  setRegisterData((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
              <input
                placeholder="Password"
                type="password"
                value={registerData.password}
                onChange={(event) =>
                  setRegisterData((current) => ({ ...current, password: event.target.value }))
                }
                required
              />
            </>
          ) : (
            <>
              <input
                placeholder="Username"
                value={loginData.username}
                onChange={(event) =>
                  setLoginData((current) => ({ ...current, username: event.target.value }))
                }
                required
              />
              <input
                placeholder="Password"
                type="password"
                value={loginData.password}
                onChange={(event) =>
                  setLoginData((current) => ({ ...current, password: event.target.value }))
                }
                required
              />
            </>
          )}

          {error && <p className="error-text">{error}</p>}
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
