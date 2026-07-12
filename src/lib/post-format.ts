export function normalizePostText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function truncateThreadsPost(text: string, appendText = "", maxLength = 450) {
  const trailingSpace = " ";
  let body = normalizePostText(text);
  const suffix = appendText.trim() ? `\n\n${appendText.trim()}` : "";
  const effectiveMax = maxLength - trailingSpace.length;

  if (body.length + suffix.length > effectiveMax) {
    const allowed = effectiveMax - suffix.length - 3;
    body = allowed > 0 ? `${body.slice(0, allowed)}...` : `${body.slice(0, effectiveMax - 3)}...`;
  }

  return `${body}${suffix}${trailingSpace}`;
}
