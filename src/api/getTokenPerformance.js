import axios from "axios";

const PROVIDER_CONFIG = {
    BIRDEYE_API: "https://public-api.birdeye.so",
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    DEFAULT_RPC: "https://api.mainnet-beta.solana.com",
    TOKEN_ADDRESSES: {
        SOL: "So11111111111111111111111111111111111111112",
        BTC: "qfnqNqs3nCAHjnyCgLRDbBtq4p2MtHZxw8YjSyYhPoL",
        ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
        Example: "2weMjPLLybRMMva1fM3U31goWWrCpF59CHWNhnCJ9Vyh",
    },
    TOKEN_SECURITY_ENDPOINT: "/defi/token_security?address=",
    TOKEN_TRADE_DATA_ENDPOINT: "/defi/v3/token/trade-data/single?address=",
    DEX_SCREENER_API: "https://api.dexscreener.com/latest/dex/tokens/",
    MAIN_WALLET: "",
};

// Utility function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Error class for API-specific errors
class BirdeyeAPIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = "BirdeyeAPIError";
        this.status = status;
        this.data = data;
    }
}

/**
 * Creates an axios instance with default configuration for Birdeye API
 * @param {string} apiKey - Birdeye API key
 * @returns {import('axios').AxiosInstance}
 */
const createApiClient = (apiKey) => {
    return axios.create({
        baseURL: PROVIDER_CONFIG.BIRDEYE_API,
        headers: {
            Accept: "application/json",
            "x-chain": "solana",
            "X-API-KEY": apiKey,
        },
        timeout: 10000,
    });
};

/**
 * Fetches token performance metrics with retry logic
 * @param {string} tokenAddress - Token address to fetch metrics for
 * @param {string} apiKey - Birdeye API key
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Token performance data
 */
export async function getTokenPerformance(tokenAddress, apiKey, options = {}) {
    const client = createApiClient(apiKey);
    let lastError = null;

    for (let attempt = 1; attempt <= PROVIDER_CONFIG.MAX_RETRIES; attempt++) {
        try {
            // Fetch trade data
            const tradeDataResponse = await client.get(
                `${PROVIDER_CONFIG.TOKEN_TRADE_DATA_ENDPOINT}${tokenAddress}`,
                options
            );

            // Fetch security data
            const securityResponse = await client.get(
                `${PROVIDER_CONFIG.TOKEN_SECURITY_ENDPOINT}${tokenAddress}`,
                options
            );

            // Combine and process the data
            const processedData = {
                tradeMetrics: tradeDataResponse.data,
                security: securityResponse.data,
                metadata: {
                    timestamp: new Date().toISOString(),
                    address: tokenAddress,
                },
            };

            // Add performance metrics
            if (tradeDataResponse.data.data) {
                const metrics = tradeDataResponse.data.data;
                processedData.performance = {
                    price: metrics.price,
                    priceChange24h: metrics.priceChange24h,
                    volume24h: metrics.volume24h,
                    liquidity: metrics.liquidity,
                    mcap: metrics.mcap,
                };
            }

            return processedData;
        } catch (error) {
            lastError = new BirdeyeAPIError(
                error.message,
                error.response?.status,
                error.response?.data
            );

            // Handle different error scenarios
            if (error.response?.status === 429) {
                // Rate limit hit - wait longer
                await delay(PROVIDER_CONFIG.RETRY_DELAY * attempt);
                continue;
            }

            if (error.response?.status === 404) {
                throw new BirdeyeAPIError("Token not found", 404);
            }

            if (attempt === PROVIDER_CONFIG.MAX_RETRIES) {
                throw lastError;
            }

            // General error - wait standard delay
            await delay(PROVIDER_CONFIG.RETRY_DELAY);
        }
    }

    throw lastError;
}

/**
 * Batch fetch performance for multiple tokens
 * @param {string[]} tokenAddresses - Array of token addresses
 * @param {string} apiKey - Birdeye API key
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Map of token addresses to their performance data
 */
export async function batchGetTokenPerformance(
    tokenAddresses,
    apiKey,
    options = {}
) {
    const results = {};

    // Process in chunks of 5 to avoid rate limits
    for (let i = 0; i < tokenAddresses.length; i += 5) {
        const chunk = tokenAddresses.slice(i, i + 5);
        const promises = chunk.map((address) =>
            getTokenPerformance(address, apiKey, options)
                .then((data) => {
                    results[address] = data;
                })
                .catch((error) => {
                    results[address] = { error: error.message };
                })
        );

        await Promise.all(promises);

        // Add delay between chunks
        if (i + 5 < tokenAddresses.length) {
            await delay(1000);
        }
    }

    return results;
}

/**
 * Updates token performance metrics in the cache
 * @param {DataHandler} dataHandler - Instance of DataHandler for cache management
 * @param {string} tokenAddress - Token address to update
 * @returns {Promise<void>}
 */
/**
 * Updates token performance metrics in the cache
 * @param {DataHandler} dataHandler - Instance of DataHandler for cache management
 * @param {string} tokenAddress - Token address to update
 * @returns {Promise<void>}
 */
export async function updateTokenPerformance(
    dataHandler,
    tokenAddress,
    apiKey
) {
    try {
        // Fetch latest performance data
        const performanceData = await getTokenPerformance(
            tokenAddress,
            process.env.BIRDEYE_API_KEY
        );

        const tokenData = await getTokenLiquidity(
            tokenAddress,
            process.env.BIRDEYE_API_KEY
        );

        if (!performanceData?.tradeMetrics?.data) {
            throw new BirdeyeAPIError("Invalid performance data received", 400);
        }

        const metrics = performanceData.tradeMetrics.data;

        // Extract and format relevant metrics
        const tokenPerformance = {
            tokenAddress: metrics.address,
            // Price changes - fall back through different timeframes
            priceChange24h:
                metrics.price_change_24h_percent ||
                metrics.price_change_12h_percent ||
                metrics.price_change_8h_percent ||
                metrics.price_change_6h_percent ||
                metrics.price_change_4h_percent ||
                metrics.price_change_2h_percent ||
                metrics.price_change_1h_percent ||
                metrics.price_change_30m_percent ||
                0,

            // Volume changes - fall back through timeframes
            volumeChange24h:
                metrics.volume_24h_change_percent ||
                metrics.volume_12h_change_percent ||
                metrics.volume_8h_change_percent ||
                metrics.volume_6h_change_percent ||
                metrics.volume_4h_change_percent ||
                metrics.volume_2h_change_percent ||
                metrics.volume_1h_change_percent ||
                metrics.volume_30m_change_percent ||
                0,

            // Trade changes - similar fallback pattern
            trade_24h_change:
                metrics.trade_24h_change_percent ||
                metrics.trade_12h_change_percent ||
                metrics.trade_8h_change_percent ||
                metrics.trade_6h_change_percent ||
                metrics.trade_4h_change_percent ||
                metrics.trade_2h_change_percent ||
                metrics.trade_1h_change_percent ||
                metrics.trade_30m_change_percent ||
                0,

            // Liquidity - fall back to shorter timeframe volumes if 24h not available
            liquidity:
                tokenData.liquidity ||
                metrics.volume_24h_usd ||
                metrics.volume_12h_usd ||
                metrics.volume_8h_usd ||
                metrics.volume_6h_usd ||
                metrics.volume_4h_usd ||
                metrics.volume_2h_usd ||
                metrics.volume_1h_usd ||
                metrics.volume_30m_usd ||
                0,

            // Liquidity change - similar fallback pattern
            // TODO this is wrong I need to store liquidity to db for token and track change.
            liquidityChange24h: 0,

            // Holder changes - fall back through timeframes
            holderChange24h:
                metrics.unique_wallet_24h_change_percent ||
                metrics.unique_wallet_12h_change_percent ||
                metrics.unique_wallet_8h_change_percent ||
                metrics.unique_wallet_6h_change_percent ||
                metrics.unique_wallet_4h_change_percent ||
                metrics.unique_wallet_2h_change_percent ||
                metrics.unique_wallet_1h_change_percent ||
                metrics.unique_wallet_30m_change_percent ||
                0,

            rugPull: performanceData.security.data.fakeToken || false,
            isScam: !performanceData.security.data.jupStrictList,

            // Market cap change - calculate from available data or fallback to 0
            marketCapChange24h:
                ((metrics.price * performanceData.security.data.totalSupply -
                    metrics.history_24h_price *
                        performanceData.security.data.totalSupply) /
                    (metrics.history_24h_price *
                        performanceData.security.data.totalSupply)) *
                    100 || 0,

            // Sustained growth - check multiple timeframes but be more lenient if some are missing
            sustainedGrowth:
                (metrics.price_change_24h_percent > 0 ||
                    !metrics.price_change_24h_percent) &&
                (metrics.price_change_12h_percent > 0 ||
                    !metrics.price_change_12h_percent) &&
                (metrics.price_change_6h_percent > 0 ||
                    !metrics.price_change_6h_percent) &&
                metrics.price_change_4h_percent > 0,

            // Rapid dump - check shorter timeframes if longer ones aren't available
            rapidDump:
                metrics.price_change_1h_percent < -20 ||
                metrics.price_change_30m_percent < -15 ||
                metrics.price_change_24h_percent < -50,

            // Suspicious volume - consider multiple timeframes
            suspiciousVolume:
                metrics.volume_24h_usd > 1000000 ||
                metrics.volume_6h_usd > 500000 ||
                metrics.volume_1h_usd > 250000 ||
                Math.abs(
                    metrics.volume_24h_change_percent ||
                        metrics.volume_1h_change_percent ||
                        0
                ) > 500,

            validationTrust: 0,
            balance: performanceData.security.data.creatorBalance || 0,
            initialMarketCap:
                performanceData.security.data.totalSupply * metrics.price || 0,
        };

        // Update cache using DataHandler
        await dataHandler.updateTokenPerformance(
            tokenAddress,
            tokenPerformance
        );

        return tokenPerformance;
    } catch (error) {
        console.error(
            `Error updating performance for token ${tokenAddress}:`,
            error
        );
        throw error;
    }
}

/**
 * Fetches liquidity data for a token using Birdeye's Token Overview API
 * @param {string} tokenAddress - Token address to fetch liquidity data for
 * @param {string} apiKey - Birdeye API key
 * @returns {Promise<Object>} Liquidity data for the token
 */
export async function getTokenLiquidity(tokenAddress, apiKey) {
    const client = createApiClient(apiKey);
    let lastError = null;

    for (let attempt = 1; attempt <= PROVIDER_CONFIG.MAX_RETRIES; attempt++) {
        try {
            // Fetch token overview data
            const response = await client.get(
                `/defi/token_overview?address=${tokenAddress}`
            );

            // Extract liquidity data from the response
            const liquidityData = {
                liquidity: response.data.data.liquidity || 0, // Current liquidity value
                price: response.data.data.price || 0, // Current price
                priceChange24h: response.data.data.priceChange24h || 0, // 24h price change
                volume24h: response.data.data.volume24h || 0, // 24h trading volume
                marketCap: response.data.data.marketCap || 0, // Market capitalization
                metadata: {
                    timestamp: new Date().toISOString(), // Timestamp of the data
                    address: tokenAddress, // Token address
                },
            };

            return liquidityData;
        } catch (error) {
            lastError = new BirdeyeAPIError(
                error.message,
                error.response?.status,
                error.response?.data
            );

            // Handle rate limits or retries
            if (error.response?.status === 429) {
                await delay(PROVIDER_CONFIG.RETRY_DELAY * attempt);
                continue;
            }

            if (error.response?.status === 404) {
                throw new BirdeyeAPIError("Token not found", 404);
            }

            if (attempt === PROVIDER_CONFIG.MAX_RETRIES) {
                throw lastError;
            }

            // General error - wait standard delay
            await delay(PROVIDER_CONFIG.RETRY_DELAY);
        }
    }

    throw lastError;
}
