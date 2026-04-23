import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

const quickTopics = [
  "How do I apply for an Income Certificate?",
  "How can I check my application status?",
  "What documents are required for scholarships?",
  "How does exam form fee payment work?",
];

function LandingIcon({ name }) {
  const props = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
  };

  switch (name) {
    case "chat":
      return (
        <svg {...props}>
          <path d="M8 10h8" />
          <path d="M8 14h5" />
          <path d="M20 12a8 8 0 0 1-8 8H6l-3 3v-7a8 8 0 1 1 17-4Z" />
        </svg>
      );
    case "clock":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v5l3 2" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 3 5.5 6v5.1c0 4.1 2.8 7.8 6.5 8.9 3.7-1.1 6.5-4.8 6.5-8.9V6Z" />
          <path d="m9.5 12 1.8 1.8 3.2-3.6" />
        </svg>
      );
    case "send":
      return (
        <svg {...props}>
          <path d="M21 3 10 14" />
          <path d="m21 3-7 18-4-7-7-4Z" />
        </svg>
      );
    case "bot":
      return (
        <svg {...props}>
          <rect x="5" y="8" width="14" height="10" rx="4" />
          <path d="M12 4v4" />
          <path d="M9 12h.01" />
          <path d="M15 12h.01" />
          <path d="M9.5 15h5" />
        </svg>
      );
    case "login":
      return (
        <svg {...props}>
          <path d="M10 17H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h3" />
          <path d="m14 16 4-4-4-4" />
          <path d="M18 12H9" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your MPOnline assistant. Ask me about certificates, application steps, fee payment, or document requirements.",
      meta: "Public assistant",
    },
  ]);

  const homeRoute = user?.role === "admin" || user?.role === "expert" ? "/dashboard" : "/chat";

  const featureCards = useMemo(
    () => [
      {
        icon: "chat",
        title: "Instant Answers",
        text: "Visitors can ask the chatbot service-related questions without logging in.",
      },
      {
        icon: "clock",
        title: "24/7 Available",
        text: "Get quick help anytime for applications, status, documents, and payments.",
      },
      {
        icon: "shield",
        title: "Grievance With Login",
        text: "Login is required to submit a grievance or track an existing complaint.",
      },
    ],
    []
  );

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const sendQuestion = async (promptText) => {
    const trimmedQuestion = promptText.trim();
    if (!trimmedQuestion) return;

    setError("");
    setQuestion("");
    setLoading(true);
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", content: trimmedQuestion },
    ]);

    try {
      const { data } = await api.post("/public/chat", {
        question: trimmedQuestion,
        language: "en",
      });
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          meta: `Confidence ${data.confidence} | Sources: ${data.sources?.length ? data.sources.join(", ") : "None"}`,
        },
      ]);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to get answer right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <button className="landing-brand" onClick={() => navigate("/")} type="button">
          <span className="landing-brand-mark">
            <LandingIcon name="bot" />
          </span>
          <span className="landing-brand-copy">
            <strong>MPOnline</strong>
            <small>FAQ Chatbot</small>
          </span>
        </button>

        <nav className="landing-nav">
          <a href="#home">Home</a>
          <a href="#topics">Popular Topics</a>
          <a href="#help">How It Works</a>
          <button
            className="landing-login-button"
            onClick={() => navigate(user ? homeRoute : "/login")}
            type="button"
          >
            <span className="landing-login-icon">
              <LandingIcon name="login" />
            </span>
            <span>{user ? "Open Workspace" : "Login"}</span>
          </button>
        </nav>
      </header>

      <main className="landing-main" id="home">
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="landing-kicker">Welcome to</p>
            <h1>
              <span>MPOnline</span> FAQ Chatbot
            </h1>
            <p className="landing-subtitle">
              Your instant assistant for MPOnline services, applications, certificates,
              payments, and process-related questions. Visitors can chat freely, while
              grievance submission remains available only after login.
            </p>

            <div className="landing-feature-list">
              {featureCards.map((item) => (
                <div className="landing-feature-item" key={item.title}>
                  <span className="landing-feature-icon">
                    <LandingIcon name={item.icon} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="landing-grievance-banner">
              <strong>Grievance Registration</strong>
              <p>
                {user
                  ? "You are logged in. You can open the grievance section to submit or track complaints."
                  : "Please login to your account to raise a grievance or track your existing complaints."}
              </p>
              <button
                className="secondary-button"
                onClick={() => navigate(user ? "/grievances" : "/login")}
                type="button"
              >
                {user ? "Open Grievance Page" : "Login For Grievance"}
              </button>
            </div>
          </div>
        </section>

        <section className="landing-topics" id="topics">
          <div className="landing-section-title">
            <p className="eyebrow">Popular Topics</p>
            <h2>Frequently asked MPOnline topics</h2>
          </div>
          <div className="landing-topic-grid">
            {quickTopics.map((topic) => (
              <button
                className="landing-topic-card"
                key={topic}
                onClick={() => {
                  setChatOpen(true);
                  sendQuestion(topic);
                }}
                type="button"
              >
                <span className="landing-topic-icon">
                  <LandingIcon name="chat" />
                </span>
                <strong>{topic}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="landing-help" id="help">
          <div className="landing-section-title">
            <p className="eyebrow">How It Works</p>
            <h2>Public chat first, grievance after login</h2>
          </div>
          <div className="landing-help-grid">
            <div className="landing-help-card">
              <strong>1. Ask as a guest</strong>
              <p>Use the chatbot on the landing page without creating an account.</p>
            </div>
            <div className="landing-help-card">
              <strong>2. Get grounded answers</strong>
              <p>The assistant answers using the uploaded document knowledge base.</p>
            </div>
            <div className="landing-help-card">
              <strong>3. Login for grievance</strong>
              <p>Submitting, tracking, or replying to a grievance is available only after login.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <span className="landing-brand-mark">
            <LandingIcon name="bot" />
          </span>
          <div>
            <strong>MPOnline FAQ Chatbot</strong>
            <p>Document-grounded public help with protected grievance support.</p>
          </div>
        </div>
        <div className="landing-footer-links">
          <a href="#home">Home</a>
          <a href="#topics">Topics</a>
          <a href="#help">How It Works</a>
          <button onClick={() => navigate(user ? "/grievances" : "/login")} type="button">
            Grievance
          </button>
        </div>
        <small>© {new Date().getFullYear()} MPOnline FAQ Assistant. Built for fast, grounded answers.</small>
      </footer>

      <div className="landing-floating-chat">
        {chatOpen && (
          <div className={chatExpanded ? "floating-chat-panel expanded" : "floating-chat-panel"}>
            <div className="floating-chat-head">
              <strong>Ask me anything</strong>
              <div className="floating-chat-actions">
                <button
                  className="floating-chat-close"
                  onClick={() => setChatExpanded((current) => !current)}
                  type="button"
                >
                  {chatExpanded ? "Exit Fullscreen" : "Expand"}
                </button>
                <button
                  className="floating-chat-close"
                  onClick={() => {
                    setChatExpanded(false);
                    setChatOpen(false);
                  }}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="floating-chat-feed">
              {messages.slice(-2).map((message) => (
                <div className={message.role === "assistant" ? "floating-message assistant" : "floating-message user"} key={message.id}>
                  {message.role === "assistant" ? (
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  ) : (
                    <p>{message.content}</p>
                  )}
                </div>
              ))}
              {loading && (
                <div className="floating-message assistant waiting">
                  <p>Searching for the best answer...</p>
                </div>
              )}
              {error && <p className="error-text">{error}</p>}
            </div>
            <form
              className="floating-chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                sendQuestion(question);
              }}
            >
              <input
                placeholder={loading ? "Please wait..." : "Type your question here..."}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={loading}
              />
              <button className="landing-send-button" disabled={loading || !question.trim()} type="submit">
                <LandingIcon name="send" />
              </button>
            </form>
          </div>
        )}
        <button
          className="floating-chat-trigger"
          onClick={() => setChatOpen((current) => !current)}
          type="button"
          aria-label="Open chatbot"
        >
          <span className="floating-chat-badge" />
          <span className="floating-logo-mark" aria-hidden="true">
            <img
              alt=""
              className="floating-logo-image"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              src="/chatbot/chatbot-icon.png"
            />
            <span className="floating-logo-ring" />
            <span className="floating-logo-core">MP</span>
          </span>
        </button>
      </div>
    </div>
  );
}

export default LandingPage;
