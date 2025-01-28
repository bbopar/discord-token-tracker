import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const discord = axios.create({
    headers: {
        Authorization: process.env.AUTHORIZATION_TOKEN,
        "Content-Type": "application/json",
        Accept: "*/*",
    },
    timeout: 60000,
});

export async function fetchTokenMentions(tokenAddress) {
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
                msg.author?.username !== "Rick" &&
                msg.content?.includes(tokenAddress)
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

export async function updateTokenMention(dataHandler, tokenAddress) {
    try {
        // Input validation
        if (!tokenAddress || !dataHandler) {
            console.error("Missing required parameters:", {
                tokenAddress,
                hasDataHandler: !!dataHandler,
            });
            return;
        }

        // Fetch the current token from MongoDB
        const token = await dataHandler.getTokenByAddress(tokenAddress);
        if (!token) {
            console.log(`No token found for address ${tokenAddress}`);
            return;
        }

        // Only proceed if token doesn't already have a firstMention
        if (token.firstMention) {
            console.log(
                `Token ${tokenAddress} already has first mention recorded`
            );
            return;
        }

        // Fetch mention data
        const mention = await fetchTokenMentions(tokenAddress);
        console.log("Fetched mention data:", mention);

        if (!mention) {
            console.log(`No mention data found for token ${tokenAddress}`);
            return;
        }

        // Update the token document in MongoDB
        await dataHandler.tokens.updateOne(
            { tokenAddress },
            {
                $set: {
                    firstMention: mention,
                    lastUpdated: new Date().toISOString(),
                },
            }
        );

        console.log(
            `Successfully updated first mention for token ${tokenAddress}:`,
            mention
        );

        return mention;
    } catch (error) {
        console.error(
            `Error updating mention for token ${tokenAddress}:`,
            error
        );
        throw error; // Re-throw to allow caller to handle the error
    }
}
