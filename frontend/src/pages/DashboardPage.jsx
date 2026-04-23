import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

function DoughnutChart({ segments, centerLabel, centerValue }) {
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="chart-ring-card">
      <svg className="chart-ring" viewBox="0 0 180 180" aria-hidden="true">
        <circle cx="90" cy="90" r={radius} className="chart-ring-track" />
        {segments.map((segment) => {
          const dash = (segment.value / 100) * circumference;
          const element = (
            <circle
              key={segment.label}
              cx="90"
              cy="90"
              r={radius}
              className="chart-ring-segment"
              style={{
                stroke: segment.color,
                strokeDasharray: `${dash} ${circumference - dash}`,
                strokeDashoffset: -offset,
              }}
            />
          );
          offset += dash;
          return element;
        })}
      </svg>
      <div className="chart-ring-center">
        <small>{centerLabel}</small>
        <strong>{centerValue}</strong>
      </div>
      <div className="chart-legend">
        {segments.map((segment) => (
          <div className="chart-legend-item" key={segment.label}>
            <span className="chart-dot" style={{ backgroundColor: segment.color }} />
            <span>{segment.label}</span>
            <strong>{segment.displayValue}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState(null);
  const [failures, setFailures] = useState(null);
  const [usage, setUsage] = useState(null);
  const [grievances, setGrievances] = useState([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

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
  };

  const unresolvedGrievances = useMemo(
    () => grievances.filter((item) => item.status !== "resolved"),
    [grievances]
  );
  const resolvedGrievances = useMemo(
    () => grievances.filter((item) => item.status === "resolved"),
    [grievances]
  );
  const helpfulFeedbackCount = usage?.helpful_feedback_count ?? 0;
  const unhelpfulFeedbackCount = usage?.unhelpful_feedback_count ?? 0;
  const totalFeedbackCount = usage?.total_feedback_entries ?? 0;
  const helpfulShare = usage?.helpful_feedback_share ?? 0;
  const grievanceResolutionRate = failures?.total_grievances
    ? Math.round(((failures?.resolved_grievances ?? 0) / failures.total_grievances) * 100)
    : 0;
  const satisfactionLevel = totalFeedbackCount
    ? Math.round(((helpfulFeedbackCount * 100) / totalFeedbackCount))
    : 0;

  const dashboardMetrics = [
    { label: "Open Grievances", value: failures?.unresolved_grievances ?? "--", tone: "alert" },
    { label: "Solved Grievances", value: failures?.resolved_grievances ?? "--", tone: "success" },
    { label: "Total Questions", value: questions?.total_questions ?? "--", tone: "warm" },
    { label: "Escalated", value: questions?.escalated_questions ?? "--", tone: "alert" },
    { label: "Failed Answers", value: failures?.failed_answers ?? "--", tone: "danger" },
    { label: "Pending Experts", value: failures?.expert_queue_size ?? "--", tone: "cool" },
    { label: "Total Documents", value: usage?.total_documents ?? "--", tone: "neutral" },
    { label: "Average Rating", value: usage?.average_feedback_rating ?? "--", tone: "success" },
  ];

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

  return (
    <section className="page-section">
      <div className="dashboard-hero card">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">Analytics</p>
          <h2>Usage, failure, and grievance monitoring</h2>
          <p className="muted">
            Keep an eye on chatbot health, expert queue pressure, and unresolved user issues from one place.
          </p>
        </div>
        <div className="dashboard-hero-strip">
          <div className="summary-pill">
            <strong>{grievances.length}</strong>
            <span>Total grievances</span>
          </div>
          <div className="summary-pill">
            <strong>{unresolvedGrievances.length}</strong>
            <span>Open attention</span>
          </div>
          <div className="summary-pill">
            <strong>{resolvedGrievances.length}</strong>
            <span>Resolved</span>
          </div>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      {unresolvedGrievances.length > 0 && (
        <button className="notification-card" onClick={() => navigate("/grievances")} type="button">
          <div>
            <p className="eyebrow">Grievance Notification</p>
            <h3>{unresolvedGrievances.length} grievance{unresolvedGrievances.length > 1 ? "s" : ""} need attention</h3>
            <p className="muted">
              Open the grievance page to review threads, reply, and update status.
            </p>
          </div>
          <span className="nav-badge">{unresolvedGrievances.length}</span>
        </button>
      )}

      <div className="stats-grid">
        {dashboardMetrics.map((metric) => (
          <div className={`stat-card metric-card ${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <p>{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="analytics-visual-grid">
        <div className="card chart-panel">
          <div className="page-header">
            <div>
              <p className="eyebrow">Feedback Split</p>
              <h3>Helpful vs not helpful</h3>
            </div>
            <div className="summary-pill subtle">
              <strong>{satisfactionLevel}%</strong>
              <span>User satisfaction</span>
            </div>
          </div>
          <DoughnutChart
            centerLabel="Helpful share"
            centerValue={`${helpfulShare}%`}
            segments={[
              {
                label: "Helpful",
                value: helpfulShare,
                displayValue: helpfulFeedbackCount,
                color: "#2f855a",
              },
              {
                label: "Not helpful",
                value: Math.max(0, 100 - helpfulShare),
                displayValue: unhelpfulFeedbackCount,
                color: "#dd6b20",
              },
            ]}
          />
        </div>

        <div className="card chart-panel">
          <div className="page-header">
            <div>
              <p className="eyebrow">Grievance Progress</p>
              <h3>How many issues are getting solved</h3>
            </div>
            <div className="summary-pill subtle">
              <strong>{grievanceResolutionRate}%</strong>
              <span>Resolution rate</span>
            </div>
          </div>
          <DoughnutChart
            centerLabel="Solved share"
            centerValue={`${grievanceResolutionRate}%`}
            segments={[
              {
                label: "Solved",
                value: failures?.total_grievances ? grievanceResolutionRate : 0,
                displayValue: failures?.resolved_grievances ?? 0,
                color: "#2563eb",
              },
              {
                label: "Open",
                value: failures?.total_grievances ? 100 - grievanceResolutionRate : 100,
                displayValue: failures?.unresolved_grievances ?? 0,
                color: "#c2410c",
              },
            ]}
          />
        </div>
      </div>

      <div className="card insight-card">
        <div className="page-header">
          <div>
            <p className="eyebrow">Grievance Overview</p>
            <h3>Support queue snapshot</h3>
          </div>
          <div className="summary-pill subtle">
            <strong>{grievances.length}</strong>
            <span>Total cases</span>
          </div>
        </div>
        <div className="overview-inline-grid">
          <div className="overview-mini-card">
            <strong>{unresolvedGrievances.length}</strong>
            <span>Awaiting action</span>
          </div>
          <div className="overview-mini-card">
            <strong>{resolvedGrievances.length}</strong>
            <span>Closed cases</span>
          </div>
          <div className="overview-mini-card">
            <strong>{grievanceResolutionRate}%</strong>
            <span>Resolution rate</span>
          </div>
          <div className="overview-mini-card">
            <strong>{satisfactionLevel}%</strong>
            <span>Satisfaction level</span>
          </div>
        </div>
      </div>

      <div className="card insight-card">
        <div className="page-header">
          <div>
            <p className="eyebrow">Recent Activity</p>
            <h3>Recent Questions</h3>
          </div>
          <div className="summary-pill subtle">
            <strong>{questions?.recent_questions?.length ?? 0}</strong>
            <span>Latest entries</span>
          </div>
        </div>
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
    </section>
  );
}

export default DashboardPage;
