// Rows that scroll sideways on phones (the library filters).
// The scrollbar is hidden, so fade whichever side has more to show, and bring
// the current tab or chosen filter into view on load.

const EDGE = 4;

function mark(row: HTMLElement) {
  const left = row.scrollLeft > EDGE;
  const right = row.scrollLeft + row.clientWidth < row.scrollWidth - EDGE;
  const more = left && right ? "both" : left ? "left" : right ? "right" : "";
  if (more) row.dataset.more = more;
  else delete row.dataset.more;
}

function reveal(row: HTMLElement) {
  const current = row.querySelector<HTMLElement>('[aria-current], [aria-pressed="true"]');
  if (!current || row.scrollWidth <= row.clientWidth) return;
  const start = current.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
  const end = start + current.offsetWidth;
  if (start < row.scrollLeft || end > row.scrollLeft + row.clientWidth) {
    row.scrollLeft = Math.max(0, start - (row.clientWidth - current.offsetWidth) / 2);
  }
}

const rows = [...document.querySelectorAll<HTMLElement>(".scrollrow")];
for (const row of rows) {
  reveal(row);
  mark(row);
  row.addEventListener("scroll", () => mark(row), { passive: true });
}
if (rows.length > 0) {
  let frame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => rows.forEach(mark));
  });
}
