import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";

const navItems = [
  { to: "/grievances", label: "Grievance", icon: "grievance" },
  { to: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ["admin", "expert"] },
  { to: "/upload", label: "Upload", icon: "upload", roles: ["admin"] },
  { to: "/experts", label: "Experts", icon: "expert", roles: ["admin", "expert"] },
];

function SidebarIcon({ name }) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
  };

  switch (name) {
    case "grievance":
      return (
        <svg {...commonProps}>
          <path d="M12 9v4" />
          <circle cx="12" cy="16.5" r="0.7" fill="currentColor" stroke="none" />
          <path d="m10.2 4.9-6.6 11.4A2 2 0 0 0 5.3 19h13.4a2 2 0 0 0 1.7-2.7L13.8 4.9a2 2 0 0 0-3.6 0Z" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...commonProps}>
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-4" />
        </svg>
      );
    case "upload":
      return (
        <svg {...commonProps}>
          <path d="M12 16V4" />
          <path d="m8 8 4-4 4 4" />
          <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
        </svg>
      );
    case "expert":
      return (
        <svg {...commonProps}>
          <path d="M12 3 4.8 6.4v5.2c0 4.4 3 8.4 7.2 9.4 4.2-1 7.2-5 7.2-9.4V6.4Z" />
          <path d="m9.5 12 1.7 1.7 3.3-3.7" />
        </svg>
      );
    case "new-chat":
      return (
        <svg {...commonProps}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "recent":
      return (
        <svg {...commonProps}>
          <path d="M12 8v5l3 2" />
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        </svg>
      );
    case "chevron-left":
      return (
        <svg {...commonProps}>
          <path d="m14.5 6-6 6 6 6" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...commonProps}>
          <path d="m9.5 6 6 6-6 6" />
        </svg>
      );
    case "more":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function AppSidebar({ collapsed, grievanceCount, onToggleCollapse, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [feedbackModal, setFeedbackModal] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  const activeSessionId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("session");
    return raw ? Number(raw) : null;
  }, [location.search]);

  const loadSessions = async () => {
    try {
      const { data } = await api.get("/chat/sessions");
      setSessions(data);
    } catch {
      setSessions([]);
    }
  };

  useEffect(() => {
    loadSessions();
    window.addEventListener("chat-session-change", loadSessions);
    return () => window.removeEventListener("chat-session-change", loadSessions);
  }, []);

  const startNewChat = async () => {
    try {
      const { data } = await api.post("/chat/sessions", { title: "New chat" });
      window.dispatchEvent(new Event("chat-session-change"));
      navigate(`/chat?session=${data.id}`);
    } catch {
      navigate("/chat");
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      await api.delete(`/chat/sessions/${sessionId}`);
      setMenuOpenId(null);
      window.dispatchEvent(new Event("chat-session-change"));
      await loadSessions();

      if (activeSessionId === sessionId) {
        const { data } = await api.get("/chat/sessions");
        if (data.length > 0) {
          navigate(`/chat?session=${data[0].id}`);
        } else {
          navigate("/chat");
        }
      }
    } catch {
      setFeedbackError("Unable to delete this chat right now.");
    }
  };

  const openFeedback = async (session) => {
    try {
      setFeedbackError("");
      const { data } = await api.get(`/chat/sessions/${session.id}/messages`);
      const latestMessage = data[data.length - 1];
      if (!latestMessage) {
        setFeedbackError("This chat does not have any assistant answer yet.");
        setMenuOpenId(null);
        return;
      }
      setFeedbackRating(5);
      setFeedbackModal({
        sessionId: session.id,
        title: session.title,
        question: latestMessage.question,
        answer: latestMessage.answer,
      });
      setMenuOpenId(null);
    } catch {
      setFeedbackError("Unable to open feedback for this chat.");
    }
  };

  const submitSessionFeedback = async () => {
    if (!feedbackModal) return;
    setFeedbackLoading(true);
    setFeedbackError("");
    try {
      await api.post("/feedback", {
        question: feedbackModal.question,
        answer: feedbackModal.answer,
        rating: feedbackRating,
      });
      setFeedbackModal(null);
    } catch {
      setFeedbackError("Unable to submit feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <>
      <aside className={collapsed ? "app-sidebar collapsed" : "app-sidebar"}>
        <button
          className="sidebar-collapse-toggle"
          onClick={onToggleCollapse}
          type="button"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <SidebarIcon name={collapsed ? "chevron-right" : "chevron-left"} />
        </button>

        <div className="app-sidebar-top">
          <button className="sidebar-brand" onClick={() => navigate("/chat")} type="button">
            <span className="sidebar-brand-mark" aria-hidden="true">
              <span className="sidebar-brand-ring" />
              <span className="sidebar-brand-core">M</span>
            </span>
            {!collapsed && (
              <span className="sidebar-brand-text">
                <strong>MPOnline AI</strong>
                <small>Document grounded assistant</small>
              </span>
            )}
          </button>

          <button className="sidebar-primary-action" onClick={startNewChat} type="button" title="New chat">
            <span className="sidebar-nav-icon">
              <SidebarIcon name="new-chat" />
            </span>
            {!collapsed && <span>New chat</span>}
          </button>
        </div>

        <nav className="app-sidebar-nav">
          {navItems
            .filter((item) => !item.roles || item.roles.includes(user?.role))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? "sidebar-nav-link active" : "sidebar-nav-link")}
                title={item.label}
              >
                <span className="sidebar-nav-icon">
                  <SidebarIcon name={item.icon} />
                  {collapsed && item.to === "/grievances" && grievanceCount > 0 && (
                    <span className="sidebar-dot-badge" />
                  )}
                </span>
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.to === "/grievances" && grievanceCount > 0 && (
                  <span className="nav-badge">{grievanceCount}</span>
                )}
              </NavLink>
            ))}
        </nav>

        {!collapsed && (
          <div className="app-sidebar-sessions">
            <div className="sidebar-section-title-row">
              <span className="sidebar-nav-icon">
                <SidebarIcon name="recent" />
              </span>
              <p className="sidebar-section-title">Recent chats</p>
            </div>

            <div className="sidebar-session-list">
              {sessions.slice(0, 20).map((session) => (
                <div
                  key={session.id}
                  className={
                    location.pathname === "/chat" && activeSessionId === session.id
                      ? "sidebar-session-item active"
                      : "sidebar-session-item"
                  }
                  onClick={() => navigate(`/chat?session=${session.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/chat?session=${session.id}`);
                    }
                  }}
                >
                  <span className="sidebar-session-text">
                    <strong>{session.title}</strong>
                    <small>{new Date(session.updated_at).toLocaleDateString()}</small>
                  </span>

                  <div className="sidebar-session-actions" onClick={(event) => event.stopPropagation()}>
                    <button
                      className="session-menu-trigger"
                      type="button"
                      title="Chat options"
                      onClick={() => setMenuOpenId((current) => (current === session.id ? null : session.id))}
                    >
                      <SidebarIcon name="more" />
                    </button>

                    {menuOpenId === session.id && (
                      <div className="session-menu">
                        <button onClick={() => openFeedback(session)} type="button">
                          Feedback
                        </button>
                        <button onClick={() => deleteSession(session.id)} type="button">
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {sessions.length === 0 && (
                <div className="sidebar-empty-state">
                  <small>Your new chats will appear here.</small>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="app-sidebar-bottom">
          <div className="sidebar-user-chip" title={user?.username || "User"}>
            <span className="sidebar-user-dot">{user?.username?.slice(0, 2)?.toUpperCase() || "US"}</span>
            {!collapsed && (
              <span className="sidebar-user-meta">
                <strong>{user?.username}</strong>
                <small>{user?.role}</small>
              </span>
            )}
          </div>
        </div>
      </aside>

      {feedbackModal && (
        <div className="overlay-backdrop" onClick={() => setFeedbackModal(null)} role="presentation">
          <div className="overlay-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="bubble-head">
              <strong>Chat Feedback</strong>
              <button className="session-menu-close" onClick={() => setFeedbackModal(null)} type="button">
                Close
              </button>
            </div>
            <p className="muted">{feedbackModal.title}</p>
            <div className="feedback-rating-row">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  className={feedbackRating === value ? "rating-pill active" : "rating-pill"}
                  onClick={() => setFeedbackRating(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
            {feedbackError && <p className="error-text">{feedbackError}</p>}
            <button className="primary-button" disabled={feedbackLoading} onClick={submitSessionFeedback} type="button">
              {feedbackLoading ? "Submitting..." : "Submit feedback"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default AppSidebar;
