import { useEffect, useState } from "react";
import GrievanceThread from "../components/GrievanceThread";
import { api } from "../services/api";

function GrievancePage() {
  const [complaint, setComplaint] = useState("");
  const [created, setCreated] = useState(null);
  const [grievances, setGrievances] = useState([]);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [submittingCommentId, setSubmittingCommentId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadMyGrievances = async () => {
    try {
      const { data } = await api.get("/grievances/mine");
      setGrievances(data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load your grievances.");
    }
  };

  useEffect(() => {
    loadMyGrievances();
    const intervalId = window.setInterval(loadMyGrievances, 15000);
    window.addEventListener("grievance-change", loadMyGrievances);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("grievance-change", loadMyGrievances);
    };
  }, []);

  const submitGrievance = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const { data } = await api.post("/grievance", { complaint });
      setCreated(data);
      setComplaint("");
      setNotice(`Grievance #${data.id} submitted successfully.`);
      await loadMyGrievances();
      window.dispatchEvent(new Event("grievance-change"));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to create grievance.");
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
      await loadMyGrievances();
      window.dispatchEvent(new Event("grievance-change"));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to post reply.");
    } finally {
      setSubmittingCommentId(null);
    }
  };

  return (
    <section className="page-section two-column">
      <form className="card form-grid" onSubmit={submitGrievance}>
        <div>
          <p className="eyebrow">Grievance System</p>
          <h2>Register a complaint</h2>
        </div>
        <textarea
          rows={6}
          placeholder="Describe your complaint or unresolved issue."
          value={complaint}
          onChange={(event) => setComplaint(event.target.value)}
          required
        />
        <button className="primary-button compact-button" type="submit">
          Submit Grievance
        </button>
        {notice && <p className="success-text">{notice}</p>}
        {created && (
          <p className="success-text">
            Grievance #{created.id} created with status "{created.status}".
          </p>
        )}
        {error && <p className="error-text">{error}</p>}
      </form>

      <div className="card form-grid">
        <div>
          <p className="eyebrow">My Grievances</p>
          <h2>See all grievances you have submitted</h2>
        </div>
        <div className="list">
          {grievances.length === 0 && (
            <div className="status-box">
              <p>You have not submitted any grievances yet.</p>
            </div>
          )}
          {grievances.map((item) => (
            <div className="list-item" key={item.id}>
              <div className="bubble-head">
                <strong>Grievance #{item.id}</strong>
                <span className={item.status === "resolved" ? "badge success" : "badge warning"}>
                  {item.status}
                </span>
              </div>
              <p>{item.complaint}</p>
              <small>{new Date(item.created_at).toLocaleString()}</small>
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
                placeholder="Reply to admin or expert on this grievance..."
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default GrievancePage;
