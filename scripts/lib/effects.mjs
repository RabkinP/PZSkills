import { SKILL_CODES, STATUS_CODES } from '../config.mjs';

export function parseMediaCode(code) {
  if (code.startsWith('RCP=')) {
    return { type: 'recipe', recipe: code.slice(4) };
  }

  const match = code.match(/^([A-Z]{3})([+-])(\d+(?:\.\d+)?)$/);
  if (!match) return { type: 'unknown', code };

  const [, prefix, sign, rawAmount] = match;
  const amount = Number(rawAmount) * (sign === '-' ? -1 : 1);

  if (SKILL_CODES[prefix]) return { type: 'skillXp', skill: SKILL_CODES[prefix], amount };
  if (STATUS_CODES[prefix]) return { type: 'status', status: STATUS_CODES[prefix], amount };
  return { type: 'unknown', code };
}

export function dedupeEffects(effects) {
  const seen = new Set();
  return effects.filter((effect) => {
    const key = JSON.stringify(effect);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
