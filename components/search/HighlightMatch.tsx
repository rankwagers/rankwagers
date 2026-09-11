/** Highlight the first case-insensitive occurrence of query in text. */
export function HighlightMatch({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const index = lower.indexOf(needle);
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark style={{ background: "transparent", color: "var(--accent)", fontWeight: 600 }}>
        {text.slice(index, index + q.length)}
      </mark>
      {text.slice(index + q.length)}
    </>
  );
}
