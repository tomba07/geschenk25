export function getInitials(value: string, maxLength = 3) {
  const words = value
    .trim()
    .split(/\s+/)
    .map((word) => word.match(/[A-Za-z0-9]/)?.[0])
    .filter((letter): letter is string => Boolean(letter));

  if (words.length > 0) {
    return words.slice(0, maxLength).join('').toUpperCase();
  }

  const fallback = value.match(/[A-Za-z0-9]/)?.[0];
  return fallback ? fallback.toUpperCase() : 'G';
}
