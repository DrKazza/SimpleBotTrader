
// To bring in private details
require("dotenv").config();
const secretKey = process.env.SECRETKEY;
const walletAddress = process.env.WALLETADDRESS;


// BSC & PCS Libraries
const ethers = require('ethers');
const Web3 = require('web3');
const abi = require('human-standard-token-abi');
const {ChainId, Token, TokenAmount, Fetcher: v2Fetcher, Pair, Route, Trade, TradeType, Percent} = require('@pancakeswap-libs/sdk-v2');
const {JsonRpcProvider} = require("@ethersproject/providers");
const url = 'https://bsc-dataseed1.binance.org/';
const provider = new JsonRpcProvider('https://bsc-dataseed1.binance.org/');
const web3 = new Web3(url);

// To get the trade settings
const {tradeParameters} = require('./trading.params.js');
const {globalParams} = require('./global.params.js');
const {checkVariableValidity, checkInitialSettings, verboseTradeDescription} = require('./input-checks.js');

// other functions
const d = new Date();
const dateStamp = d.getFullYear()*10000 + (d.getMonth() + 1) *100 + d.getDate();
const {confirmDialog, appendTradeLog, delay} = require('./tradelog-code.js');
const fs = require("fs");
const tradingParams = require("./trading.params.js");
const maxUint256 = web3.utils.toBN(2).pow(web3.utils.toBN(256)).sub(web3.utils.toBN(1));

const wallet = ethers.Wallet.fromMnemonic(secretKey);
const account = wallet.connect(provider);

// a few fixed variables
const cleanAddress = (thisTokenAddress) => {
    if (thisTokenAddress === 'BNB') {
        return Web3.utils.toChecksumAddress(globalParams._wbnbAddress);
    } else {
        return Web3.utils.toChecksumAddress(thisTokenAddress);
    }
}
const lpRouter = cleanAddress(globalParams._pcsLPV2);
const wbnbAddress = cleanAddress(globalParams._wbnbAddress);
const WBNBTOK = new Token(ChainId.MAINNET, wbnbAddress, 18);
const busdAddress = cleanAddress(globalParams._busdAddress);
const BUSDTOK = new Token(ChainId.MAINNET, busdAddress, 18);
const routerV2 = new ethers.Contract (lpRouter, [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ], account );
const minBnbToTrade = ethers.utils.parseUnits(globalParams._minBnbToTrade.toString(), 18)



// ***************************
// FUNCTIONS READING THE CHAIN
// ***************************
// Token and LP attributes
// Checking and changing allowance of the LP to spend tokens on your behalf
const getAllowance = async (tickerTokenAddress, thisWalletAddress, liquidityPoolAddress) => {
    let contract = new web3.eth.Contract(abi, tickerTokenAddress);
    let approvalLimit = await contract.methods.allowance(thisWalletAddress, liquidityPoolAddress);
    return approvalLimit;
}

const getDecimals = async (tickerTokenAddress) => {
    let contract = new web3.eth.Contract(abi, tickerTokenAddress);
    let decimals = await contract.methods.decimals().call();
    return decimals;
}

const getTokenTicker = async (tickerTokenAddress) => {
    var contract = new web3.eth.Contract(abi, tickerTokenAddress);
    let symbolTicker = await contract.methods.symbol().call();
    return symbolTicker;
}

const getWalletBalance = async (tickerTokenAddress, thisWalletAddress) => {
    let balance = 0;
    if (tickerTokenAddress === wbnbAddress) {
        balance = await web3.eth.getBalance(thisWalletAddress);
    } else {
        let contract = new web3.eth.Contract(abi, tickerTokenAddress);
        balance = await contract.methods.balanceOf(thisWalletAddress).call();
    }
    return balance;
}

// Pricing information
const getDirectMid = async (buyAddress, buyDecimals, sellAddress, sellDecimals) => {
    let BUYTOK = new Token(ChainId.MAINNET, buyAddress, buyDecimals); 
    let SELLTOK = new Token(ChainId.MAINNET, sellAddress, sellDecimals); 
    let pair = await v2Fetcher.fetchPairData(BUYTOK, SELLTOK, provider);    
    let route = new Route([pair], SELLTOK);
    let spotPrice = await route.midPrice.toSignificant(6);
    return spotPrice;
}

const getViaBNBMid = async (buyAddress, buyDecimals, sellAddress, sellDecimals) => {
    let BUYTOK = new Token(ChainId.MAINNET, buyAddress, buyDecimals); 
    let SELLTOK = new Token(ChainId.MAINNET, sellAddress, sellDecimals); 
    let pair1 = null;
    let pair2 = null;
    pair1 = await v2Fetcher.fetchPairData(SELLTOK, WBNBTOK, provider);
    pair2 = await v2Fetcher.fetchPairData(WBNBTOK, BUYTOK, provider);
    let route = new Route([pair1, pair2], SELLTOK);
    let spotPrice = await route.midPrice.toSignificant(6);
    return spotPrice;
}

const getDirectBid = async (buyAddress, buyDecimals, sellAddress, sellDecimals, sellAmount) => {
    console.log ('getting direct bid')
    try {
        let BUYTOK = new Token(ChainId.MAINNET, buyAddress, buyDecimals); 
        let SELLTOK = new Token(ChainId.MAINNET, sellAddress, sellDecimals);
        let pair = await v2Fetcher.fetchPairData(BUYTOK, SELLTOK, provider);
        let route = new Route([pair], SELLTOK);
        let trade = new Trade(route, new TokenAmount(SELLTOK, sellAmount), TradeType.EXACT_INPUT)
        let bidPrice = await trade.executionPrice.toSignificant(6);
        return bidPrice
    } catch (error) {
        console.log (`no direct bid`)
        return -1;
    }
}

const getViaBNBBid = async (buyAddress, buyDecimals, sellAddress, sellDecimals, sellAmount) => {
    console.log ('getting viabnb bid')
    try {    
        let BUYTOK = new Token(ChainId.MAINNET, buyAddress, buyDecimals); 
        let SELLTOK = new Token(ChainId.MAINNET, sellAddress, sellDecimals);
        let pair1 = await v2Fetcher.fetchPairData(SELLTOK, WBNBTOK, provider);
        let pair2 = await v2Fetcher.fetchPairData(WBNBTOK, BUYTOK, provider);
        let route = new Route([pair1, pair2], SELLTOK);
        let trade = new Trade(route, new TokenAmount(SELLTOK, sellAmount), TradeType.EXACT_INPUT)
        let bidPrice = await trade.executionPrice.toSignificant(6);
        return bidPrice
    } catch (error) {
        console.log (`no bid via BNB (that's a bit odd!)`)
        return -1;
    }
}

// ******************************
// FUNCTIONS WRITING TO THE CHAIN
// ******************************

const getApproval = async (thisTokenAddress, approvalAmount, walletAccount, liquidtyPoolRouter = lpRouter, thisGasPrice, thisGasLimit)  => {
    let contract = new ethers.Contract(thisTokenAddress, abi, walletAccount);
    let approveResponse = await contract.approve(
        liquidtyPoolRouter, 
        approvalAmount,
        {
            gasLimit: thisGasLimit, 
            gasPrice: ethers.utils.parseUnits(thisGasPrice.toString(), 'gwei')
        });
    console.log(approveResponse);
    return;
}

const swapExactBNBForTokens = async (buyAddress, tokensIn, tradeSlippage, thisGasPrice, thisGasLimit) => {
    let amountIn = tokensIn.toString();
    let amounts = await routerV2.getAmountsOut(amountIn, [wbnbAddress, buyAddress]);
    let amountOutMin = amounts[1].sub(amounts[1].mul(tradeSlippage.toString()).div('100'));
    let tx = await routerV2.swapExactETHForTokens(
        amountOutMin,
        [wbnbAddress, buyAddress],
        walletAddress,
        Date.now() + 1000 * 60 * 10, //10 minutes
        {
            value: amountIn,
            gasLimit: thisGasLimit, 
            gasPrice: ethers.utils.parseUnits(thisGasPrice.toString(), 'gwei')
        }
    )
    console.log(`Transaction Submitted...`);
    let receipt = await tx.wait();
    console.log(receipt);
    return receipt;
}

const swapExactTokensForBNB = async (sellAddress, tokensIn, tradeSlippage, thisGasPrice, thisGasLimit) => {
    let amountIn = tokensIn.toString()
    let amounts = await routerV2.getAmountsOut(amountIn, [sellAddress, wbnbAddress]);
    let amountOutMin = amounts[1].sub(amounts[1].mul(tradeSlippage.toString()).div('100'));
    let tx = await routerV2.swapExactTokensForETH(
        amountIn, 
        amountOutMin,
        [sellAddress, wbnbAddress],
        walletAddress,
        Date.now() + 1000 * 60 * 10, //10 minutes
        {
            gasLimit: thisGasLimit, 
            gasPrice: ethers.utils.parseUnits(thisGasPrice.toString(), 'gwei')
        }
    )
    console.log(`Transaction Submitted...`);
    let receipt = await tx.wait();
    console.log(receipt);
    return receipt;
}

const swapExactTokForTok = async (buyAddress, sellAddress, tokensIn, tradeSlippage, thisGasPrice, thisGasLimit) => {
    let amountIn = tokensIn.toString()
    let amounts = await routerV2.getAmountsOut(amountIn, [sellAddress, buyAddress]);
    let amountOutMin = amounts[1].sub(amounts[1].mul(tradeSlippage.toString()).div('100'));
    let tx = await routerV2.swapExactTokensForTokens(
        amountIn, 
        amountOutMin,
        [sellAddress, buyAddress],
        walletAddress,
        Date.now() + 1000 * 60 * 10, //10 minutes
        {
            gasLimit: thisGasLimit, 
            gasPrice: ethers.utils.parseUnits(thisGasPrice.toString(), 'gwei')
        }
    )
    console.log(`Transaction Submitted...`);
    let receipt = await tx.wait();
    console.log(receipt);
    return receipt;
}

const swapExactTokForTokViaBNB = async (buyAddress, sellAddress, tokensIn, tradeSlippage, thisGasPrice, thisGasLimit) => {
    let amountIn = tokensIn.toString()
    let amounts = await routerV2.getAmountsOut(amountIn, [sellAddress, buyAddress]);
    let amountOutMin = amounts[1].sub(amounts[1].mul(tradeSlippage.toString()).div('100'));
    let tx = await routerV2.swapExactTokensForTokens(
        amountIn, 
        amountOutMin,
        [sellAddress, wbnbAddress, buyAddress],
        walletAddress,
        Date.now() + 1000 * 60 * 10, //10 minutes
        {
            gasLimit: thisGasLimit, 
            gasPrice: ethers.utils.parseUnits(thisGasPrice.toString(), 'gwei')
        }
    )
    console.log(`Transaction Submitted...`);
    let receipt = await tx.wait();
    console.log(receipt);
    return receipt;
}






// *****************
// HANDLER FUNCTIONS
// *****************

const confirmAndExtendAllowance = async (thisTokenAddress, walletAddress, liquidityPoolAddress, thisTokenTicker) => {
    if (thisTokenAddress === wbnbAddress) { return true; } else {        
        let currentAllowance = await getAllowance(thisTokenAddress, walletAddress, liquidityPoolAddress);
        if (currentAllowance < maxUint256) {
            console.log(`Getting approval for ${thisTokenTicker}`)
            await getApproval(thisTokenAddress, maxUint256, account, globalParams._pcsLPV2, globalParams._gasPrice, globalParams._gasApprovalAmount);
            return true;
        } else {
            console.log(`No Approval needed for ${thisTokenTicker}`)
            return false;
        }
    }
}


const getMidPrice = async (buyAddress, buyDecimals, sellAddress, sellDecimals) => {
    if (buyAddress === wbnbAddress || sellAddress === wbnbAddress) {
        let midPrice = await getDirectMid (buyAddress, buyDecimals, sellAddress, sellDecimals);
        return midPrice;
    } else {
        let midPrice = await getViaBNBMid (buyAddress, buyDecimals, sellAddress, sellDecimals);
        return midPrice;

    }
}

const amountToSell = (assetAddress, assetDecimals, assetBalance, moonBag) => {
    let dontSell = ethers.utils.parseUnits(moonBag.toString(), assetDecimals);
    if (assetAddress === wbnbAddress) { dontSell += ethers.utils.parseUnits(globalParams._keepBNB.toString(), 18) }
    return Math.max(assetBalance - dontSell, 0);
}

const getBnbEquivalent = async (thisTokenAddress, thisTokenDecimals, tokenAmount) => {
    if (thisTokenAddress === wbnbAddress) {
        return tokenAmount;
    } else {
        let midPrice = await getDirectMid(thisTokenAddress, thisTokenDecimals, wbnbAddress, 18);
        return tokenAmount * midPrice;
    }
}

const getBestPrice = async (buyAddress, buyDecimals, sellAddress, sellDecimals, sellAmount) => {
    // returns an array of [best bid, best route]
    let bestRoute = 'Direct';
    let bestBid = await getDirectBid (buyAddress, buyDecimals, sellAddress, sellDecimals, sellAmount);
    console.log(bestBid + 'Direct Best Bid')
    if (buyAddress === wbnbAddress || sellAddress === wbnbAddress) {
        return [1 / bestBid, bestRoute];
    } else {
        let viaBNBBid = await getViaBNBBid (buyAddress, buyDecimals, sellAddress, sellDecimals, sellAmount);
        console.log(bestBid + 'via BNB Best Bid')

        if (viaBNBBid < bestBid || bestBid <= 0) {
            bestBid = viaBNBBid;
            bestRoute = 'viaBNB'
        }
        return [1 / bestBid, bestRoute];
        // you return 1 / best bid to get the price
// NEED TO CHECK THIS LOGIC FOR A BUY AS WELL AS A SELL!        
    }
}

const executeTrade = async (buyAddress, sellAddress, amountToSpend, executionSlippage, gasPrice, gasTradingLimit, bestRoute, logstream) => {
    var receipt = []
    if (bestRoute === 'viaBNB') {
        receipt = await swapExactTokForTokViaBNB(buyAddress, sellAddress, amountToSpend, executionSlippage, gasPrice, gasTradingLimit);
    } else if (buyAddress === wbnbAddress) {
        receipt = await swapExactTokensForBNB(sellAddress, amountToSpend, executionSlippage, gasPrice, gasTradingLimit);
    } else if (sellAddress === wbnbAddress) {
        receipt = await swapExactBNBForTokens(buyAddress, amountToSpend, executionSlippage, gasPrice, gasTradingLimit);
    } else {
        receipt = await swapExactTokForTok(buyAddress, sellAddress, amountToSpend, executionSlippage, gasPrice, gasTradingLimit);
    }
    appendTradeLog(logstream, receipt);
}




// *******************************************
// Execution mechanics of different tradeTypes
// *******************************************

// *********************
// BUY/SELL PRICE LIMITS
// *********************
const executeBSPL = async (thisTradePair, newPrice, logstream) => {
    let buyPrice = thisTradePair.buyPrice
    let sellPrice = thisTradePair.sellPrice 

    if (buyPrice <= 0 || buyPrice < newPrice) {
        // don't try to buy anything
    } else {
        let sellAssetBalance = await getWalletBalance(thisTradePair.sellAddress, walletAddress);
        let amountToSpend = amountToSell(thisTradePair.sellAddress, thisTradePair.sellDecimals, sellAssetBalance, thisTradePair.sellMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother, also don't output this to the logfile
            console.log(`Can't buy ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB Equivalents\n`);
            return;
        }
        let textAmountToSpend = (amountToSpend/(web3.utils.toBN(10).pow(web3.utils.toBN(thisTradePair.sellDecimals)))).toPrecision(6) 
        appendTradeLog(logstream, `Spending ${textAmountToSpend} ${thisTradePair.sellTicker} tokens on ${thisTradePair.buyTicker}\n`);
        // look at the mid and compare to direct bid and viabnb bid (if appropriate)
        let bestPriceAndRoute = await getBestPrice(thisTradePair.buyAddress, thisTradePair.buyDecimals, thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bestPriceAndRoute[0] === -1) {
            appendTradeLog(logstream, `NO BIDS POSSIBLE FROM THE LPROUTER`)
            tradeParameters[thisTradePair.pairname].activate = false;
            return;
        }        
        if (thisTradePair.overrideSlippage > 0) {
            let thisbidToMidSlippage = Math.abs(newPrice - bestPriceAndRoute[0])*100/newPrice;
            if (thisbidToMidSlippage > globalParams._bidToMidSlippage) {
                appendTradeLog(logstream, `Price impact of the size of this trade is too big ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` Aboutto hit up a buy trade hoping for ${bestPriceAndRoute[0]}`);
        await executeTrade(thisTradePair.buyAddress, thisTradePair.sellAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
    }


    if (sellPrice <= 0 || sellPrice > newPrice) {
        // don't try to sell anything
    } else {
        // remember you're now selling the 'Buy asset' and that the price that comes back from the router needs to be inverted
        let buyAssetBalance = await getWalletBalance(thisTradePair.buyAddress, walletAddress);
        let amountToSpend = amountToSell(thisTradePair.buyAddress, thisTradePair.buyDecimals, buyAssetBalance, thisTradePair.buyMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother
            appendTradeLog(logstream, `Can't sell ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB Equivalents\n`);
            return;
        } 
        let textAmountToSpend = (amountToSpend/(web3.utils.toBN(10).pow(web3.utils.toBN(thisTradePair.sellDecimals)))).toPrecision(6) 
        appendTradeLog(logstream, `Selling ${textAmountToSpend} ${thisTradePair.buyTicker} tokens for ${thisTradePair.sellTicker}\n`);
        // look at the mid and compare to direct bid and viabnb bid (if appropriate)
        let bestPriceAndRoute = await getBestPrice(thisTradePair.sellAddress, thisTradePair.sellDecimals, thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);
        if (bestPriceAndRoute[0] === -1) {
            appendTradeLog(logstream, `NO BIDS POSSIBLE FROM THE LPROUTER`)
            tradeParameters[thisTradePair.pairname].activate = false;
            return;
        }
        if (globalParams._bidToMidSlippage > 0) {
            let thisbidToMidSlippage = Math.abs(newPrice - bestPriceAndRoute[0])*100/newPrice;
            if (thisbidToMidSlippage > globalParams._bidToMidSlippage) {
                appendTradeLog(logstream, `Price impact of the size of this trade is too big ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` Aboutto hit up a sell trade hoping for ${bestPriceAndRoute[0]}`);
        await executeTrade(thisTradePair.sellAddress, thisTradePair.buyAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
    }
}





// ***************
// DEAD CAT BOUNCE
// ***************
const executeDCB = async (thisTradePair, newPrice, logstream) => {
    let buyPrice = thisTradePair.buyPriceDCB
    let sellPrice = 0;
    if (typeof thisTradePair.sellPriceDCB === 'undefined') {
        sellPrice = 0;
    } else {
        sellPrice = thisTradePair.sellPriceDCB;
    }

    if (buyPrice <= 0 || buyPrice < newPrice) {
        // don't try to buy anything
    } else {
        let sellAssetBalance = await getWalletBalance(thisTradePair.sellAddress, walletAddress);
        let amountToSpend = amountToSell(thisTradePair.sellAddress, thisTradePair.sellDecimals, sellAssetBalance, thisTradePair.sellMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother, also don't output this to the logfile
            console.log(`Can't buy ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB Equivalents\n`);
            return;
        }
        let textAmountToSpend = (amountToSpend/(web3.utils.toBN(10).pow(web3.utils.toBN(thisTradePair.sellDecimals)))).toPrecision(6) 
        appendTradeLog(logstream, `Spending ${textAmountToSpend} ${thisTradePair.sellTicker} tokens on ${thisTradePair.buyTicker}\n`);
        // look at the mid and compare to direct bid and viabnb bid (if appropriate)
        let bestPriceAndRoute = await getBestPrice(thisTradePair.buyAddress, thisTradePair.buyDecimals, thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bestPriceAndRoute[0] === -1) {
            appendTradeLog(logstream, `NO BIDS POSSIBLE FROM THE LPROUTER`)
            tradeParameters[thisTradePair.pairname].activate = false;
            return;
        }
        if (globalParams._bidToMidSlippage > 0) {
            let thisbidToMidSlippage = Math.abs(newPrice - bestPriceAndRoute[0])*100/newPrice;
            if (thisbidToMidSlippage > globalParams._bidToMidSlippage) {
                appendTradeLog(logstream, `Price impact of the size of this trade is too big ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` Aboutto hit up a buy trade hoping for ${bestPriceAndRoute[0]}`);
        await executeTrade(thisTradePair.buyAddress, thisTradePair.sellAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        tradeParameters[thisTradePair.pairname].sellPriceDCB = bestPriceAndRoute[0] * (1 + thisTradePair.sellPctDCB / 100);
    }


    if (sellPrice <= 0 || sellPrice > newPrice) {
        // don't try to sell anything
    } else {
        // remember you're now selling the 'Buy asset' and that the price that comes back from the router needs to be inverted
        let buyAssetBalance = await getWalletBalance(thisTradePair.buyAddress, walletAddress);
        let amountToSpend = amountToSell(thisTradePair.buyAddress, thisTradePair.buyDecimals, buyAssetBalance, thisTradePair.buyMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);

        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother
            appendTradeLog(logstream, `Can't sell ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB Equivalents\n`);
            return;
        } 
        let textAmountToSpend = (amountToSpend/(web3.utils.toBN(10).pow(web3.utils.toBN(thisTradePair.sellDecimals)))).toPrecision(6) 
        appendTradeLog(logstream, `Selling ${textAmountToSpend} ${thisTradePair.buyTicker} tokens for ${thisTradePair.sellTicker}\n`);
        // look at the mid and compare to direct bid and viabnb bid (if appropriate)
        let bestPriceAndRoute = await getBestPrice(thisTradePair.sellAddress, thisTradePair.sellDecimals, thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);
        if (bestPriceAndRoute[0] === -1) {
            appendTradeLog(logstream, `NO BIDS POSSIBLE FROM THE LPROUTER`)
            tradeParameters[thisTradePair.pairname].activate = false;
            return;
        }
        bestPriceAndRoute[0] = 1 / bestPriceAndRoute[0];
        if (globalParams._bidToMidSlippage > 0) {
            let thisbidToMidSlippage = Math.abs(newPrice - bestPriceAndRoute[0])*100/newPrice;
            if (thisbidToMidSlippage > globalParams._bidToMidSlippage) {
                appendTradeLog(logstream, `Price impact of the size of this trade is too big ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` Aboutto hit up a sell trade hoping for ${bestPriceAndRoute[0]}`);
        await executeTrade(thisTradePair.sellAddress, thisTradePair.buyAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        if (thisTradePair.stopAfterOneBounceDCB) {
            // kill the process altogether
            tradeParameters[thisTradePair.pairname].activate = false;
            appendTradeLog(logstream, `Sell executed after dead cat bounce - no further trading`)
        } else {
            // turn off the sale and wait for new buy
            tradeParameters[thisTradePair.pairname].sellPriceDCB = -1;
        }
    }
}





// ************************
// PERCENTAGE RANGE TRADING
// ************************
const executePRT = async (thisTradePair, newPrice, logstream) => {
    let buyPrice = 0;
    let sellPrice = 0;
    if (typeof thisTradePair.buyPricePRT === 'undefined' || typeof thisTradePair.sellPricePRT === 'undefined') {
        // the first loop - lets set the buy and sells at HALF the percentage width
        buyPrice = newPrice * (1 - thisTradePair.buyPctPRT / 200);
        sellPrice = newPrice * (1 + thisTradePair.sellPctPRT / 200);
        tradeParameters[thisTradePair.pairname].buyPricePRT = buyPrice;
        tradeParameters[thisTradePair.pairname].sellPricePRT = sellPrice;
    } else {
        buyPrice = thisTradePair.buyPricePRT;
        sellPrice = thisTradePair.sellPricePRT;
    };

    if (buyPrice <= 0 || buyPrice < newPrice) {
        // don't try to buy anything
    } else {
        let sellAssetBalance = await getWalletBalance(thisTradePair.sellAddress, walletAddress);
        let amountToSpend = amountToSell(thisTradePair.sellAddress, thisTradePair.sellDecimals, sellAssetBalance, thisTradePair.sellMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother, also don't output this to the logfile
            console.log(`Can't buy ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB Equivalents\n`);
            return;
        }
        let textAmountToSpend = (amountToSpend/(web3.utils.toBN(10).pow(web3.utils.toBN(thisTradePair.sellDecimals)))).toPrecision(6) 
        appendTradeLog(logstream, `Spending ${textAmountToSpend} ${thisTradePair.sellTicker} tokens on ${thisTradePair.buyTicker}\n`);
        // look at the mid and compare to direct bid and viabnb bid (if appropriate)
        let bestPriceAndRoute = await getBestPrice(thisTradePair.buyAddress, thisTradePair.buyDecimals, thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bestPriceAndRoute[0] === -1) {
            appendTradeLog(logstream, `NO BIDS POSSIBLE FROM THE LPROUTER`)
            tradeParameters[thisTradePair.pairname].activate = false;
            return;
        }
        if (globalParams._bidToMidSlippage > 0) {
            let thisbidToMidSlippage = Math.max(newPrice - bestPriceAndRoute[0], 0)*100/newPrice;
            if (thisbidToMidSlippage > globalParams._bidToMidSlippage) {
                appendTradeLog(logstream, `Price impact of the size of this trade is too big ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` Aboutto hit up a buy trade hoping for ${bestPriceAndRoute[0]}`);
        await executeTrade(thisTradePair.buyAddress, thisTradePair.sellAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        tradeParameters[thisTradePair.pairname].sellPricePRT = bestPriceAndRoute[0] * (1 + thisTradePair.sellPctPRT / 100);
    }
    if (sellPrice <= 0 || sellPrice > newPrice) {
        // don't try to sell anything
    } else {
        // remember you're now selling the 'Buy asset' and that the price that comes back from the router needs to be inverted
        let buyAssetBalance = await getWalletBalance(thisTradePair.buyAddress, walletAddress);
        let amountToSpend = amountToSell(thisTradePair.buyAddress, thisTradePair.buyDecimals, buyAssetBalance, thisTradePair.buyMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);

        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother
            appendTradeLog(logstream, `Can't sell ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB Equivalents\n`);
            return;
        } 
        let textAmountToSpend = (amountToSpend/(web3.utils.toBN(10).pow(web3.utils.toBN(thisTradePair.sellDecimals)))).toPrecision(6) 
        appendTradeLog(logstream, `Selling ${textAmountToSpend} ${thisTradePair.buyTicker} tokens for ${thisTradePair.sellTicker}\n`);
        // look at the mid and compare to direct bid and viabnb bid (if appropriate)
        let bestPriceAndRoute = await getBestPrice(thisTradePair.sellAddress, thisTradePair.sellDecimals, thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);
        if (bestPriceAndRoute[0] === -1) {
            appendTradeLog(logstream, `NO BIDS POSSIBLE FROM THE LPROUTER`)
            tradeParameters[thisTradePair.pairname].activate = false;
            return;
        }
        bestPriceAndRoute[0] = 1 / bestPriceAndRoute[0];
        if (globalParams._bidToMidSlippage > 0) {
            let thisbidToMidSlippage = Math.max(newPrice - bestPriceAndRoute[0],0)*100/newPrice;
            if (thisbidToMidSlippage > globalParams._bidToMidSlippage) {
                appendTradeLog(logstream, `Price impact of the size of this trade is too big ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` Aboutto hit up a sell trade hoping for ${bestPriceAndRoute[0]}`);
        await executeTrade(thisTradePair.sellAddress, thisTradePair.buyAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        tradeParameters[thisTradePair.pairname].buyPricePRT = bestPriceAndRoute[0] * (1 - thisTradePair.buyPctPRT / 100);
    }
}



// *********
// STOP LOSS
// *********
const executeSL = async (thisTradePair, newPrice, logstream) => {
    let buyPrice = thisTradePair.buySTOPPrice;
    let sellPrice = thisTradePair.sellSTOPPrice; 

    if (buyPrice <= 0 || buyPrice > newPrice) {
        // don't try to buy anything
    } else {
        let sellAssetBalance = await getWalletBalance(thisTradePair.sellAddress, walletAddress);
        let amountToSpend = amountToSell(thisTradePair.sellAddress, thisTradePair.sellDecimals, sellAssetBalance, thisTradePair.sellMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother, also don't output this to the logfile
            console.log(`Can't buy ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB Equivalents\n`);
            return;
        }
        let textAmountToSpend = (amountToSpend/(web3.utils.toBN(10).pow(web3.utils.toBN(thisTradePair.sellDecimals)))).toPrecision(6) 
        appendTradeLog(logstream, `Spending ${textAmountToSpend} ${thisTradePair.sellTicker} tokens on ${thisTradePair.buyTicker}\n`);
        // look at the mid and compare to direct bid and viabnb bid (if appropriate)
        let bestPriceAndRoute = await getBestPrice(thisTradePair.buyAddress, thisTradePair.buyDecimals, thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bestPriceAndRoute[0] === -1) {
            appendTradeLog(logstream, `NO BIDS POSSIBLE FROM THE LPROUTER`)
            tradeParameters[thisTradePair.pairname].activate = false;
            return;
        }
        if (globalParams._bidToMidSlippage > 0) {
            let thisbidToMidSlippage = Math.abs(newPrice - bestPriceAndRoute[0])*100/newPrice;
            if (thisbidToMidSlippage > globalParams._bidToMidSlippage) {
                appendTradeLog(logstream, `Price impact of the size of this trade is too big ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` Aboutto hit up a buy trade hoping for ${bestPriceAndRoute[0]}`);
        await executeTrade(thisTradePair.buyAddress, thisTradePair.sellAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
    }


    if (sellPrice <= 0 || sellPrice < newPrice) {
        // don't try to sell anything
    } else {
        // remember you're now selling the 'Buy asset' and that the price that comes back from the router needs to be inverted
        let buyAssetBalance = await getWalletBalance(thisTradePair.buyAddress, walletAddress);
        let amountToSpend = amountToSell(thisTradePair.buyAddress, thisTradePair.buyDecimals, buyAssetBalance, thisTradePair.buyMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);

        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother
            appendTradeLog(logstream, `Can't sell ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB Equivalents\n`);
            return;
        } 
        let textAmountToSpend = (amountToSpend/(web3.utils.toBN(10).pow(web3.utils.toBN(thisTradePair.sellDecimals)))).toPrecision(6) 
        appendTradeLog(logstream, `Selling ${textAmountToSpend} ${thisTradePair.buyTicker} tokens for ${thisTradePair.sellTicker}\n`);
        // look at the mid and compare to direct bid and viabnb bid (if appropriate)
        let bestPriceAndRoute = await getBestPrice(thisTradePair.sellAddress, thisTradePair.sellDecimals, thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);
        if (bestPriceAndRoute[0] === -1) {
            appendTradeLog(logstream, `NO BIDS POSSIBLE FROM THE LPROUTER`)
            tradeParameters[thisTradePair.pairname].activate = false;
            return;
        }
        bestPriceAndRoute[0] = 1 / bestPriceAndRoute[0];
        if (globalParams._bidToMidSlippage > 0) {
            let thisbidToMidSlippage = Math.abs(newPrice - bestPriceAndRoute[0])*100/newPrice;
            if (thisbidToMidSlippage > globalParams._bidToMidSlippage) {
                appendTradeLog(logstream, `Price impact of the size of this trade is too big ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` Aboutto hit up a sell trade hoping for ${bestPriceAndRoute[0]}`);
        await executeTrade(thisTradePair.sellAddress, thisTradePair.buyAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
    }
}




// ******************
// TRAILING STOP LOSS
// ******************
const executeTSL = async (thisTradePair, newPrice, logstream) => {

    let buyPrice = 0;
    let sellPrice = 0;
    if (typeof thisTradePair.buyPriceTSL === 'undefined' || typeof thisTradePair.sellPriceTSL === 'undefined') {
        // the first loop - lets set the buy and sells at HALF the percentage width
        buyPrice = newPrice * (1 + thisTradePair.buySTOPPctTSL / 100);
        sellPrice = newPrice * (1 - thisTradePair.sellSTOPPctTSL / 100);
    } else {
        buyPrice = Math.min(thisTradePair.buyPricePRT, newPrice * (1 + thisTradePair.buySTOPPctTSL / 100));
        sellPrice = Math.max(thisTradePair.sellPricePRT, newPrice * (1 - thisTradePair.sellSTOPPctTSL / 100));
    };
    tradeParameters[thisTradePair.pairname].buyPriceTSL = buyPrice;
    tradeParameters[thisTradePair.pairname].sellPriceTSL = sellPrice;
    // when you execute a buy you turn off the buy signal and turn on the sell signal
    // likewise when you sell you turn on the buy and turn off the sell

    if (buyPrice < 0 || buyPrice > newPrice || thisTradePair.buySTOPPctTSL <= 0) {
        // don't try to buy anything
    } else {
        let sellAssetBalance = await getWalletBalance(thisTradePair.sellAddress, walletAddress);
        let amountToSpend = amountToSell(thisTradePair.sellAddress, thisTradePair.sellDecimals, sellAssetBalance, thisTradePair.sellMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother, also don't output this to the logfile
            console.log(`Can't buy ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB Equivalents\n`);
            return;
        }
        let textAmountToSpend = (amountToSpend/(web3.utils.toBN(10).pow(web3.utils.toBN(thisTradePair.sellDecimals)))).toPrecision(6) 
        appendTradeLog(logstream, `Spending ${textAmountToSpend} ${thisTradePair.sellTicker} tokens on ${thisTradePair.buyTicker}\n`);
        // look at the mid and compare to direct bid and viabnb bid (if appropriate)
        let bestPriceAndRoute = await getBestPrice(thisTradePair.buyAddress, thisTradePair.buyDecimals, thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bestPriceAndRoute[0] === -1) {
            appendTradeLog(logstream, `NO BIDS POSSIBLE FROM THE LPROUTER`)
            tradeParameters[thisTradePair.pairname].activate = false;
            return;
        }
        if (globalParams._bidToMidSlippage > 0) {
            let thisbidToMidSlippage = Math.abs(newPrice - bestPriceAndRoute[0])*100/newPrice;
            if (thisbidToMidSlippage > globalParams._bidToMidSlippage) {
                appendTradeLog(logstream, `Price impact of the size of this trade is too big ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` Aboutto hit up a buy trade hoping for ${bestPriceAndRoute[0]}`);
        await executeTrade(thisTradePair.buyAddress, thisTradePair.sellAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)

        // when you execute a buy you turn off the buy signal and turn on the sell signal
        // likewise when you sell you turn on the buy and turn off the sell
        tradeParameters[thisTradePair.pairname].buyPriceTSL = 0;
        tradeParameters[thisTradePair.pairname].sellPriceTSL = bestPriceAndRoute[0] * (1 - thisTradePair.sellSTOPPctTSL / 100);
    }


    if (sellPrice <= 0 || sellPrice < newPrice || thisTradePair.sellSTOPPctTSL <= 0) {
        // don't try to sell anything
    } else {
        // remember you're now selling the 'Buy asset' and that the price that comes back from the router needs to be inverted
        let buyAssetBalance = await getWalletBalance(thisTradePair.buyAddress, walletAddress);
        let amountToSpend = amountToSell(thisTradePair.buyAddress, thisTradePair.buyDecimals, buyAssetBalance, thisTradePair.buyMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);

        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother
            appendTradeLog(logstream, `Can't sell ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB Equivalents\n`);
            return;
        } 
        let textAmountToSpend = (amountToSpend/(web3.utils.toBN(10).pow(web3.utils.toBN(thisTradePair.sellDecimals)))).toPrecision(6) 
        appendTradeLog(logstream, `Selling ${textAmountToSpend} ${thisTradePair.buyTicker} tokens for ${thisTradePair.sellTicker}\n`);
        // look at the mid and compare to direct bid and viabnb bid (if appropriate)
        let bestPriceAndRoute = await getBestPrice(thisTradePair.sellAddress, thisTradePair.sellDecimals, thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);
        if (bestPriceAndRoute[0] === -1) {
            appendTradeLog(logstream, `NO BIDS POSSIBLE FROM THE LPROUTER`)
            tradeParameters[thisTradePair.pairname].activate = false;
            return;
        }
        bestPriceAndRoute[0] = 1 / bestPriceAndRoute[0];
        if (globalParams._bidToMidSlippage > 0) {
            let thisbidToMidSlippage = Math.abs(newPrice - bestPriceAndRoute[0])*100/newPrice;
            if (thisbidToMidSlippage > globalParams._bidToMidSlippage) {
                appendTradeLog(logstream, `Price impact of the size of this trade is too big ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` Aboutto hit up a sell trade hoping for ${bestPriceAndRoute[0]}`);
        await executeTrade(thisTradePair.sellAddress, thisTradePair.buyAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        // when you execute a buy you turn off the buy signal and turn on the sell signal
        // likewise when you sell you turn on the buy and turn off the sell
        tradeParameters[thisTradePair.pairname].buyPriceTSL = bestPriceAndRoute[0] * (1 + thisTradePair.buySTOPPctTSL / 100);
        tradeParameters[thisTradePair.pairname].sellPriceTSL = 0;
    }
}


// ********************
// MAIN BODY OF THE BOT
// ********************
const init = async () => {

    let startExecution = false;
    let executionCount = 0;

    // go through each trade one by one:
    for (let thisTradePair in tradeParameters) {
        // First of all check the parameters look good
        if (tradeParameters[thisTradePair].activate === true && thisTradePair !== 'template') {
            if (checkVariableValidity(globalParams, tradeParameters[thisTradePair])) {
                // so the inputs look correct - now clean the addresses.
                tradeParameters[thisTradePair].buyAddress = cleanAddress(tradeParameters[thisTradePair].buyAddress);
                tradeParameters[thisTradePair].sellAddress = cleanAddress(tradeParameters[thisTradePair].sellAddress);

                // Now check the price and the initial settings of the trade 
                let [buyDecimals, sellDecimals, buyTicker, sellTicker] = await Promise.all([
                    getDecimals(tradeParameters[thisTradePair].buyAddress),
                    getDecimals(tradeParameters[thisTradePair].sellAddress),
                    getTokenTicker(tradeParameters[thisTradePair].buyAddress),
                    getTokenTicker(tradeParameters[thisTradePair].sellAddress)    
                ])
                tradeParameters[thisTradePair].buyDecimals = buyDecimals;
                tradeParameters[thisTradePair].sellDecimals = sellDecimals;
                tradeParameters[thisTradePair].buyTicker = buyTicker;
                tradeParameters[thisTradePair].sellTicker = sellTicker;
                tradeParameters[thisTradePair].pairname = thisTradePair;
                if (typeof tradeParameters[thisTradePair].overrideSlippage === 'undefined') {
                    tradeParameters[thisTradePair].overrideSlippage = globalParams._executionSlippage;
                }

                var midPrice = await getMidPrice(tradeParameters[thisTradePair].sellAddress, sellDecimals, tradeParameters[thisTradePair].buyAddress, buyDecimals);
            } else {
                // initial variables are fkd don't do anything!
                return;
            }
            let verboseDialog =``;
            if (checkInitialSettings(tradeParameters[thisTradePair], midPrice)) {
                verboseDialog = await verboseTradeDescription(globalParams, tradeParameters[thisTradePair], midPrice);
                //  create log file
                var tickerStream = fs.createWriteStream(`TradeLog.${dateStamp}.txt`, {flags: 'a'});
                appendTradeLog(tickerStream, verboseDialog);
                startExecution = await confirmDialog(`If details look correct`)
                if (startExecution === 'Y' | startExecution === 'y') {
                    appendTradeLog(tickerStream, `Execution confirmed for ${thisTradePair}\n`);
                    let buyGoodAllowance = confirmAndExtendAllowance(tradeParameters[thisTradePair].buyAddress, walletAddress, globalParams._pcsLPV2, tradeParameters[thisTradePair].buyTicker)
                    let sellGoodAllowance = confirmAndExtendAllowance(tradeParameters[thisTradePair].sellAddress, walletAddress, globalParams._pcsLPV2, tradeParameters[thisTradePair].sellTicker)
                    if (buyGoodAllowance && sellGoodAllowance) {
                        executionCount++;
                    } else {
                        appendTradeLog(tickerStream, `Execution aborted for ${thisTradePair} at the allowance/approval stage.\n\n`);
                        tradeParameters[thisTradePair].activate = false;
                    }
                } else {
                    appendTradeLog(tickerStream, `Execution aborted for ${thisTradePair} at trade details checking stage.\n\n`);
                    tradeParameters[thisTradePair].activate = false;
                }
            } else {
                // initial boundaries are poorly set turn off the execution!
                tradeParameters[thisTradePair].activate = false;
            }
        }
    }
    if (executionCount > 0) {
        // there's at least one live trade - start looping through and checking price triggers etc.
        while (executionCount > 0) {
            await delay(5000);
            executionCount = 0;
            for (let thisTradePair in tradeParameters) {
                if (tradeParameters[thisTradePair].activate === true && thisTradePair !== 'template') {
                    executionCount += 1;
                    let newPrice = await getMidPrice(tradeParameters[thisTradePair].sellAddress, tradeParameters[thisTradePair].sellDecimals, tradeParameters[thisTradePair].buyAddress, tradeParameters[thisTradePair].buyDecimals);
                    console.log(`${thisTradePair}: (${tradeParameters[thisTradePair].sellTicker}/${tradeParameters[thisTradePair].buyTicker}) mid price: ${newPrice}`)
                    switch (tradeParameters[thisTradePair].tradeType) {
                        case 'BUY-SELL-PRICE-LIMITS':
                            await executeBSPL(tradeParameters[thisTradePair], newPrice, tickerStream);
                            break;
                        case 'DEAD-CAT-BOUNCE':
                            await executeDCB(tradeParameters[thisTradePair], newPrice, tickerStream);
                            break;
                        case 'PCT-RANGE-TRADING':
                            await executePRT(tradeParameters[thisTradePair], newPrice, tickerStream);
                            break;
                        case 'STOP-LOSS':
                            await executeSL(tradeParameters[thisTradePair], newPrice, tickerStream);
                            break;
                        case 'TRAILING-STOP-LOSS':
                            await executeTSL(tradeParameters[thisTradePair], newPrice, tickerStream);
                            break;
                    }
                }
            }
        }
        // update variables if necessary
    } else {
        // no active trades just kill loop
    }
}

init();

/* TO DO
8) CODING: MATIC
9) CODING: uniswap

*/


// WORKS WITH
// BUSD/BNB
// BUSD/CAKE