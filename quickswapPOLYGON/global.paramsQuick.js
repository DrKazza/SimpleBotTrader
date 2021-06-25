// PLEASE READ THE COMMENTS AT THE END IF YOU DON'T KNOW WHAT THESE PARAMETERS MEAN

const globalParams = {
    // Set this to false to turn on pretent/paper trading mode
    _liveTrading : true,

    // Global parameters
    _keepMATIC :   20,   // This will always keep this amount of MATIC in your wallet - don't set it to zero! Min of 0.1
    _minMATICToTrade : 2, // This will stop you trading $0.01 trades and paying $0.15 in gas!
    _haltOnLowMATIC: 2,

    _rpcurl : 'https://rpc-mainnet.matic.network',
    _chainID : 137,

    // Global Addresses
    _routerLPV2 :'0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',   // QuickSwap Router v2
    _wMATICAddress : '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',  // WMATIC
    _usdcAddress : '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // usdc

    // Trading parameters
    _dynamicGasPrice : true, 
    // if you set this to true then you will use the prevailing gas price but execution will NOT happen if it's above the gas price specified below
    // so if you set gas price to 15, it will spend anything UPTO but not exceeding 15
    _maxGasPrice :  3, // 3 is generally the max for MATIC, but more may be needed for volatile markets
    _executionSlippage :  1, // This is in percent 1 (1%) may be too tight, try using 2
    _bidToMidSlippage : 1, //This is the price impact of the size of your trade, the trade may fail because the size is too big or the liquidity pool is too shallow
                        // set to 0 to ignore price impact of the size of the trade
    _gasApprovalLimit :  100000, // usually you only need 45k for a contract approval, it won't spend more than needed
    _gasTradingLimit :  350000 // swapexacttokensfortokens should only take 180k on v1, but this should give some buffer
}

module.exports = {
    globalParams: globalParams
}
