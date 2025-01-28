import { MongoClient } from "mongodb";
import { promises as fs } from "fs";
import path from "path";

class MongoDataHandler {
    constructor(mongoUrl = "mongodb://localhost:27017", dbName = "tokendb") {
        const urlObj = new URL(mongoUrl.replace(/^MONGO_URI=+/, ""));
        const pathParts = urlObj.pathname.split("/");

        // If database name is in the URL, use that instead of the provided dbName
        if (pathParts.length > 1 && pathParts[1]) {
            this.dbName = pathParts[1];
            // Remove database name from URL
            urlObj.pathname = "/";
            this.mongoUrl = urlObj.toString();
        } else {
            this.dbName = dbName;
            this.mongoUrl = mongoUrl;
        }

        this.client = null;
        this.db = null;
        this.jobs = [];
        this.oldDataPath = path.join(process.cwd(), "data", "tokens.json");

        this.connectionOptions = {
            connectTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            maxPoolSize: 50,
            retryWrites: true,
            retryReads: true,
            directConnection: true, // Added for more direct connection
        };
    }

    async checkAndCreateCollections() {
        try {
            // Get list of existing collections
            const collections = await this.db.listCollections().toArray();
            const collectionNames = collections.map((col) => col.name);

            // Define required collections and their indexes
            const requiredCollections = {
                tokens: [
                    { key: { tokenAddress: 1 }, options: { unique: true } },
                    { key: { chain: 1 }, options: {} },
                    { key: { ticker: 1 }, options: {} },
                    { key: { firstSeenAt: 1 }, options: {} },
                ],
                sentRecommendations: [
                    { key: { tokenAddress: 1 }, options: { unique: true } },
                ],
                performanceUpdates: [
                    { key: { tokenAddress: 1 }, options: { unique: true } },
                ],
            };

            // Create collections and indexes if they don't exist
            for (const [collectionName, indexes] of Object.entries(
                requiredCollections
            )) {
                if (!collectionNames.includes(collectionName)) {
                    console.log(`Creating collection: ${collectionName}`);
                    const collection = await this.db.createCollection(
                        collectionName
                    );

                    // Create indexes
                    for (const index of indexes) {
                        console.log(
                            `Creating index on ${collectionName}:`,
                            index.key
                        );
                        await collection.createIndex(index.key, index.options);
                    }
                }

                // Store collection reference
                this[collectionName] = this.db.collection(collectionName);
            }

            return true;
        } catch (error) {
            console.error("Error creating collections:", error);
            throw error;
        }
    }

    async initialize(maxRetries = 5, retryDelay = 5000) {
        let retryCount = 0;
        let lastError = null;

        while (retryCount < maxRetries) {
            try {
                if (retryCount > 0) {
                    console.log(
                        `Retrying MongoDB connection (attempt ${
                            retryCount + 1
                        }/${maxRetries})...`
                    );
                    await new Promise((resolve) =>
                        setTimeout(resolve, retryDelay)
                    );
                }

                console.log("Connecting to MongoDB server...", this.mongoUrl);

                // Connect to MongoDB server
                this.client = await MongoClient.connect(
                    this.mongoUrl,
                    this.connectionOptions
                );
                console.log("Successfully connected to MongoDB server");

                // Select database
                this.db = this.client.db(this.dbName);
                console.log(`Selected database: ${this.dbName}`);

                // Test database connection with a simple command
                await this.db.command({ ping: 1 });
                console.log("Database ping successful");

                // Initialize collections and indexes
                await this.checkAndCreateCollections();
                console.log("Collections and indexes initialized");

                // Import existing data if available
                await this.importExistingData();
                console.log("Data import completed");

                return;
            } catch (error) {
                lastError = error;
                console.error(
                    `MongoDB connection attempt ${retryCount + 1} failed:`,
                    {
                        error: error.message,
                        stack: error.stack,
                    }
                );

                if (this.client) {
                    await this.client.close().catch(console.error);
                    this.client = null;
                }

                retryCount++;
            }
        }

        throw new Error(
            `Failed to connect to MongoDB after ${maxRetries} attempts. Last error: ${lastError.message}`
        );
    }

    async importExistingData() {
        try {
            // Check if file exists
            try {
                await fs.access(this.oldDataPath);
            } catch {
                console.log("No existing data file found, skipping import");
                return;
            }

            const data = await fs.readFile(this.oldDataPath, "utf8");
            const jsonData = JSON.parse(data);

            if (jsonData.tokens && Object.keys(jsonData.tokens).length > 0) {
                console.log(
                    `Importing ${Object.keys(jsonData.tokens).length} tokens...`
                );

                // Convert tokens object to array and prepare bulk operations
                const tokenArray = Object.values(jsonData.tokens);
                const bulkOps = tokenArray.map((token) => ({
                    updateOne: {
                        filter: { tokenAddress: token.tokenAddress },
                        update: { $setOnInsert: token },
                        upsert: true,
                    },
                }));

                // Perform bulk write with ordered: false for better performance
                const result = await this.tokens.bulkWrite(bulkOps, {
                    ordered: false,
                });
                console.log(`Imported ${result.upsertedCount} new tokens`);

                // Import other collections if they exist
                if (jsonData.sentRecommendations) {
                    const recDocs = Object.entries(
                        jsonData.sentRecommendations
                    ).map(([addr, timestamp]) => ({
                        tokenAddress: addr,
                        sentAt: timestamp,
                    }));
                    await this.sentRecommendations.insertMany(recDocs, {
                        ordered: false,
                    });
                }

                if (jsonData.lastPerformanceUpdates) {
                    const perfDocs = Object.entries(
                        jsonData.lastPerformanceUpdates
                    ).map(([addr, timestamp]) => ({
                        tokenAddress: addr,
                        lastUpdate: timestamp,
                    }));
                    await this.performanceUpdates.insertMany(perfDocs, {
                        ordered: false,
                    });
                }
            }
        } catch (error) {
            console.error("Error importing existing data:", error);
            // Don't throw the error, just log it and continue
        }
    }

    async testConnection() {
        try {
            console.log(`Testing connection to MongoDB server...`);
            const testClient = new MongoClient(
                this.mongoUrl,
                this.connectionOptions
            );
            await testClient.connect();

            // Test basic connectivity
            await testClient.db("admin").command({ ping: 1 });
            console.log("Basic connectivity test successful");

            // Test specific database access
            const testDb = testClient.db(this.dbName);
            await testDb.command({ ping: 1 });
            console.log(`Successfully connected to database: ${this.dbName}`);

            await testClient.close();
            return true;
        } catch (error) {
            console.error("MongoDB Connection Test Failed:", {
                url: this.mongoUrl.replace(/\/\/[^:]+:[^@]+@/, "//****:****@"),
                dbName: this.dbName,
                error: error.message,
                stack: error.stack,
            });
            return false;
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

    async saveData(newMessages) {
        const timestamp = new Date().toISOString();
        const bulkOps = [];

        for (const msg of newMessages) {
            const { token, user, msgTimestamp } = msg;
            if (!token.tokenAddress) continue;

            const tokenDoc = {
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
            };

            if (token.stats) {
                tokenDoc.updates = [
                    {
                        timestamp: timestamp,
                        marketCap: token.stats.marketCap,
                        percentage: token.stats.percentage,
                        type: token.recommendationType || "new_listing",
                    },
                ];
            }

            if (token.recommendationType === "new_listing") {
                tokenDoc.firstMention = {
                    username: user.username,
                    discordId: user.discordId,
                    timestamp: timestamp,
                };
            }

            bulkOps.push({
                updateOne: {
                    filter: { tokenAddress: token.tokenAddress },
                    update: {
                        $setOnInsert: tokenDoc,
                    },
                    upsert: true,
                },
            });

            if (token.recommendationType !== "new_listing") {
                this.addMentionCheckJob(token.tokenAddress);
            }
        }

        if (bulkOps.length > 0) {
            await this.tokens.bulkWrite(bulkOps);
        }
    }

    async updateTokenPerformance(tokenAddress, performanceData) {
        if (!tokenAddress || !performanceData) {
            throw new Error("Token address and performance data are required");
        }

        const timestamp = new Date().toISOString();

        await this.tokens.updateOne(
            { tokenAddress },
            {
                $set: {
                    lastPerformanceUpdate: timestamp,
                    performance: {
                        symbol: performanceData.symbol,
                        ...performanceData,
                    },
                },
            },
            { upsert: true }
        );

        await this.performanceUpdates.updateOne(
            { tokenAddress },
            { $set: { lastUpdate: timestamp } },
            { upsert: true }
        );
    }

    async getTokenByAddress(tokenAddress) {
        return await this.tokens.findOne({ tokenAddress });
    }

    async getAllTokens() {
        return await this.tokens.find({}).toArray();
    }

    async getTokensByUser(discordId) {
        return await this.tokens
            .find({
                "scanRecommendation.discordId": discordId,
            })
            .toArray();
    }

    async getTokens(options = {}) {
        const query = {};

        if (options.chain) {
            query.chain = options.chain;
        }

        if (options.address) {
            query.tokenAddress = options.address;
        }

        if (options.ticker) {
            query.ticker = options.ticker;
        }

        if (options.startTime || options.endTime) {
            query.firstSeenAt = {};
            if (options.startTime) {
                query.firstSeenAt.$gte = options.startTime;
            }
            if (options.endTime) {
                query.firstSeenAt.$lte = options.endTime;
            }
        }

        let cursor = this.tokens.find(query);

        if (options.sortBy) {
            const sortField = {
                firstSeenAt: "firstSeenAt",
                marketCap: "performance.mcap",
                price: "performance.price",
                volume: "performance.volume24h",
            }[options.sortBy];

            if (sortField) {
                cursor = cursor.sort({ [sortField]: -1 });
            }
        }

        if (options.limit && options.limit > 0) {
            cursor = cursor.limit(options.limit);
        }

        return await cursor.toArray();
    }

    async markRecommendationSent(tokenAddress) {
        await this.sentRecommendations.updateOne(
            { tokenAddress },
            { $set: { sentAt: new Date().toISOString() } },
            { upsert: true }
        );
    }

    async isRecommendationSent(tokenAddress) {
        const doc = await this.sentRecommendations.findOne({ tokenAddress });
        return Boolean(doc);
    }

    async shouldUpdatePerformance(tokenAddress) {
        const doc = await this.performanceUpdates.findOne({ tokenAddress });
        if (!doc) return true;

        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        return new Date(doc.lastUpdate) < thirtyMinutesAgo;
    }

    async getUnsent() {
        const sentAddresses = await this.sentRecommendations.distinct("tokenAddress");
        const tokens = await this.tokens
            .find({
                tokenAddress: { $nin: sentAddresses },
            })
            .toArray();
        return tokens;
    }

    async getTokensNeedingPerformanceUpdate() {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const needsUpdate = await this.performanceUpdates
            .find({
                lastUpdate: { $lt: thirtyMinutesAgo.toISOString() },
            })
            .toArray();

        const addresses = needsUpdate.map((doc) => doc.tokenAddress);
        return await this.tokens
            .find({
                $or: [
                    { tokenAddress: { $nin: addresses } },
                    { tokenAddress: { $in: addresses } },
                ],
            })
            .toArray();
    }

    async close() {
        if (this.client) {
            await this.client.close();
        }
    }
}

export { MongoDataHandler };
