const isValidPerformance = (performance) => {
    if (!performance) return false;
  
    const requiredFields = [
      'symbol',
      'tokenAddress',
      'priceChange24h',
      'volumeChange24h',
      'trade_24h_change',
      'liquidity',
      'liquidityChange24h',
      'holderChange24h',
      'rugPull',
      'isScam',
      'marketCapChange24h',
      'sustainedGrowth',
      'rapidDump',
      'suspiciousVolume',
      'validationTrust',
      'balance',
      'initialMarketCap'
    ];
  
    return requiredFields.every(field => 
      performance[field] !== null && 
      performance[field] !== undefined
    );
  };
  
  // Validation function for user data
  const isValidUser = (user) => {
    if (!user) return false;
  
    const requiredFields = [
      'username',
      'discordId',
      'timestamp'
    ];
  
    return requiredFields.every(field => 
      user[field] !== null && 
      user[field] !== undefined
    );
  };
  
  // Validation function for token data
  const isValidToken = (token) => {
    if (!token) return false;
  
    const requiredFields = [
      'name',
      'ticker',
      'chain',
      'tokenAddress',
      'pumpFunLink',
      'marketCap',
      'percentage',
      'recommendationType',
      'timestamp'
    ];
  
    return requiredFields.every(field => 
      token[field] !== null && 
      token[field] !== undefined
    );
  };
  
  // Main validation check to use in your cron job
  const isValidTokenData = (tokenData) => {
    return (
      tokenData &&
      isValidUser(tokenData.user) &&
      isValidToken(tokenData.token) &&
      isValidPerformance(tokenData.performance)
    );
  };

module.exports = {
  isValidTokenData,
};
