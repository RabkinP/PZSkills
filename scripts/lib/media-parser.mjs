export function parseRecordedMedia(text) {
  const records = [];
  const recordPattern = /RecMedia\["([^"]+)"\]\s*=\s*\{(.*?)\n\};/gs;

  for (const match of text.matchAll(recordPattern)) {
    const [, guid, body] = match;
    const getString = (key) => body.match(new RegExp(`\\b${key}\\s*=\\s*"([^"]+)"`))?.[1] ?? null;
    const getNumber = (key) => {
      const value = body.match(new RegExp(`\\b${key}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`))?.[1];
      return value == null ? null : Number(value);
    };

    const codes = [...body.matchAll(/codes\s*=\s*"([^"]+)"/g)]
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

  return records;
}
