function isNewOrUpdatedToken(message, dataHandler) {
    const existingToken = dataHandler.getTokenByAddress(
      message.token.tokenAddress
    );
  
    // New token
    if (!existingToken) return true;
  
    // Check if this is a new update with different stats
    if (message.token.stats) {
      const lastUpdate = existingToken.updates[existingToken.updates.length - 1];
      return (
        !lastUpdate ||
        lastUpdate.marketCap !== message.token.stats.marketCap ||
        lastUpdate.percentage !== message.token.stats.percentage
      );
    }
  
    return false;
  }

  module.exports = {
    isNewOrUpdatedToken
  };
  