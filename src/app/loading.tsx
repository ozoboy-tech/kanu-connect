export default function Loading() {
  return <main><div className="loading-panel" role="status" aria-live="polite">
    <p>Chargement de Kanu…</p><div aria-hidden="true">
      <div className="loading-line short" /><div className="loading-line" /><div className="loading-line" />
    </div>
  </div></main>;
}
