export function CatalogStatus({ message }: { message: string }) {
  return (
    <div className="sb-prototype-banner" role="status">
      {message}
    </div>
  );
}

export function CatalogUnavailable() {
  return (
    <div className="sb-empty-page" role="status">
      <h2>The live catalog is not available yet.</h2>
      <p>
        Apply the Sachin Brands catalog migration in Supabase and publish
        products before they appear here. No sample products are shown as live
        inventory.
      </p>
    </div>
  );
}
