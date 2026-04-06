import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { api } from "../services/api";

function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState("en");
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const threadRef = useRef(null);
  const activeSessionId = searchParams.get("session") ? Number(searchParams.get("session")) : null;

  const activeSession = useMemo(
    () => sessions.find((item) => item.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  const loadSessions = async (preferredSessionId = null) => {
    try {
      const { data } = await api.get("/chat/sessions");
      setSessions(data);

      if (preferredSessionId) {
        setSearchParams({ session: String(preferredSessionId) });
      } else if (data.length > 0) {
        const current = activeSessionId;
        const nextId =
          current && data.some((item) => item.id === current) ? current : data[0].id;
        setSearchParams({ session: String(nextId) });
      } else {
        setSearchParams({});
        setMessages([]);
      }
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load chats.");
    }
  };

  const loadMessages = async (sessionId) => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    try {
      const { data } = await api.get(`/chat/sessions/${sessionId}/messages`);
      setMessages(data);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load messages.");
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    loadMessages(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [messages, activeSessionId]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!question.trim()) return;

    setError("");
    setNotice("");
    setLoading(true);
    try {
      const { data } = await api.post("/chat", {
        question,
        language,
        session_id: activeSessionId,
      });
      setQuestion("");
      window.dispatchEvent(new Event("chat-session-change"));
      await loadSessions(data.session_id);
      await loadMessages(data.session_id);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Chat request failed.");
    } finally {
      setLoading(false);
    }
  };

  const askExpert = async (message) => {
    try {
      await api.post("/ask-expert", {
        question: message.question,
        reason: "manual_request",
      });
      setNotice("Your question has been escalated to an expert.");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Expert escalation failed.");
    }
  };

  const submitFeedback = async (message, rating) => {
    try {
      await api.post("/feedback", {
        question: message.question,
        answer: message.answer,
        rating,
      });
      setNotice("Feedback submitted.");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Feedback submission failed.");
    }
  };

  return (
    <section className="chat-only-page">
      <div className="chatgpt-main">
        <header className="chatgpt-header">
          <div>
            <p className="eyebrow">Grounded RAG Chat</p>
            <h2>{activeSession?.title || "New chat"}</h2>
          </div>
          <div className="chat-header-actions">
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
        </header>

        <div className="chatgpt-thread" ref={threadRef}>
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <h3>Ask about uploaded MPOnline documents</h3>
              <p>
                Start with questions like application process, required documents,
                eligibility, fee, or timelines from your uploaded files.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div className="thread-block" key={message.id}>
                <div className="thread-row user">
                  <div className="avatar user-avatar">U</div>
                  <div className="thread-content">
                    <p>{message.question}</p>
                  </div>
                </div>

                <div className="thread-row assistant">
                  <div className="avatar assistant-avatar">AI</div>
                  <div className="thread-content assistant-card">
                    <div className="bubble-head">
                      <strong>Assistant</strong>
                      <span className={message.escalated ? "badge warning" : "badge success"}>
                        {message.escalated ? "Escalated" : "Grounded"}
                      </span>
                    </div>
                    <div className="markdown-answer">
                      <ReactMarkdown>{message.answer}</ReactMarkdown>
                    </div>
                    <small>
                      Confidence: {message.confidence} | Sources:{" "}
                      {message.sources?.length ? message.sources.join(", ") : "None"}
                    </small>
                    <div className="action-row">
                      <button onClick={() => askExpert(message)} type="button">
                        Ask Expert
                      </button>
                      <button onClick={() => submitFeedback(message, 5)} type="button">
                        Helpful
                      </button>
                      <button onClick={() => submitFeedback(message, 2)} type="button">
                        Not Helpful
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form className="chatgpt-composer" onSubmit={sendMessage}>
          {error && <p className="error-text">{error}</p>}
          {notice && <p className="success-text">{notice}</p>}
          <div className="composer-shell">
            <textarea
              placeholder="Message MPOnline FAQ assistant..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={3}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button className="primary-button send-button" disabled={loading} type="submit">
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default ChatPage;
