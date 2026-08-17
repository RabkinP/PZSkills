function stripLineComment(line) {
  const commentIndex = line.indexOf('//');
  return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
}

export function parseItemsFile(text) {
  const items = [];
  const lines = text.split(/\r?\n/);
  let declarationsSeen = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (!/^\s*item\b/.test(rawLine)) continue;
    declarationsSeen += 1;

    const declaration = stripLineComment(rawLine).trim();
    const start = declaration.match(/^item\s+([^\s{]+)\s*(\{)?\s*$/);
    if (!start) {
      throw new Error(`Malformed item declaration at line ${index + 1}: ${rawLine.trim()}`);
    }

    const id = start[1];
    let hasOpeningBrace = Boolean(start[2]);
    while (!hasOpeningBrace && index + 1 < lines.length) {
      index += 1;
      const candidate = stripLineComment(lines[index]).trim();
      if (!candidate) continue;
      if (candidate === '{') {
        hasOpeningBrace = true;
        break;
      }
      throw new Error(`Unexpected content before opening brace for item '${id}' at line ${index + 1}: ${lines[index].trim()}`);
    }
    if (!hasOpeningBrace) throw new Error(`Item '${id}' has no opening brace`);

    const properties = {};
    let closed = false;
    for (index += 1; index < lines.length; index += 1) {
      const line = stripLineComment(lines[index]).trim();
      if (!line) continue;
      if (line === '}') {
        closed = true;
        break;
      }

      const match = line.match(/^([^=]+?)\s*=\s*(.*?),?$/);
      if (!match) continue;
      properties[match[1].trim()] = match[2].trim();
    }

    if (!closed) throw new Error(`Item '${id}' has no closing brace`);
    items.push({ id, properties });
  }

  if (items.length !== declarationsSeen) {
    throw new Error(`Item parser invariant failed: saw ${declarationsSeen} declarations but parsed ${items.length} items`);
  }

  return items;
}
