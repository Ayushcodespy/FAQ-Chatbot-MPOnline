import { useEffect, useState } from "react";
import { api } from "../services/api";

function UploadPage() {
  const [files, setFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadDocuments = async () => {
    try {
      const { data } = await api.get("/documents");
      setDocuments(data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load uploaded files.");
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (files.length === 0) return;

    setError("");
    setMessage("");
    setLoading(true);
    try {
      for (const item of files) {
        const formData = new FormData();
        formData.append("title", item.title.trim() || item.file.name);
        formData.append("file", item.file);
        await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      setMessage(`${files.length} file${files.length > 1 ? "s" : ""} indexed successfully.`);
      setFiles([]);
      event.target.reset();
      await loadDocuments();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const removeDocument = async (documentId) => {
    setDeletingId(documentId);
    setError("");
    setMessage("");
    try {
      await api.delete(`/documents/${documentId}`);
      setMessage("Selected document removed successfully.");
      await loadDocuments();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to remove the selected document.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Document Ingestion</p>
          <h2>Manage the live document library for the chatbot</h2>
        </div>
      </div>

      <div className="upload-admin-grid">
        <form className="card form-grid upload-form-card" onSubmit={handleUpload}>
          <div>
            <p className="eyebrow">Add Files</p>
            <h3>Upload one or many files</h3>
          </div>
          <input
            accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
            multiple
            onChange={(event) =>
              setFiles(
                Array.from(event.target.files || []).map((file, index) => ({
                  id: `${file.name}-${index}`,
                  file,
                  title: file.name.replace(/\.[^/.]+$/, ""),
                }))
              )
            }
            type="file"
            required={files.length === 0}
          />
          <p className="muted">
            OCR is applied through Tesseract, then text is chunked, embedded, and used by the chatbot for grounded answers.
          </p>
          {files.length > 0 && (
            <div className="upload-queue">
              {files.map((item) => (
                <div className="upload-queue-item" key={item.id}>
                  <div>
                    <strong>{item.file.name}</strong>
                    <small>{Math.ceil(item.file.size / 1024)} KB</small>
                  </div>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(event) =>
                      setFiles((current) =>
                        current.map((entry) =>
                          entry.id === item.id ? { ...entry, title: event.target.value } : entry
                        )
                      )
                    }
                    placeholder="Document title"
                  />
                </div>
              ))}
            </div>
          )}
          {message && <p className="success-text">{message}</p>}
          {error && <p className="error-text">{error}</p>}
          <button className="primary-button" disabled={loading || files.length === 0} type="submit">
            {loading ? "Processing..." : "Upload and Index"}
          </button>
        </form>

        <div className="card form-grid upload-library-card">
          <div className="page-header">
            <div>
              <p className="eyebrow">Uploaded Files</p>
              <h3>Current knowledge base</h3>
            </div>
            <div className="summary-pill subtle">
              <strong>{documents.length}</strong>
              <span>Active docs</span>
            </div>
          </div>
          <div className="list">
            {documents.length === 0 && (
              <div className="status-box">
                <p>No files uploaded yet.</p>
              </div>
            )}
            {documents.map((item) => (
              <div className="list-item document-list-item" key={item.id}>
                <div className="document-list-head">
                  <div>
                    <strong>{item.title}</strong>
                    <p className="muted">{item.filename}</p>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={deletingId === item.id}
                    onClick={() => removeDocument(item.id)}
                    type="button"
                  >
                    {deletingId === item.id ? "Removing..." : "Remove"}
                  </button>
                </div>
                <div className="document-list-meta">
                  <small>{item.chunk_count} chunks indexed</small>
                  <small>{new Date(item.created_at).toLocaleString()}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default UploadPage;
