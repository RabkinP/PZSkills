export function filterItems(items, filters, found, language, searchTextForItem) {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    const isFound = Boolean(found[item.key]);
    if (filters.category !== 'all' && item.categoryId !== filters.category) return false;
    if (filters.status === 'found' && !isFound) return false;
    if (filters.status === 'missing' && isFound) return false;
    if (filters.skills.size && !item.skills.some((skill) => filters.skills.has(skill))) return false;
    if (filters.effects.size && !item.effectTypes.some((effect) => filters.effects.has(effect))) return false;
    if (query && !searchTextForItem(item, language).includes(query)) return false;
    return true;
  });
}

export function sortItems(items, sort, found, localizedName) {
  return [...items].sort((a, b) => {
    const af = Boolean(found[a.key]);
    const bf = Boolean(found[b.key]);
    if (sort === 'missingFirst' && af !== bf) return af ? 1 : -1;
    if (sort === 'foundFirst' && af !== bf) return af ? -1 : 1;
    if (sort === 'id') return a.id.localeCompare(b.id, undefined, { numeric: true });
    const cmp = localizedName(a).localeCompare(localizedName(b), undefined, { numeric: true, sensitivity: 'base' });
    return sort === 'nameDesc' ? -cmp : cmp;
  });
}
