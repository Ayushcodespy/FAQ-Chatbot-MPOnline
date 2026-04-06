function GrievanceThread({
  grievance,
  draftValue,
  isSubmitting,
  onDraftChange,
  onSubmit,
  placeholder = "Add a comment",
}) {
  return (
    <div className="grievance-thread-shell">
      <div className="grievance-comment-stream">
        {grievance.comments?.length ? (
          grievance.comments.map((comment) => (
            <div className="grievance-comment" key={comment.id}>
              <div className="grievance-comment-head">
                <div className="grievance-comment-author">
                  <strong>{comment.username || "System"}</strong>
                  <span
                    className={
                      comment.comment_type === "status_update"
                        ? "comment-pill status-update"
                        : "comment-pill"
                    }
                  >
                    {comment.comment_type === "status_update"
                      ? "Status update"
                      : comment.role || "comment"}
                  </span>
                </div>
                <small>{new Date(comment.created_at).toLocaleString()}</small>
              </div>
              <p>{comment.message}</p>
            </div>
          ))
        ) : (
          <div className="empty-comment-state">
            <small>No updates yet. Start the conversation here.</small>
          </div>
        )}
      </div>

      <form
        className="grievance-comment-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <textarea
          rows={3}
          placeholder={placeholder}
          value={draftValue}
          onChange={(event) => onDraftChange(event.target.value)}
        />
        <div className="grievance-comment-actions">
          <button className="secondary-button" disabled={isSubmitting || !draftValue.trim()} type="submit">
            {isSubmitting ? "Posting..." : "Post reply"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default GrievanceThread;
