export function newTraceId(): string {
  return crypto.randomUUID()
}
