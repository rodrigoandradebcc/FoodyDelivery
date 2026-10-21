export function OrderListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="column-empty">
      <p>Não foi possível carregar.</p>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={onRetry}
      >
        Tentar de novo
      </button>
    </div>
  );
}
