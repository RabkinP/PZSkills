function findRecordEnd(text, openingBraceIndex, guid) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;

  for (let index = openingBraceIndex; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '-' && next === '-') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
      if (depth < 0) break;
    }
  }

  throw new Error(`Recorded-media entry '${guid}' has an unterminated table`);
}

export function parseRecordedMedia(text) {
  const records = [];
  const declarationStarts = [...text.matchAll(/\bRecMedia\s*\[/g)].length;
  const declarationPattern = /RecMedia\["([^"]+)"\]\s*=\s*\{/g;
  const declarations = [...text.matchAll(declarationPattern)];
  if (declarations.length !== declarationStarts) {
    throw new Error(`Recorded-media parser found ${declarationStarts} RecMedia declarations but recognized ${declarations.length}; declaration syntax may have changed`);
  }

  for (const match of declarations) {
    const guid = match[1];
    const openingBraceIndex = match.index + match[0].lastIndexOf('{');
    const closingBraceIndex = findRecordEnd(text, openingBraceIndex, guid);
    const body = text.slice(openingBraceIndex + 1, closingBraceIndex);

    const getString = (key) => body.match(new RegExp(`\\b${key}\\s*=\\s*"([^"]+)"`))?.[1] ?? null;
    const getNumber = (key) => {
      const value = body.match(new RegExp(`\\b${key}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`))?.[1];
      return value == null ? null : Number(value);
    };

    const codes = [...body.matchAll(/\bcodes\s*=\s*"([^"]+)"/g)]
      .flatMap((codeMatch) => codeMatch[1].split(',').map((value) => value.trim()).filter(Boolean));

    records.push({
      guid,
      itemDisplayNameKey: getString('itemDisplayName'),
      titleKey: getString('title'),
      category: getString('category'),
      spawning: getNumber('spawning'),
      codes
    });
  }

  if (records.length !== declarations.length) {
    throw new Error(`Recorded-media parser invariant failed: saw ${declarations.length} declarations but parsed ${records.length} records`);
  }

  return records;
}
