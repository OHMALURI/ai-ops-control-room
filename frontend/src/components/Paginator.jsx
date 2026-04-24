const PAGE_SIZES = [10, 25, 50, 100];

export default function Paginator({ page, pageSize, total, totalPages, onPage, onPageSize }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  function pages() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "…", totalPages];
    if (page >= totalPages - 3) return [1, "…", totalPages-4, totalPages-3, totalPages-2, totalPages-1, totalPages];
    return [1, "…", page - 1, page, page + 1, "…", totalPages];
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-800 text-xs text-gray-400">

      {/* left: count + page size */}
      <div className="flex items-center gap-3">
        <span>{total === 0 ? "No entries" : `${from}–${to} of ${total.toLocaleString()}`}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-600">Per page:</span>
          <select
            value={pageSize}
            onChange={e => onPageSize(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 text-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* right: page buttons */}
      <div className="flex items-center gap-1">
        <PageBtn disabled={page === 1} onClick={() => onPage(page - 1)}>‹</PageBtn>
        {pages().map((p, i) =>
          p === "…"
            ? <span key={`ellipsis-${i}`} className="px-2 text-gray-600">…</span>
            : <PageBtn key={p} active={p === page} onClick={() => onPage(p)}>{p}</PageBtn>
        )}
        <PageBtn disabled={page === totalPages} onClick={() => onPage(page + 1)}>›</PageBtn>
      </div>
    </div>
  );
}

function PageBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-w-[28px] h-7 px-1.5 rounded-md text-xs font-medium transition-colors
        ${active
          ? "bg-indigo-600 text-white"
          : disabled
          ? "text-gray-700 cursor-not-allowed"
          : "text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        }`}
    >
      {children}
    </button>
  );
}
