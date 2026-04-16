// Helpers om tool-output consistent te formatteren.

export function textContent(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function jsonContent(value: unknown, preamble?: string) {
  const json = JSON.stringify(value, null, 2);
  const text = preamble ? `${preamble}\n\n${json}` : json;
  return { content: [{ type: "text" as const, text }] };
}

export function errorContent(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
