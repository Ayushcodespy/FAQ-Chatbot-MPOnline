import { useEffect, useMemo, useRef, useState } from "react";
import GrievanceThread from "../components/GrievanceThread";
import { api } from "../services/api";

const grievanceStatuses = ["open", "in_review", "resolved", "rejected"];

function DashboardPage() {
  const [questions, setQuestions] = useState(null);
  const [failures, setFailures] = useState(null);
  const [usage, setUsage] = useState(null);
  const [grievances, setGrievances] = useState([]);
  const [grievanceFilter, setGrievanceFilter] = useState("all");
  const [statusDrafts, setStatusDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [submittingCommentId, setSubmittingCommentId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const grievanceSectionRef = useRef(null);

  const loadDashboard = async () => {
    const [
      questionsResponse,
      failuresResponse,
      usageResponse,
      grievancesResponse,
    ] = await Promise.all([
      api.get("/analytics/questions"),
      api.get("/analytics/failures"),
      api.get("/analytics/usage"),
      api.get("/grievances"),
    ]);

    setQuestions(questionsResponse.data);
    setFailures(failuresResponse.data);
    setUsage(usageResponse.data);
    setGrievances(grievancesResponse.data);
    setStatusDrafts(
      Object.fromEntries(grievancesResponse.data.map((item) => [item.id, item.status]))
    );
  };

  const unresolvedGrievances = useMemo(
    () => grievances.filter((item) => item.status !== "resolved"),
    [grievances]
  );

  const visibleGrievances = useMemo(() => {
    if (grievanceFilter === "all") return grievances;
    return grievances.filter((item) => item.status === grievanceFilter);
  }, [grievances, grievanceFilter]);

  useEffect(() => {
    let isMounted = true;

    const handleLoad = async () => {
      try {
        await loadDashboard();
        if (!isMounted) return;
      } catch (requestError) {
        if (isMounted) {
          setError(requestError.response?.data?.detail || "Unable to load analytics.");
        }
      }
    };

    handleLoad();
    const intervalId = window.setInterval(handleLoad, 15000);
    window.addEventListener("grievance-change", handleLoad);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("grievance-change", handleLoad);
    };
  }, []);

  const updateGrievanceStatus = async (grievanceId) => {
    try {
      await api.patch(`/grievance/${grievanceId}`, {
        status: statusDrafts[grievanceId],
      });

      await loadDashboard();
      setNotice(`Grievance #${grievanceId} updated successfully.`);
      setError("");
      window.dispatchEvent(new Event("grievance-change"));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to update grievance status.");
    }
  };

  const submitComment = async (grievanceId) => {
    const message = commentDrafts[grievanceId]?.trim();
    if (!message) return;

    setSubmittingCommentId(grievanceId);
    setError("");
    try {
      await api.post(`/grievance/${grievanceId}/comments`, { message });
      setCommentDrafts((current) => ({ ...current, [grievanceId]: "" }));
      await loadDashboard();
      setNotice(`Reply added to grievance #${grievanceId}.`);
      window.dispatchEvent(new Event("grievance-change"));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to add comment.");
    } finally {
      setSubmittingCommentId(null);
    }
  };

  const openGrievanceSection = () => {
    grievanceSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Analytics</p>
          <h2>Usage, failure, and question monitoring</h2>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      {unresolvedGrievances.length > 0 && (
        <button className="notification-card" onClick={openGrievanceSection} type="button">
          <div>
            <p className="eyebrow">Grievance Notification</p>
            <h3>{unresolvedGrievances.length} grievance{unresolvedGrievances.length > 1 ? "s" : ""} need attention</h3>
            <p className="muted">
              Click here to open the grievance list and update their status.
            </p>
          </div>
          <span className="nav-badge">{unresolvedGrievances.length}</span>
        </button>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Questions</h3>
          <p>{questions?.total_questions ?? "--"}</p>
        </div>
        <div className="stat-card">
          <h3>Escalated</h3>
          <p>{questions?.escalated_questions ?? "--"}</p>
        </div>
        <div className="stat-card">
          <h3>Failed Answers</h3>
          <p>{failures?.failed_answers ?? "--"}</p>
        </div>
        <div className="stat-card">
          <h3>Pending Experts</h3>
          <p>{failures?.expert_queue_size ?? "--"}</p>
        </div>
        <div className="stat-card">
          <h3>Total Documents</h3>
          <p>{usage?.total_documents ?? "--"}</p>
        </div>
        <div className="stat-card">
          <h3>Average Rating</h3>
          <p>{usage?.average_feedback_rating ?? "--"}</p>
        </div>
      </div>

      <div className="card">
        <h3>Recent Questions</h3>
        <div className="list">
          {questions?.recent_questions?.map((item, index) => (
            <div className="list-item" key={`${item.created_at}-${index}`}>
              <p>{item.question}</p>
              <small>
                Confidence: {item.confidence} | {new Date(item.created_at).toLocaleString()}
              </small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" ref={grievanceSectionRef}>
        <div className="bubble-head">
          <h3>User Grievances</h3>
          <select
            className="status-select"
            value={grievanceFilter}
            onChange={(event) => setGrievanceFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            {grievanceStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="list">
          {visibleGrievances.length === 0 && <p className="muted">No grievances found for this filter.</p>}
          {visibleGrievances.map((item) => (
            <div className="list-item" key={item.id}>
              <div className="bubble-head">
                <strong>Grievance #{item.id}</strong>
                <span className={item.status === "resolved" ? "badge success" : "badge warning"}>
                  {item.status}
                </span>
              </div>
              <div className="grievance-meta">
                <small>
                  User: {item.username || "Unknown"} ({item.email || "No email"})
                </small>
                <small>User ID: {item.user_id}</small>
              </div>
              <p>{item.complaint}</p>
              <div className="grievance-meta">
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
              <div className="status-row">
                <select
                  className="status-select"
                  value={statusDrafts[item.id] || item.status}
                  onChange={(event) =>
                    setStatusDrafts((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                >
                  {grievanceStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary-button"
                  onClick={() => updateGrievanceStatus(item.id)}
                  type="button"
                >
                  Save Status
                </button>
              </div>
              <GrievanceThread
                grievance={item}
                draftValue={commentDrafts[item.id] || ""}
                isSubmitting={submittingCommentId === item.id}
                onDraftChange={(value) =>
                  setCommentDrafts((current) => ({
                    ...current,
                    [item.id]: value,
                  }))
                }
                onSubmit={() => submitComment(item.id)}
                placeholder="Ask the user for more details or share an update..."
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default DashboardPage;
