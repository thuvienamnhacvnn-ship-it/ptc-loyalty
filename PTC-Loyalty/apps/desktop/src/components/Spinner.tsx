export function Spinner() {
  return <span className="spinner" aria-label="loading" />;
}

export function FullLoader({ label }: { label?: string }) {
  return (
    <div className="center">
      <div className="state">
        <Spinner />
        {label && <p className="muted">{label}</p>}
      </div>
    </div>
  );
}
