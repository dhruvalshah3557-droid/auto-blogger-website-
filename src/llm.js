const config = require('./config');

async function chatCompletion({ system, user, temperature = 0.7, maxTokens = 6000 }) {
  const { baseUrl, apiKey, model } = config.llm;
  if (!apiKey) {
    throw new Error('USER_LLM_API_KEY is not set. Add it to .env (your own key for a free-tier provider).');
  }
  const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  return content;
}

module.exports = { chatCompletion };
