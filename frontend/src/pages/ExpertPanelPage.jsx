import { useEffect, useState } from "react";
import { api } from "../services/api";

function ExpertPanelPage() {
  const [queries, setQueries] = useState([]);
  const [responses, setResponses] = useState({});
  const [error, setError] = useState("");

  const loadQueries = async () => {
    try {
      const { data } = await api.get("/expert-queries");
      setQueries(data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load expert queries.");
    }
  };

  useEffect(() => {
    loadQueries();
  }, []);

  const resolveQuery = async (queryId) => {
    try {
      await api.patch(`/expert-queries/${queryId}/resolve`, {
        expert_response: responses[queryId],
        status: "resolved",
      });
      await loadQueries();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to resolve expert query.");
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Expert Queue</p>
          <h2>Review escalated chatbot questions</h2>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="list">
        {queries.map((query) => (
          <div className="card form-grid" key={query.id}>
            <div className="bubble-head">
              <strong>Query #{query.id}</strong>
              <span className={query.status === "resolved" ? "badge success" : "badge warning"}>
                {query.status}
              </span>
            </div>
            <p>{query.question}</p>
            <small>Reason: {query.reason}</small>
            <textarea
              rows={4}
              placeholder="Write the expert response..."
              value={responses[query.id] || query.expert_response || ""}
              onChange={(event) =>
                setResponses((current) => ({ ...current, [query.id]: event.target.value }))
              }
            />
            <button
              className="primary-button"
              disabled={query.status === "resolved" || !(responses[query.id] || query.expert_response)}
              onClick={() => resolveQuery(query.id)}
              type="button"
            >
              Mark Resolved
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ExpertPanelPage;

