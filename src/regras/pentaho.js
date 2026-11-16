export function linhasCda(json) {
  const cols = (json?.metadata || []).map((m) => m.colName);
  return (json?.resultset || []).map((linha) => Object.fromEntries(cols.map((c, i) => [c, linha[i]])));
}
