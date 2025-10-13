const normalizeSegment = (segment?: string | null): string | undefined => {
  if (!segment) return undefined;
  const trimmed = segment.trim();
  if (!trimmed) return undefined;
  return trimmed.normalize('NFC').toLowerCase();
};

export interface UrnInput {
  platform?: string | null;
  region?: string | null;
  systemId?: string | null;
  database?: string | null;
  schema?: string | null;
  object?: string | null;
  column?: string | null;
}

export const buildDataUrn = (input: UrnInput): string => {
  const platform = normalizeSegment(input.platform) ?? 'unknown';
  const region = normalizeSegment(input.region);
  const systemId = normalizeSegment(input.systemId) ?? 'default';
  const database = normalizeSegment(input.database);
  const schema = normalizeSegment(input.schema);
  const object = normalizeSegment(input.object);
  const column = normalizeSegment(input.column);

  const segments = ['urn', 'data', platform];
  if (region) segments.push(region);
  segments.push(systemId);
  if (database) segments.push(database);
  if (schema) segments.push(schema);
  if (object) segments.push(object);
  if (column) segments.push(column);
  return segments.join(':');
};
