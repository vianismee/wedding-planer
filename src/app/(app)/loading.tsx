export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Memuat">
      <div className="h-9 w-64 rounded-xl bg-surface" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-[22px] bg-surface" />
        <div className="h-28 rounded-[22px] bg-surface" />
        <div className="h-28 rounded-[22px] bg-surface" />
      </div>
      <div className="h-80 rounded-[22px] bg-surface" />
    </div>
  );
}
