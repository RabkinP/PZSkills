export function parseItemsFile(text) {
  const items = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const start = lines[index].match(/^\s*item\s+([^\s{]+)\s*$/);
    if (!start) continue;

    const id = start[1];
    while (index + 1 < lines.length && !lines[index + 1].includes('{')) index += 1;
    if (index + 1 >= lines.length) throw new Error(`Item ${id} has no opening brace`);
    index += 1;

    const properties = {};
    for (index += 1; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (line === '}') break;
      if (!line || line.startsWith('//')) continue;

      const match = line.match(/^([^=]+?)\s*=\s*(.*?),?$/);
      if (!match) continue;
      properties[match[1].trim()] = match[2].trim();
    }

    items.push({ id, properties });
  }

  return items;
}
