import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

const initialRegisterState = {
  username: "",
  email: "",
  password: "",
};

const getRequestErrorMessage = (requestError) => {
  const detail = requestError.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(" ") || "Please check the information you entered.";
  }

  return "Authentication failed.";
};

function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [mode, setMode] = useState("login-password");
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState(initialRegisterState);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectAfterAuth = (user) => {
    navigate(user.role === "admin" || user.role === "expert" ? "/dashboard" : "/chat");
  };

  const resetMessages = () => {
    setNotice("");
    setError("");
  };

  const showRegistrationForm = mode === "register";

  const renderAuthFields = () => {
    if (showRegistrationForm) {
      return (
        <>
          <input
            placeholder="Username"
            value={registerData.username}
            onChange={(event) =>
              setRegisterData((current) => ({ ...current, username: event.target.value }))
            }
            minLength={3}
            maxLength={50}
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
            minLength={8}
            maxLength={128}
            required
          />
        </>
      );
    }

    return (
      <>
        <input
          placeholder="Email"
          type="email"
          value={loginData.email}
          onChange={(event) =>
            setLoginData((current) => ({ ...current, email: event.target.value }))
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
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      if (mode === "login-password") {
        const { data } = await api.post("/auth/login/password", loginData);
        setSession(data.access_token, data.user);
        redirectAfterAuth(data.user);
      } else {
        const { data } = await api.post("/auth/register", registerData);
        setSession(data.access_token, data.user);
        redirectAfterAuth(data.user);
      }
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError));
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
            Create an account with your email and password, then use the same password to
            sign in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          {renderAuthFields()}

          {notice && <p className="success-text">{notice}</p>}
          {error && <p className="error-text">{error}</p>}
          <button className="primary-button" disabled={loading} type="submit">
            {loading
              ? "Please wait..."
              : mode === "login-password"
                ? "Login"
                : "Create Account"}
          </button>
        </form>

        <div className="auth-switch-row">
          {mode === "register" ? (
            <>
              <span>Already have an account?</span>
              <button
                onClick={() => {
                  setMode("login-password");
                  resetMessages();
                }}
                type="button"
              >
                Login
              </button>
            </>
          ) : (
            <>
              <span>Don't have an account?</span>
              <button
                onClick={() => {
                  setMode("register");
                  resetMessages();
                }}
                type="button"
              >
                Register
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
