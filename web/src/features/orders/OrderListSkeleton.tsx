export function OrderListSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton-card" />
      ))}
    </>
  );
}
