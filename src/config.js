const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

function optional(name, fallback) {
  return process.env[name] || fallback;
}

module.exports = {
  admin: {
    username: required('ADMIN_USERNAME'),
    password: required('ADMIN_PASSWORD'),
    loginUrl: optional('ADMIN_LOGIN_URL', 'https://www.colourdiam.com/adminlogin'),
    dashboardUrl: optional('ADMIN_DASHBOARD_URL', 'https://www.colourdiam.com/Admin/Dashboard'),
    blogUrl: optional('ADMIN_BLOG_URL', 'https://www.colourdiam.com/Admin/Blog'),
  },
  contentMode: optional('CONTENT_MODE', 'llm'),
  rssFeedUrl: process.env.RSS_FEED_URL,
  llm: {
    baseUrl: optional('USER_LLM_BASE_URL', 'https://api.openai.com/v1'),
    apiKey: process.env.USER_LLM_API_KEY,
    model: optional('USER_LLM_MODEL', 'gpt-4o-mini'),
    temperature: Number(optional('LLM_TEMPERATURE', '0.7')),
  },
  articlesPerRun: Number(optional('ARTICLES_PER_RUN', '1')),
  topicPool: (process.env.TOPIC_POOL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  autoUpload: (optional('AUTO_UPLOAD', 'false')).toLowerCase() === 'true',
  schedule: optional('UPLOAD_SCHEDULE', '0 * * * *'),
  runOnce: (optional('RUN_ONCE', 'false')).toLowerCase() === 'true',
  headless: (optional('HEADLESS', 'true')).toLowerCase() !== 'false',
};
