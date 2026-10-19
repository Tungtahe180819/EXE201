export default function EventPagination({ currentPage, totalItems, pageSize = 9, onPageChange }) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const buttonClass = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold transition hover:border-indigo-500 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:text-indigo-300';

  return (
    <nav aria-label="Phân trang sự kiện" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        className={buttonClass}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Trước
      </button>
      {pages.map(page => (
        <button
          key={page}
          type="button"
          aria-label={`Trang ${page}`}
          aria-current={page === currentPage ? 'page' : undefined}
          className={`${buttonClass} ${page === currentPage ? 'border-indigo-600 bg-indigo-600 text-white hover:text-white dark:border-indigo-500 dark:bg-indigo-600' : ''}`}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        className={buttonClass}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Tiếp
      </button>
      <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">Trang {currentPage}/{totalPages}</span>
    </nav>
  );
}
