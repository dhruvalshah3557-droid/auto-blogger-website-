const Parser = require('rss-parser');

const parser = new Parser();

async function fetchPosts(feedUrl) {
  const feed = await parser.parseURL(feedUrl);
  const posts = (feed.items || []).map((item) => ({
    title: (item.title || '').trim(),
    link: item.link || '',
    content: item['content:encoded'] || item.content || item.contentSnippet || '',
    description: item.summary || item.description || item.contentSnippet || '',
    pubDate: item.isoDate || item.pubDate || '',
    categories: item.categories || [],
    guid: item.guid || item.link || item.title,
  }));
  return { feedTitle: feed.title || '', posts };
}

module.exports = { fetchPosts };
