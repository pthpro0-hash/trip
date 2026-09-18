interface HighlightedTextProps {
  text: string;
  query?: string;
}

// Marks where the search term actually appears, so a result doesn't look
// arbitrary. Matching here is plain case-insensitive substring — it only has to
// agree with what the reader can see, not with the ranking rules in search.ts.
export function HighlightedText({ text, query }: HighlightedTextProps) {
  const term = query?.trim();
  if (!term) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const parts: { value: string; hit: boolean }[] = [];

  let cursor = 0;
  let found = lowerText.indexOf(lowerTerm);
  while (found !== -1) {
    if (found > cursor) parts.push({ value: text.slice(cursor, found), hit: false });
    parts.push({ value: text.slice(found, found + term.length), hit: true });
    cursor = found + term.length;
    found = lowerText.indexOf(lowerTerm, cursor);
  }
  if (cursor < text.length) parts.push({ value: text.slice(cursor), hit: false });

  return (
    <>
      {parts.map((part, index) =>
        part.hit ? (
          <mark key={index} className="rounded bg-accent-soft px-0.5 text-accent">
            {part.value}
          </mark>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  );
}
