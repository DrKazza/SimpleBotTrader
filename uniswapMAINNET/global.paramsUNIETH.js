// PLEASE READ THE COMMENTS AT THE END IF YOU DON'T KNOW WHAT THESE PARAMETERS MEAN

const globalParams = {
    // Set this to false to turn on pretent/paper trading mode
    _liveTrading : true,

    // Global parameters
    _keepETH :   0.1,   // This will always keep this amount of ETH in your wallet - don't set it to zero! Min of 0.1
    _minETHToTrade : 0.05, // This will stop you trading $1 trades and paying $15 in gas!
    _haltOnLowETH: 0.1,

    _rpcurl : '', // SIGN UP FOR AN INFURA WEBSOCKET AND PUT YOUR URL IN THE .ENV FILE
    _chainID : 1,

    // Global Addresses
    _routerLPV2 :'0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',   // UniSwap Router v2
    // FYI the address of router v3 is: '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    _wETHAddress : '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',  // WETH
    _usdcAddress : '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // usdc

    // Trading parameters
    _dynamicGasPrice : true, 
    // if you set this to true then you will use the prevailing gas price but execution will NOT happen if it's above the gas price specified below
    // so if you set gas price to 15, it will spend anything UPTO but not exceeding 15
    _maxGasPrice :  60, // this can be all over the place - set it sensibly
    _executionSlippage :  1, // This is in percent 1 (1%) may be too tight, try using 2
    _bidToMidSlippage : 1, //This is the price impact of the size of your trade, the trade may fail because the size is too big or the liquidity pool is too shallow
                        // set to 0 to ignore price impact of the size of the trade
    _gasApprovalLimit :  100000, // usually you only need 45k for a contract approval, it won't spend more than needed
    _gasTradingLimit :  350000 // swapexacttokensfortokens should only take 180k on v1, but this should give some buffer
}

module.exports = {
    globalParams: globalParams
}
