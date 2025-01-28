// The pattern matches any message with 💊 (with or without leading 🆕 or 🚀)
// and extracts all the relevant information
const TOKEN_MESSAGE_PATTERN =
    /^(🆕|🚀)?💊\s*\*\*\[(.*?)\]\((https:\/\/pump\.fun\/([a-zA-Z0-9]+))\)\s*\[(.*?)\]\s*-\s*(.*?)\/(\w+)\*\*(\s*\[⬆︎\].*)?$/;

export function parseMessage(content) {
    // Only try to parse messages that contain 💊
    if (!content.includes("💊")) return null;

    const matches = content.match(TOKEN_MESSAGE_PATTERN);
    if (!matches) return null;

    const [
        fullMatch, // Full match
        typeEmoji,
        tokenName,
        pumpFunUrl,
        pumpFunId,
        stats,
        ticker,
        chain,
        upArrowLink, // Optional upward arrow with Discord link
    ] = matches;

    // Parse the stats to get marketcap and percentage
    const statsMatch = stats.match(
        /(\d+(?:\.\d+)?[KMB]?)\/(\d+(?:\.\d+)?[KMB]?)%/
    );
    const marketCap = statsMatch?.[1] || "";
    const percentage = statsMatch?.[2] || "";

    return {
        tokenName: tokenName.trim(),
        ticker: ticker.trim(),
        chain: chain.trim(),
        tokenAddress: pumpFunId,
        pumpFunLink: `https://pump.fun/${pumpFunId}`,
        type: typeEmoji === "🆕" ? "new_listing" : "update",
        stats: {
            marketCap,
            percentage,
        },
        hasDiscordLink: !!upArrowLink,
    };
}

// Test the function with all examples
const examples = [
    "🆕💊 **[LC SHIB](https://pump.fun/43YakhC3TcSuTgSXnxFgw8uKL8VkuLuFa4M6Bninpump) [139K/28.7%] - LC/SOL**",
    "🆕💊 **[Peter Memecoin](https://pump.fun/DzYjBowLSDtnFe9N1yU3f3uHrc7L4P5akzoVJoJPpump) [288K/84.6%] - Bitcoin/SOL**",
    "🚀💊 **[justice for tosca](https://pump.fun/82CmJZWRN6uASyeWP5P1XycXpvXH58ijv36vMdNjdjmh) [20.8K/273%] - tosca/SOL**",
    "💊 **[Garlicoin](https://pump.fun/H1sWyyDceAPpGmMUxVBCHcR2LrCjz933pUyjWSLpump) [5.7M/6.3K%] - GARLIC/SOL** [⬆︎](https://discord.com/channels/853158373369184256/988615963647832124/1333396881962827779)",
    "🐦 **shared by <@441201666629435393>** [tweet](https://fxtwitter.com/PeterSchiff/status/1883848971300532337) [from PeterSchiff](<https://x.com/PeterSchiff/status/1883848971300532337>) 🕑 `7m ago`",
    "https://chromewebstore.google.com/detail/nova-extension/agegahikpkeljmhlggpipmepoigaimdk is this the right one ?",
    "🚀💊 **[Garlicoin](https://pump.fun/H1sWyyDceAPpGmMUxVBCHcR2LrCjz933pUyjWSLpump) [387K/60.3%] - GARLIC/SOL**",
    "💊 **[FIRST DEEPSEEK AGENT](https://pump.fun/5WUGbpndw18FEGT8T3Tvvo8uHoyQEmJCaRAZVj4vpump) [285K/251%] - Anda/SOL**",
    "🐦 shared by @BeyondLimits prev.@aws/@coinbase [tweet](https://fxtwitter.com/DeItaone/status/1883861444904759749) [from DeItaone](https://x.com/DeItaone/status/1883861444904759749)",
];

// console.log('Testing parser with examples:');
// examples.forEach((example, index) => {
//   console.log(`\nExample ${index + 1}:`);
//   console.log('Input:', example);
//   const result = parseMessage(example);
//   if (result) {
//     console.log('Parsed:', result);
//   } else {
//     console.log('Not a token message - skipped');
//   }
// });
