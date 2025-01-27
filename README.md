# Discord Token Tracker

A Node.js application that tracks token mentions and updates from a Discord channel, specifically designed to monitor cryptocurrency token discussions and price movements.

## Features

- Real-time monitoring of Discord messages for token mentions
- Automatic tracking of token price updates and market cap changes
- First mention detection for new tokens
- Periodic data synchronization
- REST API endpoints for status monitoring
- Persistent data storage using JSON files
- Configurable scheduling using cron jobs

## Prerequisites

- Node.js (v16 or higher)
- npm (Node Package Manager)
- Discord Bot Token with necessary permissions
- Access to the target Discord server and channel

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
```

## Project Structure

```
├── data/                 # Data storage directory
│   └── tokens.json      # Persistent storage for token data
├── src/
│   ├── cache/
│   │   └── dataHandler.js    # Data management and persistence
│   ├── utils/
│   │   └── parseMessage.js   # Message parsing utilities
│   ├── mention-scraper.js    # Token mention tracking
│   ├── scraper-first-mention.js  # First mention detection
│   └── server.js       # Main application entry point
├── .env                # Environment variables
├── package.json       # Project dependencies and scripts
└── README.md         # Project documentation
```

## Configuration

### Discord Bot Setup

1. Create a Discord application at https://discord.com/developers/applications
2. Create a bot for your application
3. Enable necessary intents (Message Content Intent is required)
4. Copy the bot token and add it to your `.env` file
5. Invite the bot to your server with necessary permissions

### Environment Variables

- `PORT`: Server port (default: 3210)
- `AUTHORIZATION_TOKEN`: Your Discord bot token
- `GUILD_ID`: The ID of your Discord server
- `CHANNEL_ID`: The ID of the channel to monitor
- `AGENT_ID`: Your agent identifier for API interactions

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
- `GET /status`: Current application status and statistics

### Monitoring

The application runs three main cron jobs:

1. Message Scraper: Runs every minute (":00")
2. First Mention Scraper: Runs 30 seconds after each minute (":30")
3. Recommendation Processor: Runs every 30 seconds

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
  }
}
```

## Error Handling

The application includes comprehensive error handling:
- Discord API rate limiting
- Network failures
- Data parsing errors
- Storage failures

Errors are logged to the console and captured in the status endpoint.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.
