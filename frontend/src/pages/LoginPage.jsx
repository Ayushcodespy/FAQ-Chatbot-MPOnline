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
  const [mode, setMode] = useState("login-password");
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [otpLoginData, setOtpLoginData] = useState({ email: "", otp: "" });
  const [registerData, setRegisterData] = useState(initialRegisterState);
  const [registerOtp, setRegisterOtp] = useState("");
  const [registerStep, setRegisterStep] = useState("form");
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      if (mode === "login-password") {
        const { data } = await api.post("/auth/login/password", loginData);
        setSession(data.access_token, data.user);
        redirectAfterAuth(data.user);
      } else if (mode === "login-otp") {
        if (!otpLoginData.otp.trim()) {
          const { data } = await api.post("/auth/login/request-otp", { email: otpLoginData.email });
          setNotice(data.message);
        } else {
          const { data } = await api.post("/auth/login/verify-otp", otpLoginData);
          setSession(data.access_token, data.user);
          redirectAfterAuth(data.user);
        }
      } else if (registerStep === "form") {
        const { data } = await api.post("/auth/register/request-otp", registerData);
        setRegisterStep("otp");
        setNotice(data.message);
      } else {
        const { data } = await api.post("/auth/register/verify-otp", {
          email: registerData.email,
          otp: registerOtp,
        });
        setSession(data.access_token, data.user);
        redirectAfterAuth(data.user);
      }
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
            Sign in with your email using either password or OTP. New users verify their
            email with an OTP before the account is created.
          </p>
        </div>

        <div className="tab-row">
          <button
            className={mode === "login-password" ? "tab active" : "tab"}
            onClick={() => {
              setMode("login-password");
              resetMessages();
            }}
            type="button"
          >
            Login With Password
          </button>
          <button
            className={mode === "login-otp" ? "tab active" : "tab"}
            onClick={() => {
              setMode("login-otp");
              resetMessages();
            }}
            type="button"
          >
            Login With OTP
          </button>
          <button
            className={mode === "register" ? "tab active" : "tab"}
            onClick={() => {
              setMode("register");
              setRegisterStep("form");
              setRegisterOtp("");
              resetMessages();
            }}
            type="button"
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-grid">
          {mode === "register" ? (
            registerStep === "form" ? (
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
                <input type="email" value={registerData.email} disabled />
                <input
                  placeholder="Enter verification OTP"
                  value={registerOtp}
                  onChange={(event) => setRegisterOtp(event.target.value)}
                  required
                />
              </>
            )
          ) : mode === "login-otp" ? (
            <>
              <input
                placeholder="Email"
                type="email"
                value={otpLoginData.email}
                onChange={(event) =>
                  setOtpLoginData((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
              <input
                placeholder="Enter OTP after requesting it"
                value={otpLoginData.otp}
                onChange={(event) =>
                  setOtpLoginData((current) => ({ ...current, otp: event.target.value }))
                }
              />
            </>
          ) : (
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
          )}

          {notice && <p className="success-text">{notice}</p>}
          {error && <p className="error-text">{error}</p>}
          <button className="primary-button" disabled={loading} type="submit">
            {loading
              ? "Please wait..."
              : mode === "login-password"
                ? "Login"
                : mode === "login-otp"
                  ? otpLoginData.otp.trim()
                    ? "Verify OTP"
                    : "Send Login OTP"
                  : registerStep === "otp"
                    ? "Verify And Create Account"
                    : "Send Registration OTP"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
