export const singularToPlural = (word: string): string => {
  if (!word) return word;

  const lower = word.toLowerCase();

  // Words ending in 'y' preceded by a consonant → 'ies'
  if (lower.endsWith("y") && !/[aeiou]y$/.test(lower)) {
    return word.slice(0, -1) + "ies";
  }

  // Words ending in s, x, z, ch, sh → add 'es'
  if (/(s|x|z|ch|sh)$/.test(lower)) {
    return word + "es";
  }

  // Default: just add 's'
  return word + "s";
};
