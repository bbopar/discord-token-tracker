const fs = require('fs').promises;
const path = require('path');

class DataHandler {
  constructor() {
    this.data = {
      lastUpdate: null,
      tokens: {},
    };
    this.jobs = [];
    this.dataPath = path.join(process.cwd(), 'data', 'tokens.json');
  }

  async initialize() {
    try {
      const data = await this.readData();
      if (data) {
        this.data = data;
      }
    } catch (error) {
      console.error('Error initializing data handler:', error);
    }
  }

  addMentionCheckJob(tokenAddress) {
    if (!this.jobs.includes(tokenAddress)) {
      this.jobs.push(tokenAddress);
    }
  }

  getNextJob() {
    return this.jobs.shift();
  }

  async readData() {
    try {
      const data = await fs.readFile(this.dataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error reading data:', error);
      }
      return null;
    }
  }

  async saveData(newMessages) {
    const timestamp = new Date().toISOString();
    this.data.lastUpdate = timestamp;

    // Process new messages
    newMessages.forEach(msg => {
      const { token, user, msgTimestamp } = msg;
      if (!token.tokenAddress) return;

      if (!this.data.tokens[token.tokenAddress]) {
        if (token.recommendationType !== 'new_listing') {
          this.addMentionCheckJob(token.tokenAddress);
        }

        this.data.tokens[token.tokenAddress] = {
          name: token.name,
          ticker: token.ticker,
          chain: token.chain || 'SOL',
          tokenAddress: token.tokenAddress,
          firstSeenAt: timestamp,
          pumpFunLink: token.pumpFunLink,
          msgTimestamp,
          scanRecommendation: {
            username: user.username,
            discordId: user.discordId,
            timestamp: timestamp
          },
          updates: token.stats ? [{
            timestamp: timestamp,
            marketCap: token.stats.marketCap,
            percentage: token.stats.percentage,
            type: token.recommendationType || 'new_listing'
          }] : [],
          ...(token.recommendationType === 'new_listing' && {
            firstMention: {
              username: user.username,
              discordId: user.discordId,
              timestamp: timestamp
            }
          })
        };
      }
    });

    const dataDir = path.dirname(this.dataPath);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }

    await fs.writeFile(this.dataPath, JSON.stringify(this.data, null, 2));
    return this.data;
  }

  getTokenByAddress(tokenAddress) {
    return this.data.tokens[tokenAddress] || null;
  }

  getAllTokens() {
    return Object.values(this.data.tokens);
  }

  getTokensByUser(discordId) {
    return Object.values(this.data.tokens).filter(token =>
      token.recommendedBy.some(rec => rec.discordId === discordId)
    );
  }
}

module.exports = { DataHandler };
