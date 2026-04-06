import { useState } from "react";
import { api } from "../services/api";

function UploadPage() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!file) return;

    setError("");
    setMessage("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(`${data.filename} indexed successfully with ${data.chunk_count} chunks.`);
      setFile(null);
      event.target.reset();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Document Ingestion</p>
          <h2>Upload PDF or image documents for the RAG knowledge base</h2>
        </div>
      </div>

      <form className="card form-grid" onSubmit={handleUpload}>
        <input
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          type="file"
          required
        />
        <p className="muted">
          OCR is applied through Tesseract, text is chunked, embedded, and stored in FAISS.
        </p>
        {message && <p className="success-text">{message}</p>}
        {error && <p className="error-text">{error}</p>}
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "Processing..." : "Upload and Index"}
        </button>
      </form>
    </section>
  );
}

export default UploadPage;
