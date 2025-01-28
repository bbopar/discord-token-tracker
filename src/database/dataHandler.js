import { promises as fs } from 'fs';
import path from 'path';

class DataHandler {
  constructor() {
    this.data = {
      lastUpdate: null,
      tokens: {},
      sentRecommendations: {},
      lastPerformanceUpdates: {}
    };
    this.jobs = [];
    this.dataPath = path.join(process.cwd(), "data", "tokens.json");
  }

  async initialize() {
    try {
      const data = await this.readData();
      if (data) {
        this.data = data;
      }
    } catch (error) {
      console.error("Error initializing data handler:", error);
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
      const data = await fs.readFile(this.dataPath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Error reading data:", error);
      }
      return null;
    }
  }

  async saveData(newMessages) {
    const timestamp = new Date().toISOString();
    this.data.lastUpdate = timestamp;

    // Process new messages
    newMessages.forEach((msg) => {
      const { token, user, msgTimestamp } = msg;
      if (!token.tokenAddress) return;

      if (!this.data.tokens[token.tokenAddress]) {
        if (token.recommendationType !== "new_listing") {
          this.addMentionCheckJob(token.tokenAddress);
        }

        this.data.tokens[token.tokenAddress] = {
          name: token.name,
          ticker: token.ticker,
          chain: token.chain || "SOL",
          tokenAddress: token.tokenAddress,
          firstSeenAt: timestamp,
          pumpFunLink: token.pumpFunLink,
          msgTimestamp,
          scanRecommendation: {
            username: user.username,
            discordId: user.discordId,
            timestamp: timestamp,
          },
          updates: token.stats
            ? [
                {
                  timestamp: timestamp,
                  marketCap: token.stats.marketCap,
                  percentage: token.stats.percentage,
                  type: token.recommendationType || "new_listing",
                },
              ]
            : [],
          ...(token.recommendationType === "new_listing" && {
            firstMention: {
              username: user.username,
              discordId: user.discordId,
              timestamp: timestamp,
            },
          }),
        };
      }
    });

    const dataDir = path.dirname(this.dataPath);
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }

    await fs.writeFile(this.dataPath, JSON.stringify(this.data, null, 2));
    return this.data;
  }

  async updateTokenPerformance(tokenAddress, performanceData) {
    if (!tokenAddress || !performanceData) {
      throw new Error("Token address and performance data are required");
    }

    // Initialize token if it doesn't exist
    if (!this.data.tokens[tokenAddress]) {
      this.data.tokens[tokenAddress] = {
        tokenAddress,
        firstSeenAt: new Date().toISOString(),
        updates: [],
      };
    }

    // Update token performance metrics
    this.data.tokens[tokenAddress] = {
      ...this.data.tokens[tokenAddress],
      lastPerformanceUpdate: new Date().toISOString(),
      performance: {
        symbol: this.data.tokens[tokenAddress].ticker,
        ...performanceData,
      },
    };

    // Write updated data to file
    try {
      await fs.writeFile(this.dataPath, JSON.stringify(this.data, null, 2));
      return this.data.tokens[tokenAddress];
    } catch (error) {
      console.error("Error saving token performance data:", error);
      throw error;
    }
  }

  getTokenByAddress(tokenAddress) {
    return this.data.tokens[tokenAddress] || null;
  }

  getAllTokens() {
    return Object.values(this.data.tokens);
  }

  getTokensByUser(discordId) {
    return Object.values(this.data.tokens).filter((token) =>
      token.recommendedBy.some((rec) => rec.discordId === discordId)
    );
  }

  async getTokens(options = {}) {
    let tokens = Object.values(this.data.tokens);

    // Filter by chain if specified
    if (options.chain) {
      tokens = tokens.filter(token => token.chain === options.chain);
    }

    // Filter by address if specified
    if (options.address) {
      tokens = tokens.filter(token => token.tokenAddress === options.address);
    }

    // Filter by ticker if specified
    if (options.ticker) {
      tokens = tokens.filter(token => token.ticker === options.ticker);
    }

    // Filter by time range if specified
    if (options.startTime) {
      const startTimestamp = new Date(options.startTime).getTime();
      tokens = tokens.filter(token => new Date(token.firstSeenAt).getTime() >= startTimestamp);
    }

    if (options.endTime) {
      const endTimestamp = new Date(options.endTime).getTime();
      tokens = tokens.filter(token => new Date(token.firstSeenAt).getTime() <= endTimestamp);
    }

    // Sort if specified
    if (options.sortBy) {
      tokens.sort((a, b) => {
        switch (options.sortBy) {
          case 'firstSeenAt':
            return new Date(b.firstSeenAt) - new Date(a.firstSeenAt);
          case 'marketCap':
            return (b.performance?.mcap || 0) - (a.performance?.mcap || 0);
          case 'price':
            return (b.performance?.price || 0) - (a.performance?.price || 0);
          case 'volume':
            return (b.performance?.volume24h || 0) - (a.performance?.volume24h || 0);
          default:
            return 0;
        }
      });
    }

    // Apply limit if specified
    if (options.limit && options.limit > 0) {
      tokens = tokens.slice(0, options.limit);
    }

    return tokens;
  }

  markRecommendationSent(tokenAddress) {
    if (!this.data.sentRecommendations) {
      this.data.sentRecommendations = {};
    }
    this.data.sentRecommendations[tokenAddress] = new Date().toISOString();
  }

  isRecommendationSent(tokenAddress) {
    return Boolean(this.data.sentRecommendations?.[tokenAddress]);
  }

  shouldUpdatePerformance(tokenAddress) {
    if (!this.data.lastPerformanceUpdates) {
      this.data.lastPerformanceUpdates = {};
    }

    const lastUpdate = this.data.lastPerformanceUpdates[tokenAddress];
    if (!lastUpdate) {
      return true; // First update
    }

    // Check if 30 minutes have passed since last update
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    return new Date(lastUpdate) < thirtyMinutesAgo;
  }

  markPerformanceUpdated(tokenAddress) {
    if (!this.data.lastPerformanceUpdates) {
      this.data.lastPerformanceUpdates = {};
    }
    this.data.lastPerformanceUpdates[tokenAddress] = new Date().toISOString();
  }

  getUnsent() {
    return Object.values(this.data.tokens).filter(
      token => !this.isRecommendationSent(token.tokenAddress)
    );
  }

  getTokensNeedingPerformanceUpdate() {
    return Object.values(this.data.tokens).filter(token => 
      this.shouldUpdatePerformance(token.tokenAddress)
    );
  }
}

export { DataHandler };
