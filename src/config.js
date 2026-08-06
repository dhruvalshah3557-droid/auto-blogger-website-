const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

module.exports = {
  admin: {
    username: required('ADMIN_USERNAME'),
    password: required('ADMIN_PASSWORD'),
    loginUrl: process.env.ADMIN_LOGIN_URL || 'https://www.colourdiam.com/adminlogin',
    dashboardUrl: process.env.ADMIN_DASHBOARD_URL || 'https://www.colourdiam.com/Admin/Dashboard',
    blogUrl: process.env.ADMIN_BLOG_URL || 'https://www.colourdiam.com/Admin/Blog',
  },
  rssFeedUrl: required('RSS_FEED_URL'),
  schedule: process.env.UPLOAD_SCHEDULE || '0 * * * *',
  runOnce: (process.env.RUN_ONCE || 'false').toLowerCase() === 'true',
  headless: (process.env.HEADLESS || 'true').toLowerCase() !== 'false',
};
