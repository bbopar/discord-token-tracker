import nodeCron from "node-cron";
import { retrieveAndParseMessages } from "../api/scraperFirstMention.js";
import { updateTokenMention } from "../api/mentionScraper.js";
import { updateTokenPerformance } from "../api/getTokenPerformance.js";
import { isNewOrUpdatedToken } from "../utils/isNewOrUpdatedToken.js";
import { isValidTokenData } from "../utils/tokenDataValidation.js";
import { sendRecommendation } from "../api/sendTokenData.js";

export class CronJobs {
    constructor(dataHandler) {
        this.dataHandler = dataHandler;
        this.lastRunStatus = {
            timestamp: null,
            success: null,
            newMessagesCount: 0,
            error: null
        };
    }

    getLastRunStatus() {
        return this.lastRunStatus;
    }

    startJobs() {
        this.startDiscordScraper();
        this.startTokenMentionCheck();
        this.startPerformanceUpdates();
        this.startRecommendationProcessor();
    }

    startDiscordScraper() {
        nodeCron.schedule("*/2 * * * * *", async () => {
            console.log("Running Discord scraper...");
            try {
                const messages = await retrieveAndParseMessages();
                const messagesToProcess = messages.filter((msg) =>
                    isNewOrUpdatedToken(msg, this.dataHandler)
                );

                if (messagesToProcess.length > 0) {
                    this.dataHandler.saveData(messagesToProcess);
                }

                this.lastRunStatus = {
                    timestamp: new Date(),
                    success: true,
                    newMessagesCount: messagesToProcess.length,
                    error: null,
                };
                console.log(
                    `Scraper run complete. Found ${messagesToProcess.length} new messages/updates.`
                );
            } catch (error) {
                this.lastRunStatus = {
                    timestamp: new Date(),
                    success: false,
                    newMessagesCount: 0,
                    error: error.message,
                };
                console.error("Scraper error:", error);
            }
        });
    }

    startTokenMentionCheck() {
        nodeCron.schedule("*/15 * * * * *", async () => {
            console.log("Checking for token mentions...");
            try {
                const tokenAddress = await this.dataHandler.getNextJob();
                if (tokenAddress) {
                    await updateTokenMention(this.dataHandler, tokenAddress);
                }

                const tokens = await this.dataHandler.getTokens();
                if (tokens) {
                    for (const token of tokens) {
                        if (
                            !token.performance &&
                            (await this.dataHandler.shouldUpdatePerformance(token.tokenAddress))
                        ) {
                            await updateTokenPerformance(
                                this.dataHandler,
                                token.tokenAddress,
                                process.env.BIRDEYE_API_KEY
                            );
                            await this.dataHandler.markPerformanceUpdated(token.tokenAddress);
                        }
                    }
                }
            } catch (error) {
                console.error("Error in mention check cron:", error);
            }
        });
    }

    startPerformanceUpdates() {
        nodeCron.schedule("*/30 * * * *", async () => {
            console.log("Running scheduled performance updates...");
            try {
                const tokensToUpdate = await this.dataHandler.getTokensNeedingPerformanceUpdate();
                for (const token of tokensToUpdate) {
                    await updateTokenPerformance(
                        this.dataHandler,
                        token.tokenAddress,
                        process.env.BIRDEYE_API_KEY
                    );
                    this.dataHandler.markPerformanceUpdated(token.tokenAddress);
                }
            } catch (error) {
                console.error("Error updating token performance:", error);
            }
        });
    }

    startRecommendationProcessor() {
        nodeCron.schedule("*/360 * * * * *", async () => {
            console.log("Processing recommendations...");
            try {
                
                const unsentTokens = (await this.dataHandler.getUnsent())
                    .filter((token) => token.firstMention && token.performance)
                    .map((token) => ({
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
                            marketCap: token?.updates?.[0]?.marketCap,
                            percentage: token?.updates?.[0]?.percentage,
                            recommendationType: token?.updates?.[0]?.type,
                            timestamp: token.firstMention.timestamp,
                        },
                        performance: token.performance,
                    }));

                for (const tokenData of unsentTokens) {
                    if (isValidTokenData(tokenData)) {
                        try {
                            const agentId = process.env.AGENT_ID;
                            const success = await sendRecommendation(agentId, tokenData);
                            if (success) {
                                this.dataHandler.markRecommendationSent(tokenData.token.tokenAddress);
                            } else {
                                console.log(
                                    `Failed to send recommendation for token ${tokenData.token.tokenAddress}`
                                );
                            }
                        } catch (sendError) {
                            console.error(
                                `Error sending recommendation for token ${tokenData.token.tokenAddress}:`,
                                sendError
                            );
                            continue;
                        }
                    }
                }
            } catch (error) {
                console.error("Error processing recommendations:", error);
            }
        });
    }
}