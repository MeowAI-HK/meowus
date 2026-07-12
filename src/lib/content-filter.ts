export type ContentFilter = {
  query?: string;
  from?: number;
  to?: number;
  page: number;
  pageSize: number;
};

export const MAX_CONTENT_PAGE_SIZE = 20;

function parseTimestamp(value: string | null) {
  if (!value) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

export function parseContentFilter(url: string): ContentFilter {
  const params = new URL(url).searchParams;
  const query = params.get("q")?.trim() || undefined;
  const from = parseTimestamp(params.get("from"));
  const to = parseTimestamp(params.get("to"));
  const page = parsePositiveInteger(params.get("page"), 1);
  const pageSize = Math.min(
    parsePositiveInteger(params.get("pageSize"), MAX_CONTENT_PAGE_SIZE),
    MAX_CONTENT_PAGE_SIZE,
  );
  return {
    query,
    from,
    to,
    page,
    pageSize,
  };
}
