export function applyFilters(panel, query, hideFound, found) {
  if (!panel) return;
  const normalizedQuery = (query || '').trim().toLowerCase();

  panel.querySelectorAll('.group').forEach((group) => {
    let anyVisible = false;

    group.querySelectorAll('.item').forEach((row) => {
      const itemKey = row.dataset.key;
      const matchesSearch = !normalizedQuery || row.dataset.search.includes(normalizedQuery);
      const isFound = Boolean(itemKey && found[itemKey]);
      const visible = matchesSearch && !(hideFound && isFound);
      row.style.display = visible ? '' : 'none';
      if (visible) anyVisible = true;
    });

    group.style.display = anyVisible ? '' : 'none';
    if (normalizedQuery && anyVisible) group.open = true;
  });
}
