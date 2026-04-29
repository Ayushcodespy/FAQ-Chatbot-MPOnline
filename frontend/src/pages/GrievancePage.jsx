import { useEffect, useMemo, useState } from "react";
import GrievanceThread from "../components/GrievanceThread";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

const grievanceStatuses = ["open", "in_review", "resolved", "rejected"];

function GrievancePage() {
  const { user } = useAuth();
  const isSupportUser = user?.role === "admin" || user?.role === "expert";
  const [complaint, setComplaint] = useState("");
  const [created, setCreated] = useState(null);
  const [grievances, setGrievances] = useState([]);
  const [grievanceFilter, setGrievanceFilter] = useState("all");
  const [selectedGrievanceId, setSelectedGrievanceId] = useState(null);
  const [statusDrafts, setStatusDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [savingStatusId, setSavingStatusId] = useState(null);
  const [submittingCommentId, setSubmittingCommentId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const openCount = grievances.filter((item) => item.status !== "resolved").length;
  const resolvedCount = grievances.filter((item) => item.status === "resolved").length;

  const loadGrievances = async () => {
    try {
      const { data } = await api.get(isSupportUser ? "/grievances" : "/grievances/mine");
      setGrievances(data);
      setSelectedGrievanceId((current) => {
        if (current && data.some((item) => item.id === current)) return current;
        return current;
      });
      if (isSupportUser) {
        setStatusDrafts(Object.fromEntries(data.map((item) => [item.id, item.status])));
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load your grievances.");
    }
  };

  const visibleGrievances = useMemo(() => {
    if (!isSupportUser || grievanceFilter === "all") return grievances;
    return grievances.filter((item) => item.status === grievanceFilter);
  }, [grievances, grievanceFilter, isSupportUser]);

  const selectedGrievance = useMemo(
    () => grievances.find((item) => item.id === selectedGrievanceId) || null,
    [grievances, selectedGrievanceId]
  );

  useEffect(() => {
    loadGrievances();
    const intervalId = window.setInterval(loadGrievances, 15000);
    window.addEventListener("grievance-change", loadGrievances);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("grievance-change", loadGrievances);
    };
  }, [isSupportUser]);

  const submitGrievance = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const { data } = await api.post("/grievance", { complaint });
      setCreated(data);
      setComplaint("");
      setNotice(`Grievance #${data.id} submitted successfully.`);
      await loadGrievances();
      setSelectedGrievanceId(data.id);
      window.dispatchEvent(new Event("grievance-change"));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to create grievance.");
    }
  };

  const updateGrievanceStatus = async (grievanceId) => {
    if (savingStatusId) return;

    const currentGrievance = grievances.find((item) => item.id === grievanceId);
    const nextStatus = statusDrafts[grievanceId] || currentGrievance?.status;
    if (!nextStatus) return;

    setSavingStatusId(grievanceId);
    setError("");
    setNotice("");
    try {
      await api.patch(`/grievance/${grievanceId}`, {
        status: nextStatus,
      });
      setNotice(`Grievance #${grievanceId} updated successfully.`);
      setError("");
      await loadGrievances();
      window.dispatchEvent(new Event("grievance-change"));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to update grievance status.");
    } finally {
      setSavingStatusId(null);
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
      setNotice(`Reply added to grievance #${grievanceId}.`);
      await loadGrievances();
      window.dispatchEvent(new Event("grievance-change"));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to post reply.");
    } finally {
      setSubmittingCommentId(null);
    }
  };

  return (
    <section className="page-section">
      <div className="grievance-summary-card">
        <div>
          <p className="eyebrow">Grievance System</p>
          <h2>{isSupportUser ? "Manage grievance threads from one place" : "Track issues without losing the conversation"}</h2>
          <p className="muted">
            {isSupportUser
              ? "Review all user complaints, update status, and reply from one clean workspace."
              : "Submit a grievance, follow its status, and open the full thread only when you need the details."}
          </p>
        </div>
        <div className="grievance-summary-strip">
          <div className="summary-pill">
            <strong>{grievances.length}</strong>
            <span>Total cases</span>
          </div>
          <div className="summary-pill">
            <strong>{openCount}</strong>
            <span>Need action</span>
          </div>
          <div className="summary-pill">
            <strong>{resolvedCount}</strong>
            <span>Resolved</span>
          </div>
        </div>
      </div>

      <div className={isSupportUser ? "grievance-layout support-only" : "grievance-layout"}>
        {!isSupportUser && (
          <form className="card form-grid grievance-form-card" onSubmit={submitGrievance}>
            <div>
              <p className="eyebrow">Raise Complaint</p>
              <h2>Register a complaint</h2>
            </div>
            <textarea
              rows={7}
              placeholder="Describe your complaint or unresolved issue."
              value={complaint}
              onChange={(event) => setComplaint(event.target.value)}
              required
            />
            <div className="grievance-form-actions">
              <button className="primary-button compact-button" type="submit">
                Submit Grievance
              </button>
              <small className="muted">Share the issue clearly. You can open the full thread later from the list.</small>
            </div>
            {notice && <p className="success-text">{notice}</p>}
            {created && (
              <p className="success-text">
                Grievance #{created.id} created with status "{created.status}".
              </p>
            )}
            {error && <p className="error-text">{error}</p>}
          </form>
        )}

        <div className="card form-grid grievance-list-card">
          <div className="page-header">
            <div>
              <p className="eyebrow">{isSupportUser ? "Support Queue" : "My Grievances"}</p>
              <h2>{isSupportUser ? "View, inspect, and respond to grievances" : "A simple list of your grievance questions"}</h2>
            </div>
            <div className="summary-pill subtle">
              <strong>{visibleGrievances.length}</strong>
              <span>Items</span>
            </div>
          </div>

          {isSupportUser && (
            <div className="status-row">
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
          )}

          {notice && isSupportUser && <p className="success-text">{notice}</p>}
          {error && isSupportUser && <p className="error-text">{error}</p>}

          <div className="list">
            {visibleGrievances.length === 0 && (
              <div className="status-box">
                <p>{isSupportUser ? "No grievances found for this filter." : "You have not submitted any grievances yet."}</p>
              </div>
            )}

            {visibleGrievances.map((item) => (
              <div className="list-item grievance-list-row" key={item.id}>
                <div className="grievance-list-copy">
                  <div className="grievance-entry-top">
                    <strong>Grievance #{item.id}</strong>
                    <span className={item.status === "resolved" ? "badge success" : "badge warning"}>
                      {item.status}
                    </span>
                  </div>
                  <p>{item.complaint}</p>
                  <small className="muted">Logged on {new Date(item.created_at).toLocaleString()}</small>
                </div>
                <button
                  className="secondary-button grievance-view-button"
                  onClick={() => setSelectedGrievanceId(item.id)}
                  type="button"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedGrievance && (
        <div className="overlay-backdrop" onClick={() => setSelectedGrievanceId(null)} role="presentation">
          <div
            className="overlay-card grievance-detail-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="page-header">
              <div>
                <p className="eyebrow">Grievance Detail</p>
                <h2>Grievance #{selectedGrievance.id}</h2>
              </div>
              <button className="session-menu-close" onClick={() => setSelectedGrievanceId(null)} type="button">
                Close
              </button>
            </div>

            <div className="grievance-detail-grid">
              <div className="grievance-detail-block">
                <strong>Question / Complaint</strong>
                <p>{selectedGrievance.complaint}</p>
              </div>
              <div className="grievance-detail-block">
                <strong>Status</strong>
                <span className={selectedGrievance.status === "resolved" ? "badge success" : "badge warning"}>
                  {selectedGrievance.status}
                </span>
              </div>
              <div className="grievance-detail-block">
                <strong>Submitted On</strong>
                <p>{new Date(selectedGrievance.created_at).toLocaleString()}</p>
              </div>
              {isSupportUser && (
                <>
                  <div className="grievance-detail-block">
                    <strong>User Details</strong>
                    <p>{selectedGrievance.username || "Unknown"}</p>
                    <small>{selectedGrievance.email || "No email available"}</small>
                  </div>
                  <div className="grievance-detail-block">
                    <strong>User ID</strong>
                    <p>{selectedGrievance.user_id}</p>
                  </div>
                </>
              )}
            </div>

            {isSupportUser && (
              <div className="status-row grievance-detail-actions">
                <select
                  className="status-select"
                  disabled={savingStatusId === selectedGrievance.id}
                  value={statusDrafts[selectedGrievance.id] || selectedGrievance.status}
                  onChange={(event) =>
                    setStatusDrafts((current) => ({
                      ...current,
                      [selectedGrievance.id]: event.target.value,
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
                  className="secondary-button loading-button"
                  disabled={savingStatusId === selectedGrievance.id}
                  onClick={() => updateGrievanceStatus(selectedGrievance.id)}
                  type="button"
                >
                  {savingStatusId === selectedGrievance.id && (
                    <span className="button-spinner" aria-hidden="true" />
                  )}
                  <span>{savingStatusId === selectedGrievance.id ? "Saving..." : "Save Status"}</span>
                </button>
              </div>
            )}

            <GrievanceThread
              grievance={selectedGrievance}
              draftValue={commentDrafts[selectedGrievance.id] || ""}
              isSubmitting={submittingCommentId === selectedGrievance.id}
              onDraftChange={(value) =>
                setCommentDrafts((current) => ({
                  ...current,
                  [selectedGrievance.id]: value,
                }))
              }
              onSubmit={() => submitComment(selectedGrievance.id)}
              placeholder={isSupportUser ? "Ask for more details or share an update..." : "Reply to admin or expert on this grievance..."}
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default GrievancePage;
