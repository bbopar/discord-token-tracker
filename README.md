# Discord Token Tracker

A Node.js application that tracks token mentions and updates from Discord messages, monitoring cryptocurrency token discussions, price movements, and performance metrics using the Birdeye API.

## Features

- Scraping and monitoring of Discord messages for token mentions and updates
- Integration with MongoDB for robust data persistence
- Automatic tracking of token price updates, market cap changes, and liquidity metrics
- First mention detection and attribution for new tokens
- Token performance analysis using Birdeye API integration 
- Token security assessment
- Multiple periodic data synchronization jobs
- Health check endpoint for monitoring
- Configurable scheduling using cron jobs
- Rate limit handling and retry mechanisms

## Prerequisites

- Node.js (v16 or higher)
- npm (Node Package Manager)
- MongoDB instance
- Docker and Docker Compose (optional, for running dependencies)
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
AUTHORIZATION_TOKEN=your_discord_auth_token
GUILD_ID=your_discord_server_id
CHANNEL_ID=your_discord_channel_id
AGENT_ID=your_agent_id
BIRDEYE_API_KEY=your_birdeye_api_key
MONGO_URI=mongodb://mongo:mongo@localhost:27017/tokendb
```

## Infrastructure Setup

You can run the required infrastructure using Docker Compose:

```bash
docker-compose up -d
```

This will start:
- MongoDB instance on port 27017
- Redis on port 6379
- PostgreSQL with pgvector on port 5432

Each service includes health checks and persistent volume storage.

## Project Structure

```
├── src/
│   ├── api/                 # API integration modules
│   │   ├── getTokenPerformance.js   # Birdeye API integration
│   │   ├── mentionScraper.js        # Discord message scraping
│   │   ├── scraperFirstMention.js   # First mention detection
│   │   └── sendTokenData.js         # Data transmission
│   ├── database/
│   │   ├── dataHandler.js           # JSON file data handler (legacy)
│   │   └── mongoDataHandler.js      # MongoDB data handler
│   ├── utils/
│   │   ├── isNewOrUpdatedToken.js   # Token update validation
│   │   ├── parseMessage.js          # Message parsing utilities
│   │   └── tokenDataValidation.js   # Data validation
│   └── server.js           # Main application entry point
├── docker-compose.yml     # Infrastructure configuration
├── package.json          # Project dependencies and scripts
└── README.md            # Project documentation
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3210)
- `AUTHORIZATION_TOKEN`: Your Discord authorization token
- `GUILD_ID`: The ID of your Discord server
- `CHANNEL_ID`: The ID of the channel to monitor
- `AGENT_ID`: Your agent identifier for API interactions
- `BIRDEYE_API_KEY`: Your Birdeye API key for token performance data
- `MONGO_URI`: MongoDB connection string

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

### Scheduled Jobs

The application runs several cron jobs:

1. Discord Message Scraper: Runs every 2 seconds
   - Retrieves new token mentions and updates
   - Processes and validates message content
   - Updates token data in MongoDB

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

## MongoDB Collections

The application uses the following MongoDB collections:

- `tokens`: Main collection storing token information and updates
- `sentRecommendations`: Tracks sent token recommendations
- `performanceUpdates`: Tracks performance update timestamps

Each collection is automatically created with appropriate indexes for optimal performance.

## Data Migration

The application includes automatic migration from the legacy JSON file storage to MongoDB during initialization. If a `tokens.json` file exists in the `data` directory, its contents will be automatically imported into MongoDB.

## Error Handling

The application includes comprehensive error handling:
- MongoDB connection retries with configurable attempts
- Birdeye API error handling with automatic retries
- Network failures and timeout handling
- Data parsing and validation
- Storage operation failures
- Recommendation transmission errors

Errors are logged to the console and can be monitored through the health check endpoint.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.