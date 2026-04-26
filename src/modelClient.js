function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function extractTextContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item?.type === "text") {
          return item.text || "";
        }

        return "";
      })
      .join("");
  }

  return "";
}

export async function callChatModel({ target, messages, temperature = 0.2 }) {
  const url = `${normalizeBaseUrl(target.baseUrl)}/chat/completions`;
  const body = {
    model: target.model,
    messages,
    temperature
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${target.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${target.providerLabel} API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const content = extractTextContent(result?.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error(`${target.providerLabel} returned an unexpected payload: ${JSON.stringify(result)}`);
  }

  return {
    raw: result,
    content
  };
}
