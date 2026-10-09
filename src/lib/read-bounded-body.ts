export async function readBoundedBody(request: Request, limit: number): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('Request body is too large.');
      chunks.push(value);
    }
  } catch (error) {await reader.cancel().catch(() => {});throw error;}
  const bytes = new Uint8Array(size);let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset);offset += chunk.byteLength;}
  return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
}
