type Props = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onLoadMore: () => void;
};

export function LoadMoreFooter({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  onLoadMore,
}: Props) {
  return (
    <>
      {isFetchNextPageError && (
        <p className="column-page-error">Não foi possível carregar mais pedidos.</p>
      )}
      {hasNextPage && (
        <button
          type="button"
          className="btn btn-sm btn-ghost column-load-more"
          disabled={isFetchingNextPage}
          onClick={onLoadMore}
        >
          {isFetchingNextPage ? "Carregando…" : "Carregar mais"}
        </button>
      )}
    </>
  );
}
