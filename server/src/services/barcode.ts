export function makeBarCodeString(): string {
  const part = () =>
    Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
  return `BC-${part()}-${part()}`;
}
