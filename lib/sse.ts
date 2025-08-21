export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export function createSSEMessage(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function createSSEEnd(): string {
  return 'data: [DONE]\n\n';
}
