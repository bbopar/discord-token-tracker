require("dotenv").config();
const axios = require("axios");

const discord = axios.create({
  headers: {
    Authorization: process.env.AUTHORIZATION_TOKEN,
    "Content-Type": "application/json",
    Accept: "*/*",
  },
  timeout: 60000,
});

async function fetchTokenMentions(tokenAddress) {
  try {
    const response = await discord.get(
      `https://discord.com/api/v9/guilds/${process.env.GUILD_ID}/messages/search`,
      {
        params: {
          channel_id: process.env.CHANNEL_ID,
          content: tokenAddress,
        },
      }
    );

    // Get all messages and flatten them
    const messages = response.data.messages.flat();

    // Find the last message that:
    // 1. Is not from Rick bot
    // 2. Contains the token address
    const originalMessage = messages.find(
      (msg) =>
        msg.author?.username !== "Rick" && msg.content?.includes(tokenAddress)
    );

    if (originalMessage) {
      return {
        username: originalMessage.author.username,
        discordId: originalMessage.author.id,
        timestamp: originalMessage.timestamp,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching mentions:", error);
    throw error;
  }
}

async function updateTokenMention(dataHandler, tokenAddress) {
  try {
    const mention = await fetchTokenMentions(tokenAddress);

    if (mention && dataHandler.data.tokens[tokenAddress]) {
      dataHandler.data.tokens[tokenAddress].firstMention = mention;
      await dataHandler.saveData([]); // Save the updated data
      console.log(`Updated first mention for token ${tokenAddress}:`, mention);
    }
  } catch (error) {
    console.error(`Error updating mention for token ${tokenAddress}:`, error);
  }
}

module.exports = { updateTokenMention };
