require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const { retrieveAndParseMessages } = require("./scraper-first-mention.js");
const { updateTokenMention } = require("./mention-scraper.js");
const { DataHandler } = require("./cache/dataHandler.js");
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

// Function to send recommendations to the API
async function sendRecommendations(agentId, recommendations) {
  try {
    console.log("###### recommendations:", recommendations);
    // const response = await axios.post(`/recommendations/${agentId}/set`, recommendations);
    // console.log(`Sent ${recommendations.length} recommendations to agent ${agentId}`);
    // return response.data;
  } catch (error) {
    console.error(
      `Error sending recommendations to agent ${agentId}:`,
      error.message
    );
    throw error;
  }
}

// Helper to check if a message needs processing
function isNewOrUpdatedToken(message, dataHandler) {
  const existingToken = dataHandler.getTokenByAddress(
    message.token.tokenAddress
  );

  // New token
  if (!existingToken) return true;

  // Check if this is a new update with different stats
  if (message.token.stats) {
    const lastUpdate = existingToken.updates[existingToken.updates.length - 1];
    return (
      !lastUpdate ||
      lastUpdate.marketCap !== message.token.stats.marketCap ||
      lastUpdate.percentage !== message.token.stats.percentage
    );
  }

  return false;
}

// Run Discord message scraper exactly on the minute mark (e.g., 1:00, 2:00, etc.)
cron.schedule("0 * * * * *", async () => {
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

// Run first mention scraper 30 seconds after each minute mark (e.g., 1:30, 2:30, etc.)
cron.schedule("30 * * * * *", async () => {
  console.log("Checking for token mentions...");
  try {
    const tokenAddress = dataHandler.getNextJob();
    if (tokenAddress) {
      await updateTokenMention(dataHandler, tokenAddress);
    }
  } catch (error) {
    console.error("Error in mention check cron:", error);
  }
});

// Read and send recommendations every 30 seconds
cron.schedule("*/30 * * * * *", async () => {
  console.log("Processing recommendations...");
  try {
    // Get tokens that haven't been sent yet
    const newRecommendations = Object.values(dataHandler.data.tokens)
      .filter((token) => !sentRecommendations.has(token.pumpFunLink))
      .filter((token) => token.firstMention)
      .map((token) => ({
        user: token.firstMention,
        token: {
          name: token.name,
          ticker: token.ticker,
          chain: token.chain,
          tokenAddress: token.tokenAddress,
          pumpFunLink: token.pumpFunLink,
          marketCap: token.updates[0]?.marketCap,
          percentage: token.updates[0]?.percentage,
          recommendationType: token.updates[0]?.type,
        },
      }));

    if (newRecommendations.length > 0) {
      console.log("###### formattedRecommendations:", newRecommendations);

      // Send to API
      const agentId = process.env.AGENT_ID || "default";
      await sendRecommendations(agentId, newRecommendations);

      // Mark these recommendations as sent
      newRecommendations.forEach((rec) => {
        sentRecommendations.add(rec.token.pumpFunLink);
      });
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
