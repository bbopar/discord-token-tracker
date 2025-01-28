import axios from "axios";

/**
 * Send recomendation.
 * @param {*} agentId
 * @param {*} recommendation
 * @returns
 */
export async function sendRecommendation(agentId, recommendation) {
    try {
        const baseURL = "http://localhost:3000";
        const endpoint = `/recommendation/${agentId}/set`;
        const url = `${baseURL}${endpoint}`;

        // Headers configuration
        const config = {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            timeout: 5000,
            maxRedirects: 5,
        };

        const response = await axios.post(url, recommendation, config);
        console.log(
            `Sent ${recommendation} recommendation to agent ${agentId}`
        );

        await new Promise((resolve) => setTimeout(resolve, 3000));
        return response.data;
    } catch (error) {
        console.log("######## ERROR", error);
        if (error.code === "ECONNREFUSED") {
            console.error(
                "Connection refused. Please ensure the server is running on port 3000"
            );
        } else if (error.response && error.response.status === 401) {
            console.error(
                "Unauthorized access. Please check authentication credentials"
            );
        } else {
            console.error(
                `Error sending recommendation to agent ${agentId}:`,
                error.message
            );
        }
        return false;
    }
}

async function sendTokenPerformanceUpdate(tokenData) {
    // TODO
    const agentId = process.env.AGENT_ID;
    const recommendation = {
        token: tokenData,
    };
    // return await sendRecommendation(agentId, recommendation);
}
