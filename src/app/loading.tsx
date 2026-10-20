export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading page" className="page-loading">
      <span className="page-loading-status" role="status">Loading page</span>
      <div aria-hidden="true" className="page-loading-content">
        <div className="page-loading-heading" />
        <div className="page-loading-copy" />
        <div className="page-loading-grid">
          <div />
          <div />
          <div />
        </div>
      </div>
    </main>
  );
}
