const config = require('./config');
const { loadRegisterTitles } = require('./register');

const DEFAULT_TOPICS = [
  'Red diamonds',
  'Violet diamonds',
  'Grey diamonds',
  'Black diamonds',
  'Champagne and brown diamonds',
  'Natural orange diamonds',
  'Natural green diamonds',
  'Natural blue diamonds',
  'Natural pink diamonds',
  'Diamond fluorescence explained',
  'GIA certification for fancy colour diamonds',
  'Fancy colour diamond grading',
  'Diamond clarity in coloured diamonds',
  'Engagement rings with coloured diamonds',
  'Wedding jewellery with coloured diamonds',
  'Diamond earrings and pendants',
  'Diamond jewellery styling',
  'Choosing metal settings for coloured diamonds',
  'Diamond care, cleaning and storage',
  'Buying diamonds online safely',
  'Custom jewellery design',
  'Ethical sourcing of diamonds',
  'Coloured diamond investment education',
  'Diamond buying mistakes',
  'Comparing diamond colours',
];

async function selectTopic(existingTitles) {
  const configured = config.topicPool;
  const pool = configured.length ? configured : DEFAULT_TOPICS;

  for (const topic of pool) {
    if (!existingTitles.some((t) => t.toLowerCase().includes(topic.toLowerCase().split(' ')[0]))) {
      return topic;
    }
  }
  throw new Error('No fresh topic available in the topic pool. Add topics via TOPIC_POOL in .env.');
}

async function nextTopic() {
  const existingTitles = await loadRegisterTitles();
  return selectTopic(existingTitles);
}

module.exports = { DEFAULT_TOPICS, nextTopic };
