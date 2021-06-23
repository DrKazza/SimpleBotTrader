// if you're feeling grateful - pls chuck me some coins :)
// 0xcF3F6B64C216Fd624408F02c1F89FC330BEDA92F

// To bring in private details
require("dotenv").config();
const secretKey = process.env.SECRETKEY;
const walletAddress = process.env.WALLETADDRESS;


// BSC & PCS Libraries
const ethers = require('ethers');
const Web3 = require('web3');
const BN = Web3.utils.BN;
const abi = require('human-standard-token-abi');
const {Token, TokenAmount, Fetcher: v2Fetcher, Pair, Route, Trade, TradeType, Percent} = require('@pancakeswap-libs/sdk');
const {JsonRpcProvider} = require("@ethersproject/providers");

// To get the trade settings
const {tradeParameters} = require('./trading.paramsPCS.js');
const {globalParams} = require('./global.paramsPCS.js');
const {checkVariableValidity, checkInitialSettings, verboseTradeDescription} = require('./input-checksPCS.js');

const url = globalParams._rpcurl;
const provider = new JsonRpcProvider(url);
const web3 = new Web3(url);

// other functions
const d = new Date();
const dateStamp = d.getFullYear()*10000 + (d.getMonth() + 1) *100 + d.getDate();
const {confirmDialog, appendTradeLog, delay} = require('./tradelog-code.js');
const fs = require("fs");
const maxUint256 = ethers.constants.MaxUint256;
const sensibleLimit = ethers.BigNumber.from('9999999999999999999999999999999999999')

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
const chainID = globalParams._chainID;
const liveTrading = globalParams._liveTrading;
const wbnbAddress = cleanAddress(globalParams._wbnbAddress);
const WBNBTOK = new Token(chainID, wbnbAddress, 18);
const busdAddress = cleanAddress(globalParams._busdAddress);
const BUSDTOK = new Token(chainID, busdAddress, 18);
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
    let approvalLimit = await contract.methods.allowance(thisWalletAddress, liquidityPoolAddress).call();
    console.log(`approvalLimit: ${approvalLimit}`)
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
    let BUYTOK = new Token(chainID, buyAddress, buyDecimals); 
    let SELLTOK = new Token(chainID, sellAddress, sellDecimals); 
    let pair = await v2Fetcher.fetchPairData(BUYTOK, SELLTOK, provider);    
    let route = new Route([pair], SELLTOK);
    let spotPrice = await route.midPrice.toSignificant(6);
    return spotPrice;
}

const getViaBNBMid = async (buyAddress, buyDecimals, sellAddress, sellDecimals) => {
    let BUYTOK = new Token(chainID, buyAddress, buyDecimals); 
    let SELLTOK = new Token(chainID, sellAddress, sellDecimals); 
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
        let BUYTOK = new Token(chainID, buyAddress, buyDecimals); 
        let SELLTOK = new Token(chainID, sellAddress, sellDecimals);
        let pair = await v2Fetcher.fetchPairData(BUYTOK, SELLTOK, provider);
        let route = new Route([pair], SELLTOK);
        let trade = new Trade(route, new TokenAmount(SELLTOK, sellAmount), TradeType.EXACT_INPUT)
        let bidPrice = await trade.executionPrice.toSignificant(6);
        console.log (`direct bid: ${bidPrice}`)
        return bidPrice
    } catch (error) {
        console.log (`no direct bid`)
        return -1;
    }
}

const getViaBNBBid = async (buyAddress, buyDecimals, sellAddress, sellDecimals, sellAmount) => {
    console.log ('getting viabnb bid')
    try {    
        let BUYTOK = new Token(chainID, buyAddress, buyDecimals); 
        let SELLTOK = new Token(chainID, sellAddress, sellDecimals);
        let pair1 = await v2Fetcher.fetchPairData(SELLTOK, WBNBTOK, provider);
        let pair2 = await v2Fetcher.fetchPairData(WBNBTOK, BUYTOK, provider);
        let route = new Route([pair1, pair2], SELLTOK);
        let trade = new Trade(route, new TokenAmount(SELLTOK, sellAmount), TradeType.EXACT_INPUT)
        let bidPrice = await trade.executionPrice.toSignificant(6);
        console.log (`viabnb bid: ${bidPrice}`)
        return bidPrice
    } catch (error) {
        console.log (`no bid via BNB (that's a bit odd!)`)
        return -1;
    }
}

// ******************************
// FUNCTIONS WRITING TO THE CHAIN
// ******************************

const getApproval = async (thisTokenAddress, approvalLimit, walletAccount, liquidtyPoolRouter = lpRouter, thisGasPrice, thisGasLimit)  => {
    let contract = new ethers.Contract(thisTokenAddress, abi, walletAccount);
    if (liveTrading) {
        let approveResponse = await contract.approve(
            liquidtyPoolRouter, 
            approvalLimit,
            {
                gasLimit: thisGasLimit, 
                gasPrice: ethers.utils.parseUnits(thisGasPrice.toString(), 'gwei')
            });
        console.log(approveResponse);
        return;
    } else {
        console.log(`Live trading disabled - Approval increase NOT submitted.`)
        return
    }
}

const swapExactBNBForTokens = async (buyAddress, tokensIn, tradeSlippage, thisGasPrice, thisGasLimit) => {
    let amountIn = tokensIn.toString();
    let amounts = await routerV2.getAmountsOut(amountIn, [wbnbAddress, buyAddress]);
    let amountOutMin = amounts[1].sub(amounts[1].mul(tradeSlippage.toString()).div('100'));
    if (liveTrading) {
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
        return receipt;
    } else {
        console.log(`Live trading disabled - transaction NOT submitted.`)
    }
}

const swapExactTokensForBNB = async (sellAddress, tokensIn, tradeSlippage, thisGasPrice, thisGasLimit) => {
    let amountIn = tokensIn.toString()
    let amounts = await routerV2.getAmountsOut(amountIn, [sellAddress, wbnbAddress]);
    let amountOutMin = amounts[1].sub(amounts[1].mul(tradeSlippage.toString()).div('100'));
    if (liveTrading) {
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
        return receipt;
    } else {
        console.log(`Live trading disabled - transaction NOT submitted.`)
        return
    }
}

const swapExactTokForTok = async (buyAddress, sellAddress, tokensIn, tradeSlippage, thisGasPrice, thisGasLimit) => {
    let amountIn = tokensIn.toString()
    let amounts = await routerV2.getAmountsOut(amountIn, [sellAddress, buyAddress]);
    let amountOutMin = amounts[1].sub(amounts[1].mul(tradeSlippage.toString()).div('100'));
    if (liveTrading) {
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
        return receipt;
    } else {
        console.log(`Live trading disabled - transaction NOT submitted.`)
        return
    }
}

const swapExactTokForTokViaBNB = async (buyAddress, sellAddress, tokensIn, tradeSlippage, thisGasPrice, thisGasLimit) => {
    let amountIn = tokensIn.toString()
    let amounts = await routerV2.getAmountsOut(amountIn, [sellAddress, buyAddress]);
    let amountOutMin = amounts[1].sub(amounts[1].mul(tradeSlippage.toString()).div('100'));
    if (liveTrading) {
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
        return receipt;
    } else {
        console.log(`Live trading disabled - transaction NOT submitted.`)
        return
    }
}






// *****************
// HANDLER FUNCTIONS
// *****************

const getPairBalances = async (buyTokenAddress, sellTokenAddress, walletAddress) => {
    let [buyBalance, sellBalance] = await Promise.all([
        getWalletBalance(buyTokenAddress, walletAddress),
        getWalletBalance(sellTokenAddress, walletAddress)
    ]);
    return [buyBalance, sellBalance]
}

const confirmAndExtendAllowance = async (thisTokenAddress, walletAddress, liquidityPoolAddress, thisTokenTicker) => {
    if (thisTokenAddress === wbnbAddress) { return true; } else {        
        let currentAllowance = await getAllowance(thisTokenAddress, walletAddress, liquidityPoolAddress);
        let curAllowBN = ethers.BigNumber.from(currentAllowance.toString())
        if (curAllowBN.lte(sensibleLimit)) {
            console.log(`Getting approval for ${thisTokenTicker}`)
            await getApproval(thisTokenAddress, maxUint256, account, globalParams._pcsLPV2, globalParams._gasPrice, globalParams._gasApprovalLimit);
            return true;
        } else {
            console.log(`No Approval needed for ${thisTokenTicker}`)
            return false;
        }
    }
}


const getMidPrice = async (buyAddress, buyDecimals, sellAddress, sellDecimals) => {
    try {
        if (buyAddress === wbnbAddress || sellAddress === wbnbAddress) {
            let midPrice = await getDirectMid (buyAddress, buyDecimals, sellAddress, sellDecimals);
            return midPrice;
        } else {
            let midPrice = await getViaBNBMid (buyAddress, buyDecimals, sellAddress, sellDecimals);
            return midPrice;

        }
    } catch (error) {
        return -1
    }
}

const amountToSell = (assetAddress, assetDecimals, assetBalance, moonBag) => {
    let amtToSell = new BN(assetBalance);
    let dontSell = ethers.utils.parseUnits(moonBag.toString(), assetDecimals);
    if (assetAddress === wbnbAddress) { dontSell.add(ethers.utils.parseUnits(globalParams._keepBNB.toString(), 18)) }
    if (dontSell == 0) {
        return amtToSell
    } else if (dontSell >= amtToSell) {
        return 0
    } else {
        return amtToSell.sub(dontSell)
    } 
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
    console.log(bestBid + ' Direct Best Bid')
    if (buyAddress === wbnbAddress || sellAddress === wbnbAddress) {
        return [1 / bestBid, bestRoute];
    } else {
        let viaBNBBid = await getViaBNBBid (buyAddress, buyDecimals, sellAddress, sellDecimals, sellAmount);

        if (viaBNBBid > bestBid || bestBid <= 0) {
            bestBid = viaBNBBid;
            bestRoute = 'viaBNB'
        }
        return [1 / bestBid, bestRoute];
        // you return 1 / best bid to get the price
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
//    appendTradeLog(logstream, receipt);
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
    let initialBalances = [0, 0];
    if (buyPrice <= 0 || buyPrice < newPrice) {
        // don't try to buy anything
    } else {
        initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let sellAssetBalance = initialBalances[1];
        let amountToSpend = amountToSell(thisTradePair.sellAddress, thisTradePair.sellDecimals, sellAssetBalance, thisTradePair.sellMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother, also don't output this to the logfile
            console.log(`Can't buy ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
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
                appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage: ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` About to hit up a buy trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}\n`);
        await executeTrade(thisTradePair.buyAddress, thisTradePair.sellAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress);
        let actualPurchase = new BN(finalBalances[0]);
        actualPurchase = (actualPurchase - initialBalances[0]) / (10 ** thisTradePair.buyDecimals);
        let actualSale = new BN(initialBalances[1]);
        actualSale = (actualSale - finalBalances[1]) / (10 ** thisTradePair.sellDecimals);
        appendTradeLog(logstream, `********************
        Purchase successful:
        ********************
        Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.buyTicker})
        Sold ${actualSale.toPrecision(6)} (${thisTradePair.sellTicker})
        effective price: ${(actualSale / actualPurchase).toPrecision(6)}`);
    }


    if (sellPrice <= 0 || sellPrice > newPrice) {
        // don't try to sell anything
    } else {
        // remember you're now selling the 'Buy asset' and that the price that comes back from the router needs to be inverted
        initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let buyAssetBalance = initialBalances[0];
        let amountToSpend = amountToSell(thisTradePair.buyAddress, thisTradePair.buyDecimals, buyAssetBalance, thisTradePair.buyMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother
            console.log(`Can't sell ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
            return;
        } 
        let textAmountToSpend = (amountToSpend/(web3.utils.toBN(10).pow(web3.utils.toBN(thisTradePair.sellDecimals)))).toPrecision(6) 
        appendTradeLog(logstream, `Selling ${textAmountToSpend} ${thisTradePair.buyTicker} tokens for ${thisTradePair.sellTicker}\n`);
        // look at the mid and compare to direct bid and viabnb bid (if appropriate)
        let bestPriceAndRoute = await getBestPrice(thisTradePair.sellAddress, thisTradePair.sellDecimals, thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);
        bestPriceAndRoute[0] = 1 / bestPriceAndRoute[0];
        if (bestPriceAndRoute[0] === -1) {
            appendTradeLog(logstream, `NO BIDS POSSIBLE FROM THE LPROUTER`)
            tradeParameters[thisTradePair.pairname].activate = false;
            return;
        }
        if (globalParams._bidToMidSlippage > 0) {
            let thisbidToMidSlippage = Math.abs(newPrice - bestPriceAndRoute[0])*100/newPrice;
            if (thisbidToMidSlippage > globalParams._bidToMidSlippage) {
                appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage:  ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` About to hit up a sell trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}`);
        await executeTrade(thisTradePair.sellAddress, thisTradePair.buyAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let actualPurchase = new BN(finalBalances[1])
        actualPurchase = (actualPurchase - initialBalances[1]) / (10 ** thisTradePair.sellDecimals)
        let actualSale = new BN(initialBalances[0]) 
        actualSale = (actualSale - finalBalances[0]) / (10 ** thisTradePair.buyDecimals)
        appendTradeLog(logstream, `****************
        Sale successful:
        ****************
        Sold ${actualSale.toPrecision(6)} (${thisTradePair.buyTicker})
        Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.sellTicker})
        effective price: ${(actualPurchase / actualSale).toPrecision(6)}`);
    }
}





// ***************
// DEAD CAT BOUNCE
// ***************
const executeDCB = async (thisTradePair, newPrice, logstream) => {
    let buyPrice = thisTradePair.buyPriceDCB
    let sellPrice = 0;
    let initialBalances = [0, 0];
    if (typeof thisTradePair.sellPriceDCB === 'undefined') {
        sellPrice = 0;
    } else {
        sellPrice = thisTradePair.sellPriceDCB;
    }

    if (buyPrice <= 0 || buyPrice < newPrice) {
        // don't try to buy anything
    } else {
        initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let sellAssetBalance = initialBalances[1];
        let amountToSpend = amountToSell(thisTradePair.sellAddress, thisTradePair.sellDecimals, sellAssetBalance, thisTradePair.sellMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother, also don't output this to the logfile
            console.log(`Can't buy ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
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
                appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage:  ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` About to hit up a buy trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}`);
        await executeTrade(thisTradePair.buyAddress, thisTradePair.sellAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        tradeParameters[thisTradePair.pairname].sellPriceDCB = bestPriceAndRoute[0] * (1 + thisTradePair.sellPctDCB / 100);
        let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress);
        let actualPurchase = new BN(finalBalances[0]);
        actualPurchase = (actualPurchase - initialBalances[0]) / (10 ** thisTradePair.buyDecimals);
        let actualSale = new BN(initialBalances[1]);
        actualSale = (actualSale - finalBalances[1]) / (10 ** thisTradePair.sellDecimals);
        appendTradeLog(logstream, `********************
        Purchase successful:
        ********************
        Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.buyTicker})
        Sold ${actualSale.toPrecision(6)} (${thisTradePair.sellTicker})
        effective price: ${(actualSale / actualPurchase).toPrecision(6)}`);
    }


    if (sellPrice <= 0 || sellPrice > newPrice) {
        // don't try to sell anything
    } else {
        // remember you're now selling the 'Buy asset' and that the price that comes back from the router needs to be inverted
        initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let buyAssetBalance = initialBalances[0];
        let amountToSpend = amountToSell(thisTradePair.buyAddress, thisTradePair.buyDecimals, buyAssetBalance, thisTradePair.buyMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);

        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother
            console.log(`Can't sell ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
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
                appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage:  ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` About to hit up a sell trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}`);
        await executeTrade(thisTradePair.sellAddress, thisTradePair.buyAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        if (thisTradePair.stopAfterOneBounceDCB) {
            // kill the process altogether
            tradeParameters[thisTradePair.pairname].activate = false;
            let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
            let actualPurchase = new BN(finalBalances[1])
            actualPurchase = (actualPurchase - initialBalances[1]) / (10 ** thisTradePair.sellDecimals)
            let actualSale = new BN(initialBalances[0]) 
            actualSale = (actualSale - finalBalances[0]) / (10 ** thisTradePair.buyDecimals)
            appendTradeLog(logstream, `****************
            Sale successful:
            ****************
            Sold ${actualSale.toPrecision(6)} (${thisTradePair.buyTicker})
            Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.sellTicker})
            effective price: ${(actualPurchase / actualSale).toPrecision(6)}`);
            appendTradeLog(logstream, `\nSell executed after dead cat bounce - no further trading`)
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
    let initialBalances = [0, 0];
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
        initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let sellAssetBalance = initialBalances[1];
        let amountToSpend = amountToSell(thisTradePair.sellAddress, thisTradePair.sellDecimals, sellAssetBalance, thisTradePair.sellMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother, also don't output this to the logfile
            console.log(`Can't buy ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
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
                appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage:  ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` About to hit up a buy trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}`);
        await executeTrade(thisTradePair.buyAddress, thisTradePair.sellAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        tradeParameters[thisTradePair.pairname].sellPricePRT = bestPriceAndRoute[0] * (1 + thisTradePair.sellPctPRT / 100);
        let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress);
        let actualPurchase = new BN(finalBalances[0]);
        actualPurchase = (actualPurchase - initialBalances[0]) / (10 ** thisTradePair.buyDecimals);
        let actualSale = new BN(initialBalances[1]);
        actualSale = (actualSale - finalBalances[1]) / (10 ** thisTradePair.sellDecimals);
        appendTradeLog(logstream, `********************
        Purchase successful:
        ********************
        Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.buyTicker})
        Sold ${actualSale.toPrecision(6)} (${thisTradePair.sellTicker})
        effective price: ${(actualSale / actualPurchase).toPrecision(6)}`);
    }
    if (sellPrice <= 0 || sellPrice > newPrice) {
        // don't try to sell anything
    } else {
        // remember you're now selling the 'Buy asset' and that the price that comes back from the router needs to be inverted
        initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let buyAssetBalance = initialBalances[0];
        let amountToSpend = amountToSell(thisTradePair.buyAddress, thisTradePair.buyDecimals, buyAssetBalance, thisTradePair.buyMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);

        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother
            console.log(`Can't sell ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
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
                appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage:  ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` About to hit up a sell trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}`);
        await executeTrade(thisTradePair.sellAddress, thisTradePair.buyAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        tradeParameters[thisTradePair.pairname].buyPricePRT = bestPriceAndRoute[0] * (1 - thisTradePair.buyPctPRT / 100);
        let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let actualPurchase = new BN(finalBalances[1])
        actualPurchase = (actualPurchase - initialBalances[1]) / (10 ** thisTradePair.sellDecimals)
        let actualSale = new BN(initialBalances[0]) 
        actualSale = (actualSale - finalBalances[0]) / (10 ** thisTradePair.buyDecimals)
        appendTradeLog(logstream, `****************
        Sale successful:
        ****************
        Sold ${actualSale.toPrecision(6)} (${thisTradePair.buyTicker})
        Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.sellTicker})
        effective price: ${(actualPurchase / actualSale).toPrecision(6)}`);
    }
}



// *********
// STOP LOSS
// *********
const executeSL = async (thisTradePair, newPrice, logstream) => {
    let buyPrice = thisTradePair.buySTOPPrice;
    let sellPrice = thisTradePair.sellSTOPPrice; 
    let initialBalances = [0, 0];
    if (buyPrice <= 0 || buyPrice > newPrice) {
        // don't try to buy anything
    } else {
        initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let sellAssetBalance = initialBalances[1];
        let amountToSpend = amountToSell(thisTradePair.sellAddress, thisTradePair.sellDecimals, sellAssetBalance, thisTradePair.sellMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother, also don't output this to the logfile
            console.log(`Can't buy ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
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
                appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage:  ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` About to hit up a buy trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}`);
        await executeTrade(thisTradePair.buyAddress, thisTradePair.sellAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress);
        let actualPurchase = new BN(finalBalances[0]);
        actualPurchase = (actualPurchase - initialBalances[0]) / (10 ** thisTradePair.buyDecimals);
        let actualSale = new BN(initialBalances[1]);
        actualSale = (actualSale - finalBalances[1]) / (10 ** thisTradePair.sellDecimals);
        appendTradeLog(logstream, `********************
        Purchase successful:
        ********************
        Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.buyTicker})
        Sold ${actualSale.toPrecision(6)} (${thisTradePair.sellTicker})
        effective price: ${(actualSale / actualPurchase).toPrecision(6)}`);
    }


    if (sellPrice <= 0 || sellPrice < newPrice) {
        // don't try to sell anything
    } else {
        // remember you're now selling the 'Buy asset' and that the price that comes back from the router needs to be inverted
        initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let buyAssetBalance = initialBalances[0];
        let amountToSpend = amountToSell(thisTradePair.buyAddress, thisTradePair.buyDecimals, buyAssetBalance, thisTradePair.buyMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);

        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother
            console.log(`Can't sell ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
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
                appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage:  ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` About to hit up a sell trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}`);
        await executeTrade(thisTradePair.sellAddress, thisTradePair.buyAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let actualPurchase = new BN(finalBalances[1])
        actualPurchase = (actualPurchase - initialBalances[1]) / (10 ** thisTradePair.sellDecimals)
        let actualSale = new BN(initialBalances[0]) 
        actualSale = (actualSale - finalBalances[0]) / (10 ** thisTradePair.buyDecimals)
        appendTradeLog(logstream, `****************
        Sale successful:
        ****************
        Sold ${actualSale.toPrecision(6)} (${thisTradePair.buyTicker})
        Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.sellTicker})
        effective price: ${(actualPurchase / actualSale).toPrecision(6)}`);
    }
}




// ******************
// TRAILING STOP LOSS
// ******************
const executeTSL = async (thisTradePair, newPrice, logstream) => {
    let buyPrice = 0;
    let sellPrice = 0;
    let initialBalances = [0, 0];
    if (typeof thisTradePair.buyPriceTSL === 'undefined' || typeof thisTradePair.sellPriceTSL === 'undefined') {
        // the first loop - lets set the buy and sells
        buyPrice = newPrice * (1 + thisTradePair.buySTOPPctTSL / 100);
        sellPrice = newPrice * (1 - thisTradePair.sellSTOPPctTSL / 100);
    } else {
        buyPrice = Math.min(thisTradePair.buyPriceTSL, newPrice * (1 + thisTradePair.buySTOPPctTSL / 100));
        sellPrice = Math.max(thisTradePair.sellPriceTSL, newPrice * (1 - thisTradePair.sellSTOPPctTSL / 100));
    };

    tradeParameters[thisTradePair.pairname].buyPriceTSL = buyPrice;
    tradeParameters[thisTradePair.pairname].sellPriceTSL = sellPrice;
    // when you execute a buy you turn off the buy signal and turn on the sell signal
    // likewise when you sell you turn on the buy and turn off the sell

    if (buyPrice < 0 || buyPrice > newPrice || thisTradePair.buySTOPPctTSL <= 0) {
        // don't try to buy anything
    } else {
        initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let sellAssetBalance = initialBalances[1];
        let amountToSpend = amountToSell(thisTradePair.sellAddress, thisTradePair.sellDecimals, sellAssetBalance, thisTradePair.sellMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother, also don't output this to the logfile
            console.log(`Can't buy ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
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
                appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage:  ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` About to hit up a buy trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}`);
        await executeTrade(thisTradePair.buyAddress, thisTradePair.sellAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)

        // when you execute a buy you turn off the buy signal and turn on the sell signal
        // likewise when you sell you turn on the buy and turn off the sell
        tradeParameters[thisTradePair.pairname].buyPriceTSL = 0;
        tradeParameters[thisTradePair.pairname].sellPriceTSL = bestPriceAndRoute[0] * (1 - thisTradePair.sellSTOPPctTSL / 100);
        let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress);
        let actualPurchase = new BN(finalBalances[0]);
        actualPurchase = (actualPurchase - initialBalances[0]) / (10 ** thisTradePair.buyDecimals);
        let actualSale = new BN(initialBalances[1]);
        actualSale = (actualSale - finalBalances[1]) / (10 ** thisTradePair.sellDecimals);
        appendTradeLog(logstream, `********************
        Purchase successful:
        ********************
        Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.buyTicker})
        Sold ${actualSale.toPrecision(6)} (${thisTradePair.sellTicker})
        effective price: ${(actualSale / actualPurchase).toPrecision(6)}`);
    }


    if (sellPrice <= 0 || sellPrice < newPrice || thisTradePair.sellSTOPPctTSL <= 0) {
        // don't try to sell anything
    } else {
        // remember you're now selling the 'Buy asset' and that the price that comes back from the router needs to be inverted
        initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let buyAssetBalance = initialBalances[0];
        let amountToSpend = amountToSell(thisTradePair.buyAddress, thisTradePair.buyDecimals, buyAssetBalance, thisTradePair.buyMoonBag);
        let bnbEquivalent = await getBnbEquivalent(thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);
        if (bnbEquivalent < minBnbToTrade) {
            // amount to trade is too small - don't bother
            console.log(`Can't sell ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
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
                appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage:  ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                return;
            }
        }
        appendTradeLog(logstream, ` About to hit up a sell trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}`);
        await executeTrade(thisTradePair.sellAddress, thisTradePair.buyAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
        // when you execute a buy you turn off the buy signal and turn on the sell signal
        // likewise when you sell you turn on the buy and turn off the sell
        tradeParameters[thisTradePair.pairname].buyPriceTSL = bestPriceAndRoute[0] * (1 + thisTradePair.buySTOPPctTSL / 100);
        tradeParameters[thisTradePair.pairname].sellPriceTSL = 0;
        let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
        let actualPurchase = new BN(finalBalances[1])
        actualPurchase = (actualPurchase - initialBalances[1]) / (10 ** thisTradePair.sellDecimals)
        let actualSale = new BN(initialBalances[0]) 
        actualSale = (actualSale - finalBalances[0]) / (10 ** thisTradePair.buyDecimals)
        appendTradeLog(logstream, `****************
        Sale successful:
        ****************
        Sold ${actualSale.toPrecision(6)} (${thisTradePair.buyTicker})
        Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.sellTicker})
        effective price: ${(actualPurchase / actualSale).toPrecision(6)}`);
    }
}


// *******************
// SMART RANGE TRADING
// *******************
const executeSmartRange = async (thisTradePair, newPrice, logstream) => {
    if (typeof thisTradePair.buyPriceSR === 'undefined' || typeof thisTradePair.sellPriceSR === 'undefined') {
        // the first loop - lets set the buy and sells at HALF the percentage width
        tradeParameters[thisTradePair.pairname].buyPriceSR = -1;
        tradeParameters[thisTradePair.pairname].buyTriggerSR = false;
        tradeParameters[thisTradePair.pairname].sellPriceSR = -1;
        tradeParameters[thisTradePair.pairname].sellTriggerSR = false;
        tradeParameters[thisTradePair.pairname].buyTargetSR = thisTradePair.buyInitialTargetSR;
        tradeParameters[thisTradePair.pairname].sellTargetSR = newPrice * (1 + thisTradePair.profitPctSR / 100);
    } 
    let initialBalances = [0, 0];
    if (thisTradePair.buyTriggerSR === false) {
        // no trigger has been previously set
        if (thisTradePair.buyTargetSR < newPrice) {
            // the price is still above the target - don't look to buy
        } else {
            // we've just hit the target level so we need to start looking for a reversal to trigger a buy
            tradeParameters[thisTradePair.pairname].buyTriggerSR = true;
            tradeParameters[thisTradePair.pairname].buyPriceSR = newPrice * (1 + thisTradePair.reversalPctSR / 100);
            console.log(`Buy Trigger activated at ${newPrice}, looking to buy when we rise above ${tradeParameters[thisTradePair.pairname].buyPriceSR}`);
        }
    } else {
        if (thisTradePair.buyPriceSR < newPrice){
            // the price has just gone up again above the trigger
            console.log(`Just gone above the trigger - going to buy`)
            // execute a trade
            initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
            let sellAssetBalance = initialBalances[1];
            let amountToSpend = amountToSell(thisTradePair.sellAddress, thisTradePair.sellDecimals, sellAssetBalance, thisTradePair.sellMoonBag);
            let bnbEquivalent = await getBnbEquivalent(thisTradePair.sellAddress, thisTradePair.sellDecimals, amountToSpend);
            if (bnbEquivalent < minBnbToTrade) {
                // amount to trade is too small - don't bother, also don't output this to the logfile
                console.log(`Can't buy ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
                // set the sell target to be exected buy + profit%
                tradeParameters[thisTradePair.pairname].sellTargetSR = newPrice * (1 + thisTradePair.profitPctSR / 100);
                // turn off the buyTriggerSR and the buyTargetSR
                tradeParameters[thisTradePair.pairname].buyTriggerSR = false;
                tradeParameters[thisTradePair.pairname].buyTargetSR = -1;
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
                    appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage:  ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                    return;
                }
            }
            appendTradeLog(logstream, ` About to hit up a buy trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}`);
            await executeTrade(thisTradePair.buyAddress, thisTradePair.sellAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
            // set the sell target to be exected buy + profit%
            tradeParameters[thisTradePair.pairname].sellTargetSR = newPrice * (1 + thisTradePair.profitPctSR / 100);
            // turn off the buyTriggerSR and the buyTargetSR
            tradeParameters[thisTradePair.pairname].buyTriggerSR = false;
            tradeParameters[thisTradePair.pairname].buyTargetSR = -1;
            let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress);
            let actualPurchase = new BN(finalBalances[0]);
            actualPurchase = (actualPurchase - initialBalances[0]) / (10 ** thisTradePair.buyDecimals);
            let actualSale = new BN(initialBalances[1]);
            actualSale = (actualSale - finalBalances[1]) / (10 ** thisTradePair.sellDecimals);
            appendTradeLog(logstream, `********************
            Purchase successful:
            ********************
            Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.buyTicker})
            Sold ${actualSale.toPrecision(6)} (${thisTradePair.sellTicker})
            effective price: ${(actualSale / actualPurchase).toPrecision(6)}`);
        } else {
            // the price is still below the buy trigger - price still falling
            // reset the trigger to be the lesser of the old trigger and the new price + reversal
            tradeParameters[thisTradePair.pairname].buyPriceSR = Math.min(thisTradePair.buyPriceSR, newPrice * (1 + thisTradePair.reversalPctSR / 100));
        }
    }
    if (thisTradePair.sellTriggerSR === false) {
        // no trigger has been previously set
        if (thisTradePair.sellTargetSR > newPrice || thisTradePair.sellTargetSR < 0) {
            // the price is still below the target - don't look to buy
        } else {
            // we've just hit the target level so we need to start looking for a reversal to trigger a buy
            tradeParameters[thisTradePair.pairname].sellTriggerSR = true;
            tradeParameters[thisTradePair.pairname].sellPriceSR = newPrice * (1 - thisTradePair.reversalPctSR / 100);
            console.log(`Sell Trigger activated at ${newPrice}, looking to sell when we fall below ${tradeParameters[thisTradePair.pairname].sellPriceSR}`);
        }
    } else {
        if (thisTradePair.sellPriceSR > newPrice){
            // the price has just gone down again below the trigger
            console.log(`Just gone below the trigger - going to sell`)
            // execute a trade
            // remember you're now selling the 'Buy asset' and that the price that comes back from the router needs to be inverted
            initialBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
            let buyAssetBalance = initialBalances[0];
            let amountToSpend = amountToSell(thisTradePair.buyAddress, thisTradePair.buyDecimals, buyAssetBalance, thisTradePair.buyMoonBag);
            let bnbEquivalent = await getBnbEquivalent(thisTradePair.buyAddress, thisTradePair.buyDecimals, amountToSpend);
            if (bnbEquivalent < minBnbToTrade) {
                // amount to trade is too small - don't bother
                console.log(`Can't sell ${thisTradePair.buyTicker} because it's below the minimum ${globalParams._minBnbToTrade} in BNB equivalents`);
                // set the buy target to be lesser of: original buy Target and exected sell - profit %
                tradeParameters[thisTradePair.pairname].buyTargetSR = Math.min(thisTradePair.buyInitialTargetSR, newPrice * (1 - thisTradePair.profitPctSR / 100));
                // turn off the buyTriggerSR and the buyTargetSR
                tradeParameters[thisTradePair.pairname].sellTriggerSR = false;
                tradeParameters[thisTradePair.pairname].sellTargetSR = -1;
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
                    appendTradeLog(logstream, `Price impact of the size of this trade is too big Price: ${bestPriceAndRoute[0]} Slippage:  ${thisbidToMidSlippage.toPrecision(3)}% vs the max allowed of ${globalParams._bidToMidSlippage}% `);
                    return;
                }
            }
            appendTradeLog(logstream, ` About to hit up a sell trade hoping for ${bestPriceAndRoute[0].toPrecision(6)}`);
            await executeTrade(thisTradePair.sellAddress, thisTradePair.buyAddress, amountToSpend, thisTradePair.overrideSlippage, globalParams._gasPrice, globalParams._gasTradingLimit, bestPriceAndRoute[1], logstream)
            let finalBalances = await getPairBalances(thisTradePair.buyAddress, thisTradePair.sellAddress, walletAddress)
            let actualPurchase = new BN(finalBalances[1])
            actualPurchase = (actualPurchase - initialBalances[1]) / (10 ** thisTradePair.sellDecimals)
            let actualSale = new BN(initialBalances[0]) 
            actualSale = (actualSale - finalBalances[0]) / (10 ** thisTradePair.buyDecimals)
            appendTradeLog(logstream, `****************
            Sale successful:
            ****************
            Sold ${actualSale.toPrecision(6)} (${thisTradePair.buyTicker})
            Bought ${actualPurchase.toPrecision(6)} (${thisTradePair.sellTicker})
            effective price: ${(actualPurchase / actualSale).toPrecision(6)}`);
            // set the buy target to be lesser of: original buy Target and exected sell - profit %
            tradeParameters[thisTradePair.pairname].buyTargetSR = Math.min(thisTradePair.buyInitialTargetSR, newPrice * (1 - thisTradePair.profitPctSR / 100));
            // turn off the buyTriggerSR and the buyTargetSR
            tradeParameters[thisTradePair.pairname].sellTriggerSR = false;
            tradeParameters[thisTradePair.pairname].sellTargetSR = -1;
        } else {
            // the price is still above the sell trigger - price still rising
            // reset the trigger to be the higher of the old trigger and the new price - reversal
            tradeParameters[thisTradePair.pairname].sellPriceSR = Math.max(thisTradePair.sellPriceSR, newPrice * (1 - thisTradePair.reversalPctSR / 100));
        }
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
            if (midPrice === -1) {
                console.log(`Get Mid failed - exiting`);
                return;
            }
            let verboseDialog =``;
            if (checkInitialSettings(tradeParameters[thisTradePair], midPrice)) {
                verboseDialog = await verboseTradeDescription(globalParams, tradeParameters[thisTradePair], midPrice);
                //  create log file
                var tickerStream = fs.createWriteStream(`TradeLogPCS.${dateStamp}.txt`, {flags: 'a'});
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
            let walletBNBBalance = await getWalletBalance(wbnbAddress, walletAddress)
            let bnbTokenBalance = (walletBNBBalance / (10 ** 18)).toPrecision(6)
            if (bnbTokenBalance <= globalParams._haltOnLowBNB) { 
                appendTradeLog(tickerStream, `Low BNB Balance in wallet: ${bnbTokenBalance} BNB - execution halted`)
                return 
            }
            await delay(5000);
            executionCount = 0;
            for (let thisTradePair in tradeParameters) {
                if (tradeParameters[thisTradePair].activate === true && thisTradePair !== 'template') {
                    executionCount += 1;
                    try {
                        let newPrice = await getMidPrice(tradeParameters[thisTradePair].sellAddress, tradeParameters[thisTradePair].sellDecimals, tradeParameters[thisTradePair].buyAddress, tradeParameters[thisTradePair].buyDecimals);
                        if (newPrice === -1) {
                            console.log (`\nNo price ... retrying`)
                        } else {
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
                                case 'SMART-RANGE':
                                    await executeSmartRange(tradeParameters[thisTradePair], newPrice, tickerStream);
                                    break;
                            }
                        }
                    } catch (error) {
                        console.log (`\nNo price ... retrying`)
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

// if you're feeling grateful - pls chuck me some coins :)
// 0xcF3F6B64C216Fd624408F02c1F89FC330BEDA92F