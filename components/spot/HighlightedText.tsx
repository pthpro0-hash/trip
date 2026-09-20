interface HighlightedTextProps {
  text: string;
  query?: string;
}

// Marks where the search terms actually appear, so a result doesn't look
// arbitrary. Each space-separated term is highlighted on its own — the search
// itself treats them separately, so "제주 해변" must light up both words rather
// than looking for that exact phrase. Matching is plain case-insensitive
// substring: it only has to agree with what the reader can see, not with the
// ranking rules in search.ts.
export function HighlightedText({ text, query }: HighlightedTextProps) {
  const terms = (query ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => term.toLowerCase());
  if (terms.length === 0) return <>{text}</>;

  const lowerText = text.toLowerCase();
  // Mark every character covered by any term, then read the runs back off.
  const covered = new Array<boolean>(text.length).fill(false);
  for (const term of terms) {
    let found = lowerText.indexOf(term);
    while (found !== -1) {
      for (let i = found; i < found + term.length; i += 1) covered[i] = true;
      found = lowerText.indexOf(term, found + term.length);
    }
  }

  const parts: { value: string; hit: boolean }[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const hit = covered[cursor];
    let end = cursor;
    while (end < text.length && covered[end] === hit) end += 1;
    parts.push({ value: text.slice(cursor, end), hit });
    cursor = end;
  }

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
