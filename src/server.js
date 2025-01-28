import { MongoDataHandler } from "./database/mongoDataHandler.js";
import { CronJobs } from "./cron/jobs.js";
import express from "express";
import dotenv from "dotenv";

// Initialize environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3210;

// Initialize data handler
const dataHandler = new MongoDataHandler(process.env.MONGO_URI);

// Initialize cron jobs
const cronJobs = new CronJobs(dataHandler);

// Initialize data handler when server starts
(async () => {
    await dataHandler.initialize();
    console.log("Data handler initialized");

    // Start cron jobs after data handler is initialized
    cronJobs.startJobs();
    console.log("Cron jobs started");
})();

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
