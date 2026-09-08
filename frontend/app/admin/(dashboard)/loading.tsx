export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-[1500px]" aria-busy="true" aria-label="Loading admin data">
      <div className="animate-pulse border-b border-ink/10 pb-9">
        <div className="h-3 w-28 bg-ink/10" />
        <div className="mt-5 h-14 max-w-lg bg-ink/10" />
        <div className="mt-5 h-4 max-w-sm bg-ink/10" />
      </div>
      <div className="mt-8 grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-40 border border-ink/10 bg-paper" />
        ))}
      </div>
      <div className="mt-10 h-80 animate-pulse border border-ink/10 bg-paper" />
    </div>
  );
}
