require('dotenv').config();

const axios = require("axios");
const { parseMessage } = require("../utils/parseMessage.js");

const DISCORD_API_URL =
  "https://discord.com/api/v9/channels/%s/messages?limit=50";

const discord = axios.create({
  headers: {
    Authorization: process.env.AUTHORIZATION_TOKEN,
    "Content-Type": "application/json",
    Accept: "*/*",
  },
  timeout: 60000,
});

async function retrieveAndParseMessages() {
  const messages = [];
  try {
    const response = await discord.get(
      DISCORD_API_URL.replace("%s", process.env.CHANNEL_ID)
    );
    const jsonMessages = response.data;

    for (const message of jsonMessages) {
      // Only process messages from Rick bot
      if (message.author?.username !== "Rick" || !message.author?.bot) {
        continue;
      }

      const parsedMessage = parseMessage(message.content);
      const user = {};
      const token = {};

      console.log("RICK MESSAGE:", message);

      if (parsedMessage?.type === "new_listing" || parsedMessage?.type === "update") {
        token.recommendationType = parsedMessage.type;
        token.name = parsedMessage.tokenName;
        token.ticker = parsedMessage.ticker;
        token.chain = parsedMessage.chain;
        token.tokenAddress = parsedMessage.tokenAddress;
        token.pumpFunLink = parsedMessage.pumpFunLink;
        
        // Only include stats if they exist
        if (parsedMessage.stats?.marketCap || parsedMessage.stats?.percentage) {
          token.stats = {
            marketCap: parsedMessage.stats.marketCap,
            percentage: parsedMessage.stats.percentage,
          };
        }

        // Handle user data
        if (message.mentions && message.mentions.length > 0) {
          user.username = message.mentions[0].username;
          user.discordId = message.mentions[0].id;
        }
        
        if (!message.mentions && message.referenced_message?.author) {
          user.username = message.referenced_message.author.username;
          user.discordId = message.referenced_message.author.id;
        }

        // Only add messages that have required fields
        if (token.ticker && token.pumpFunLink && token.tokenAddress && user.username && user.discordId) {
          console.log("###### token:", token);
          console.log("###### user:", user);
          messages.push({ user, token, msgTimestamp: message.timestamp });
        }
      }
    }
  } catch (error) {
    if (error.response) {
      console.error(
        "Error response:",
        error.response.status,
        error.response.statusText
      );
    } else {
      console.error("Error retrieving messages:", error.message);
    }
    throw error; // Propagate error to caller
  }

  return messages;
}

// Export only the necessary functions and constants
module.exports = {
  retrieveAndParseMessages,
};