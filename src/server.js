const { DataHandler } = require("./cache/dataHandler.js");
const { isNewOrUpdatedToken } = require("./utils/isNewOrUpdatedToken.js");
const { isValidTokenData } = require("./utils/tokenDataValidation.js");
const { retrieveAndParseMessages } = require("./api/scraper-first-mention.js");
const { sendRecommendation } = require("./api/send-token-data.js");
const { updateTokenMention } = require("./api/mention-scraper.js");
const { updateTokenPerformance } = require("./api/get-token-performance.js");

const cron = require("node-cron");
const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3210;

// Initialize data handler
const dataHandler = new DataHandler();

// Store the last run status
let lastRunStatus = {
  timestamp: null,
  success: null,
  newMessagesCount: 0,
  error: null,
};

// Keep track of sent recommendations to avoid duplicates
let sentRecommendations = new Set();

// Initialize data handler when server starts
(async () => {
  await dataHandler.initialize();
  console.log("Data handler initialized");
})();


cron.schedule("*/2 * * * * *", async () => {
  console.log("Running Discord scraper...");
  try {
    // Retrieve and parse messages
    const messages = await retrieveAndParseMessages();
    const messagesToProcess = messages.filter((msg) =>
      isNewOrUpdatedToken(msg, dataHandler)
    );

    // Save new data if there are new messages or updates
    if (messagesToProcess.length > 0) {
      await dataHandler.saveData(messagesToProcess);
    }

    lastRunStatus = {
      timestamp: new Date(),
      success: true,
      newMessagesCount: messagesToProcess.length,
      error: null,
    };
    console.log(
      `Scraper run complete. Found ${messagesToProcess.length} new messages/updates.`
    );
  } catch (error) {
    lastRunStatus = {
      timestamp: new Date(),
      success: false,
      newMessagesCount: 0,
      error: error.message,
    };
    console.error("Scraper error:", error);
  }
});

// First mention and initial performance update (every 15 seconds)
cron.schedule("*/15 * * * * *", async () => {
    console.log("Checking for token mentions...");
    try {
      // Handle first mention update
      const tokenAddress = dataHandler.getNextJob();
      if (tokenAddress) {
        await updateTokenMention(dataHandler, tokenAddress);
      }
  
      // Handle initial performance update for new tokens
      const tokens = await dataHandler.getTokens();
      if (tokens) {
        for (const token of tokens) {
          if (!token.performance && dataHandler.shouldUpdatePerformance(token.tokenAddress)) {
            await updateTokenPerformance(
              dataHandler,
              token.tokenAddress,
              process.env.BIRDEYE_API_KEY
            );
            dataHandler.markPerformanceUpdated(token.tokenAddress);
          }
        }
      }
    } catch (error) {
      console.error("Error in mention check cron:", error);
    }
  });
  
  // Regular performance updates (every 30 minutes)
  cron.schedule("*/30 * * * *", async () => {
    console.log("Running scheduled performance updates...");
    try {
      const tokensToUpdate = dataHandler.getTokensNeedingPerformanceUpdate();
      for (const token of tokensToUpdate) {
        await updateTokenPerformance(
          dataHandler,
          token.tokenAddress,
          process.env.BIRDEYE_API_KEY
        );
        dataHandler.markPerformanceUpdated(token.tokenAddress);
      }
    } catch (error) {
      console.error("Error updating token performance:", error);
    }
  });
  
  // Process and send recommendations (every 6 minutes)
  cron.schedule("*/360 * * * * *", async () => {
    console.log("Processing recommendations...");
    try {
      const unsentTokens = dataHandler.getUnsent()
        .filter(token => token.firstMention && token.performance)
        .map(token => ({
          user: {
            username: token.firstMention.username,
            discordId: token.firstMention.discordId,
            timestamp: token.firstMention.timestamp,
          },
          token: {
            name: token.name,
            ticker: token.ticker,
            chain: token.chain,
            tokenAddress: token.tokenAddress,
            pumpFunLink: token.pumpFunLink,
            marketCap: token.updates[0]?.marketCap,
            percentage: token.updates[0]?.percentage,
            recommendationType: token.updates[0]?.type,
            timestamp: token.firstMention.timestamp,
          },
          performance: token.performance,
        }));
  
      for (const tokenData of unsentTokens) {
        if (isValidTokenData(tokenData)) {
          try {
            const agentId = process.env.AGENT_ID;
            const success = await sendRecommendation(agentId, tokenData);

            console.log("SUCCESS", success);
            
            // Only mark as sent if sendRecommendation was successful
            if (success) {
              dataHandler.markRecommendationSent(tokenData.token.tokenAddress);
            } else {
              console.log(`Failed to send recommendation for token ${tokenData.token.tokenAddress}`);
            }
          } catch (sendError) {
            console.error(`Error sending recommendation for token ${tokenData.token.tokenAddress}:`, sendError);
            // Don't mark as sent if there was an error
            continue;
          }
        }
      }
    } catch (error) {
      console.error("Error processing recommendations:", error);
    }
  });

// Status endpoint
app.get("/status", (req, res) => {
  res.json({
    status: "running",
    lastRun: lastRunStatus,
    recommendationsSent: sentRecommendations.size,
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Performing graceful shutdown...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT. Performing graceful shutdown...");
  process.exit(0);
});
