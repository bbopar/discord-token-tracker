# Discord Token Tracker

A Node.js application that tracks token mentions and updates from a Discord channel, specifically designed to monitor cryptocurrency token discussions, price movements, and performance metrics using the Birdeye API.

## Features

- Real-time monitoring of Discord messages for token mentions and updates
- Automatic tracking of token price updates, market cap changes, and liquidity metrics
- First mention detection and attribution for new tokens
- Token performance analysis using Birdeye API integration
- Comprehensive token security assessment
- Multiple periodic data synchronization jobs
- REST API endpoints for status monitoring
- Persistent data storage using JSON files
- Configurable scheduling using cron jobs
- Rate limit handling and retry mechanisms

## Prerequisites

- Node.js (v16 or higher)
- npm (Node Package Manager)
- Discord Bot Token with necessary permissions
- Access to the target Discord server and channel
- Birdeye API key for token performance data

## Installation

1. Clone the repository:
```bash
git clone git@github.com:bbopar/discord-token-tracker.git
cd discord-token-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
PORT=3210
AUTHORIZATION_TOKEN=your_discord_bot_token
GUILD_ID=your_discord_server_id
CHANNEL_ID=your_discord_channel_id
AGENT_ID=your_agent_id
BIRDEYE_API_KEY=your_birdeye_api_key
```

## Project Structure

```
├── data/                     # Data storage directory
│   └── tokens.json          # Persistent storage for token data
├── src/
│   ├── api/                 # API integration modules
│   │   ├── get-token-performance.js   # Birdeye API integration
│   │   ├── mention-scraper.js         # Discord message scraping
│   │   ├── scraper-first-mention.js   # First mention detection
│   │   └── send-token-data.js         # Data transmission
│   ├── cache/
│   │   └── dataHandler.js    # Data management and persistence
│   ├── utils/
│   │   ├── isNewOrUpdatedToken.js    # Token update validation
│   │   ├── parseMessage.js           # Message parsing utilities
│   │   └── tokenDataValidation.js    # Data validation
│   └── server.js            # Main application entry point
├── .env                     # Environment variables
├── package.json            # Project dependencies and scripts
└── README.md              # Project documentation
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3210)
- `AUTHORIZATION_TOKEN`: Your Discord bot token
- `GUILD_ID`: The ID of your Discord server
- `CHANNEL_ID`: The ID of the channel to monitor
- `AGENT_ID`: Your agent identifier for API interactions
- `BIRDEYE_API_KEY`: Your Birdeye API key for token performance data

## Usage

### Starting the Application

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### API Endpoints

- `GET /health`: Health check endpoint
- `GET /status`: Current application status and statistics, including:
  - Last run timestamp
  - Success status
  - New messages count
  - Error information (if any)
  - Recommendations sent count

### Scheduled Jobs

The application runs several cron jobs:

1. Discord Message Scraper: Runs every 2 seconds
   - Retrieves new token mentions and updates
   - Processes and validates message content
   - Updates token data in storage

2. Token Mention & Performance Update: Runs every 15 seconds
   - Updates first mention data for tokens
   - Processes initial performance metrics for new tokens

3. Regular Performance Updates: Runs every 30 minutes
   - Updates token performance metrics
   - Tracks market changes and liquidity

4. Recommendation Processing: Runs every 6 minutes
   - Processes and sends token recommendations
   - Validates data completeness
   - Handles failed recommendations

## Data Structure

The application stores token data in the following format:

```json
{
  "lastUpdate": "ISO timestamp",
  "tokens": {
    "tokenAddress": {
      "name": "Token Name",
      "ticker": "TICKER",
      "chain": "CHAIN",
      "tokenAddress": "address",
      "firstSeenAt": "ISO timestamp",
      "pumpFunLink": "URL",
      "performance": {
        "priceChange24h": "value",
        "volumeChange24h": "value",
        "trade_24h_change": "value",
        "liquidity": "value",
        "liquidityChange24h": "value",
        "holderChange24h": "value",
        "rugPull": boolean,
        "isScam": boolean,
        "marketCapChange24h": "value",
        "sustainedGrowth": boolean,
        "rapidDump": boolean,
        "suspiciousVolume": boolean,
        "validationTrust": "value",
        "balance": "value",
        "initialMarketCap": "value"
      },
      "updates": [
        {
          "timestamp": "ISO timestamp",
          "marketCap": "value",
          "percentage": "value",
          "type": "update_type"
        }
      ],
      "firstMention": {
        "username": "discord_username",
        "discordId": "discord_user_id",
        "timestamp": "ISO timestamp"
      }
    }
  },
  "sentRecommendations": {
    "tokenAddress": "ISO timestamp"
  },
  "lastPerformanceUpdates": {
    "tokenAddress": "ISO timestamp"
  }
}
```

## Error Handling

The application includes comprehensive error handling:
- Discord API rate limiting and retry mechanisms
- Birdeye API error handling with automatic retries
- Network failures and timeout handling
- Data parsing and validation
- Storage operation failures
- Recommendation transmission errors

Errors are logged to the console and reflected in the status endpoint.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.