// PLEASE READ THE COMMENTS AT THE END IF YOU DON'T KNOW WHAT THESE PARAMETERS MEAN

const globalParams = {

    // Global parameters
    _keepBNB :   0.1,   // This will always keep this amount of BNB in your wallet - don't set it to zero! Min of 0.1
    _minBnbToTrade : 0.01, // This will stop you trading $0.01 trades and paying $0.15 in gas!

    // Global Addresses
    _pcsLPV2 :'0x10ED43C718714eb63d5aA57B78B54704E256024E',   // PancakeSwap Router v2
    _wbnbAddress : '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',  // WBNB
    _busdAddress : '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD

    // Trading parameters
    _executionSlippage :  1, // This is in percent 1 (1%) may be too tight, try using 2
    _bidToMidSlippage : 1, //This is the price impact of the size of your trade, the trade may fail because the size is too big or the liquidity pool is too shallow
                        // set to 0 to ignore price impact of the size of the trade
    _gasApprovalAmount :  100000, // usually you only need 45k for a contract approval, it won't spend more than needed
    _gasTradingAmount :  350000, // swapexacttokensfortokens should only take 180k on v1, but this should give some buffer
    _gasPrice :  5 // 5 is generally ok for BSC, but 6 may be needed for volatile markets
}

module.exports = {
    globalParams: globalParams
}
