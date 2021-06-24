
/* THIS CHECKS THE SETUP - MAKING SURE THE VARIABLES ARE THE RIGHT FORMAT AND THE LEVELS ARENT GOING TO DRAIN YOUR ACCOUNT IMMEDIATELY */

const isBadVariable = (variableToCheck, errorMsg) => {console.log(`${variableToCheck} is a bad input: ${errorMsg}`)};
const isNumber = (valToCheck) => {return (typeof valToCheck === 'number')};
const isNumberMoreThanEq = (valToCheck, morethan) => {return (isNumber(valToCheck) && valToCheck >= morethan)};

const checkVariableValidity = (globalParams, thisTradeParams) => {
    // yes this is ugly but we need to check that people aren't entering retarded inputs
        let goodVariables = true;
        if (thisTradeParams.buyAddress === thisTradeParams.sellAddress) {
            isBadVariable(`buyAddress or sellAddress`, `Needs to be different from each other`);
            return false;
        }
        if (!isNumberMoreThanEq(thisTradeParams.buyMoonBag, 0)) {
            isBadVariable(`buyMoonBag`, `Needs to be 0 or a positive number`);
            return false;
        }
        if (!isNumberMoreThanEq(thisTradeParams.sellMoonBag, 0)) {
            isBadVariable(`sellMoonBag`, `Needs to be 0 or a positive number`);
            return false;
        }
        if (!isNumberMoreThanEq(globalParams._keepETH, 0.1)) {
            isBadVariable(`_keepETH`, `Needs to be 0.1 or higher to pay for gas`);
            return false;
        }
        if (!isNumberMoreThanEq(globalParams._minETHToTrade, 0.01)) {
            isBadVariable(`_minETHToTrade`, `Needs to be 0.01 or higher to prevent worthless trades`);
            return false;
        }
        if (!isNumberMoreThanEq(globalParams._haltOnLowETH, 0.1)) {
            isBadVariable(`_haltOnLowETH`, `Needs to be 0.1 or higher so you don't dry out your wallet`);
            return false;
        }
        if (!isNumberMoreThanEq(globalParams._executionSlippage, 0.03)) {
            isBadVariable(`_executionSlippage`, `Needs to be 0.03 or higher get trades through`);
            return false;
        }
        if (!isNumberMoreThanEq(globalParams._bidToMidSlippage, 0)) {
            isBadVariable(`_bidToMidSlippage`, `Needs to be 0 or higher you'll never trade at mid.`);
            return false;
        }
        if (!isNumberMoreThanEq(globalParams._gasApprovalLimit, 70000)) {
            isBadVariable(`_gasApprovalLimit`, `Needs to be 70,000 or higher to get approvals done`);
            return false;
        }
        if (!isNumberMoreThanEq(globalParams._gasTradingLimit, 170000)) {
            isBadVariable(`_gasTradingLimit`, `Needs to be 170,000 or higher to go through`);
            return false;
        }
        if (!isNumberMoreThanEq(globalParams._gasPrice, 1)) {
            isBadVariable(`_gasPrice`, `Needs to be 1 or higher to prevent worthless trades`);
            return false;
        }
    
        switch (thisTradeParams.tradeType) {
            case 'BUY-SELL-PRICE-LIMITS':
                if (!isNumber(thisTradeParams.buyPrice)) {
                    isBadVariable(`buyPrice`, `Needs to be a number`);
                    goodVariables = false;
                }
                if (!isNumber(thisTradeParams.sellPrice)) {
                    isBadVariable(`sellPrice`, `Needs to be a number`);
                    goodVariables = false;
                }
                break;
            case 'DEAD-CAT-BOUNCE':
                if (!isNumber(thisTradeParams.buyPriceDCB)) {
                    isBadVariable(`buyPriceDCB`, `Needs to be a number`);
                    goodVariables = false;
                }
                if (!isNumberMoreThanEq(thisTradeParams.sellPctDCB, 10)) {
                    isBadVariable(`sellPctDCB`, `Needs to be a number greater than 10`);
                    goodVariables = false;
                }
                if (!(typeof thisTradeParams.stopAfterOneBounceDCB === 'boolean')) {
                    isBadVariable(`stopAfterOneBounceDCB`, `Needs to be a boolean (true/false)`);
                    goodVariables = false;
                }
                break;
            case 'PCT-RANGE-TRADING':
                if (!isNumberMoreThanEq(thisTradeParams.buyPctPRT, 3)) {
                    isBadVariable(`buyPctPRT`, `Needs to be a number greater than 3`);
                    goodVariables = false;
                }
                if (!isNumberMoreThanEq(thisTradeParams.sellPctPRT, 3)) {
                    isBadVariable(`sellPctPRT`, `Needs to be a number greater than 3`);
                    goodVariables = false;
                }
                break;
            case 'STOP-LOSS':
                if (!isNumber(thisTradeParams.buySTOPPrice)) {
                    isBadVariable(`buySTOPPrice`, `Needs to be a number`);
                    goodVariables = false;
                }
                if (!isNumber(thisTradeParams.sellSTOPPrice)) {
                    isBadVariable(`sellSTOPPrice`, `Needs to be a number`);
                    goodVariables = false;
                }
                break;
            case 'TRAILING-STOP-LOSS':
                if (!isNumber(thisTradeParams.buySTOPPctTSL)) {
                    isBadVariable(`buySTOPPctTSL`, `Needs to be a number`);
                    goodVariables = false;
                }
                if (!isNumber(thisTradeParams.sellSTOPPctTSL)) {
                    isBadVariable(`sellSTOPPctTSL`, `Needs to be a number`);
                    goodVariables = false;
                }
                break;
            case 'SMART-RANGE':
                    if (!isNumber(thisTradeParams.buyInitialTargetSR)) {
                        isBadVariable(`buyInitialTargetSR`, `Needs to be a number`);
                        goodVariables = false;
                    }
                    if (!isNumber(thisTradeParams.profitPctSR)) {
                        isBadVariable(`profitPctSR`, `Needs to be a number`);
                        goodVariables = false;
                    }
                    if (!isNumber(thisTradeParams.reversalPctSR)) {
                        isBadVariable(`reversalPctSR`, `Needs to be a number`);
                        goodVariables = false;
                    }
                    break;
    
            default:
                isBadVariable(`tradeType`, `tradeType doesn't match a valid trading strategy`)
                goodVariables = false;
                break;
        }
        return goodVariables
    }

const checkInitialSettings = (thisTradeParams, initialPrice) => {
    let goodSettings = true;
    switch (thisTradeParams.tradeType) {
        case 'BUY-SELL-PRICE-LIMITS':
            // Buy needs to be below initial, and sell needs to be above initial level
            if (thisTradeParams.buyPrice > initialPrice) {
                isBadVariable(`buyPrice`, `Buy is already above the market level ${initialPrice}`);
                goodSettings = false;
            }
            if (thisTradeParams.sellPrice < initialPrice && thisTradeParams.sellPrice > 0) {
                isBadVariable(`sellPrice`, `Sell is already below the market level ${initialPrice}`);
                goodSettings = false;
            }
            break;
        case 'DEAD-CAT-BOUNCE':
            // Buy needs to be below initial, sell is a percentage - no need for checks
            if (thisTradeParams.buyPriceDCB > initialPrice) {
                isBadVariable(`buyPriceDCB`, `Buy is already above the market level ${initialPrice}`);
                goodSettings = false;
            }
            break;
        case 'PCT-RANGE-TRADING':
            // Nothing to check
            break;
        case 'STOP-LOSS':
            // Buy needs to be ABOVE initial, and sell needs to be BELOW initial level
            if (thisTradeParams.buySTOPPrice < initialPrice && thisTradeParams.buySTOPPrice > 0) {
                isBadVariable(`buySTOPPrice`, `Buy STOP is already below the market level ${initialPrice}`);
                goodSettings = false;
            }
            if (thisTradeParams.sellSTOPPrice > initialPrice ) {
                isBadVariable(`sellSTOPPrice`, `Sell STOP is already above the market level ${initialPrice}`);
                goodSettings = false;
            }
            break;            
        case 'TRAILING-STOP-LOSS':
            // These are percentages no checks needed
            break;
    }
    return goodSettings
}

// THIS IS A PLAIN ENGLISH CHECK BEFORE WE START THE BOT RUNNING
const verboseTradeDescription = async (globalParams, thisTradeParams, initialPrice) => {
    let msg1 = ``
    let msg2 = ``
    let msg3 = ``
    let msg4 = ``
    let msg5 = ``
    let msg6 = `\n`
    let msg7 = ``
    let buyTicker = thisTradeParams.buyTicker
    let sellTicker = thisTradeParams.sellTicker
    switch (thisTradeParams.tradeType) {
        case 'BUY-SELL-PRICE-LIMITS':
            msg1 = `About to start a Buy/Sell Limit strategy:`
            if (thisTradeParams.buyPrice >=0) {
                msg2 = `Buying as many ${buyTicker} using ${sellTicker} tokens as possible at ${thisTradeParams.buyPrice} (${sellTicker}/${buyTicker}) [inverse: ${(1/thisTradeParams.buyPrice).toPrecision(6)}]
                While also holding back ${thisTradeParams.sellMoonBag} ${sellTicker}.`
            } else {
                //no buy strategy print nothing
            }
            if (thisTradeParams.sellPrice >=0) {
                msg3 = `Selling as many ${buyTicker} for ${sellTicker} tokens as possible at ${thisTradeParams.sellPrice} (${sellTicker}/${buyTicker}) [inverse: ${(1/thisTradeParams.sellPrice).toPrecision(6)}].
                While also holding back ${thisTradeParams.buyMoonBag} ${buyTicker}.`
            } else {
                //no sell strategy print nothing
            }
            break;
        case 'DEAD-CAT-BOUNCE':
            msg1 = `About to start a Dead Cat Bounce strategy:`
            msg2 = `Buying as many ${buyTicker} using ${sellTicker} tokens as possible when the price drops to ${thisTradeParams.buyPriceDCB} (${sellTicker}/${buyTicker}) [inverse: ${(1/thisTradeParams.buyPriceDCB).toPrecision(6)}].
            While also holding back ${thisTradeParams.sellMoonBag} ${sellTicker}.` 
            msg3 = `and then selling again when the price rises by ${thisTradeParams.sellPctDCB}%.`
            if (thisTradeParams.stopAfterOneBounceDCB) {
                msg4 = `This will stop after one cycle.`
            } else {
                msg4 = `This will continue to run (is that wise?).`
            }
            break;
        case 'PCT-RANGE-TRADING':
            msg1 = `About to start a Percentage Range Trading strategy:`
            msg2 = `Buying as many ${buyTicker} using ${sellTicker} tokens as possible ${thisTradeParams.buyPricePRT}% below the last sale.
            While also holding back ${thisTradeParams.sellMoonBag} ${sellTicker}.`
            msg3 = `Selling as many ${buyTicker} tokens as possible for ${sellTicker} tokens ${thisTradeParams.sellPricePRT}% above the last purchase.
            While also holding back ${thisTradeParams.buyMoonBag} ${buyTicker}.`
            msg4 = `Note the initial purchase and sale levels are HALF the distance away from spot,\nso that the range is always ${(thisTradeParams.buyPricePRT+thisTradeParams.sellPricePRT)}% wide.`
            break;
        case 'STOP-LOSS':
            msg1 = `About to start a Stop Loss strategy:`
            if (thisTradeParams.buySTOPPrice >=0) {
                msg2 = `Buying as many ${buyTicker} tokens using ${sellTicker} tokens as possible when the price goes above ${thisTradeParams.buySTOPPrice} (${sellTicker}/${buyTicker}) [inverse: ${(1/thisTradeParams.buySTOPPrice).toPrecision(6)}].
                While also holding back ${thisTradeParams.sellMoonBag} ${sellTicker}.`
            } else {
                //no buy strategy print nothing
            }
            if (thisTradeParams.sellSTOPPrice >=0) {
                msg3 = `Selling as many ${buyTicker} tokens for ${sellTicker} tokens as possible when the price drops below ${thisTradeParams.sellSTOPPrice} (${sellTicker}/${buyTicker}) [inverse: ${(1/thisTradeParams.sellSTOPPrice).toPrecision(6)}].
                While also holding back ${thisTradeParams.buyMoonBag} ${buyTicker}.`
            } else {
                //no sell strategy print nothing
            }
            break;            
        case 'TRAILING-STOP-LOSS':
            msg1 = `About to start a Trailing Stop Loss strategy:`
            if (thisTradeParams.buySTOPPctTSL > 0) {
                msg2 = `Buying as many ${buyTicker} tokens as possible ${thisTradeParams.buySTOPPctTSL}% above the lowest low.
                While also holding back ${thisTradeParams.sellMoonBag} ${sellTicker}.`
            } else {
                //no buy strategy print nothing
            }
            if (thisTradeParams.sellSTOPPctTSL > 0 ) {
                msg3 = `Selling as many ${buyTicker} tokens for ${sellTicker} tokens as possible ${thisTradeParams.sellSTOPPctTSL}% below the highest high.
                While also holding back ${thisTradeParams.buyMoonBag} ${buyTicker}.`
            } else {
                //no sell strategy print nothing
            }
            break;
        case 'SMART-RANGE':
            msg1 = `About to start a Smart Range Trading strategy:`
            msg2 = `Buying as many ${buyTicker} using ${sellTicker} tokens as possible around a price of ${thisTradeParams.buyInitialTargetSR}.
            While also holding back ${thisTradeParams.sellMoonBag} ${sellTicker}.`
            msg3 = `Selling as many ${buyTicker} tokens as possible for ${sellTicker} tokens ${thisTradeParams.profitPctSR}% above the last purchase.
            While also holding back ${thisTradeParams.buyMoonBag} ${buyTicker}.`
            msg4 = `Buys will let the market sell off will wait for a reversal of ${thisTradeParams.reversalPctSR}% before it executes, ditto sells in a rally.`
            break;
    }
    msg5 = `Always keeping approx ${globalParams._keepETH} ETH in the wallet for gas etc.`;
//    if (thisTradeParams.buyMoonBag > 0) {msg6 = `And always keeping ${thisTradeParams.buyMoonBag} ${buyTicker} Tokens for HODL.`} 
//    if (thisTradeParams.sellMoonBag > 0) {msg6 += `And always keeping ${thisTradeParams.sellMoonBag} ${sellTicker} Tokens for HODL.`} 
    msg7 = `\nInitial Price for ${buyTicker} Token = ${initialPrice} (${sellTicker}/${buyTicker}).\n Inverse: ${Number((1/initialPrice).toPrecision(6))} (${buyTicker}/${sellTicker})`
    return (`\n ************** \n` + msg1 + `\n` + msg2 + `\n` +msg3 + `\n` +msg4 + `\n` +msg5 + msg6 + msg7 + `\n`)
}


module.exports = {checkVariableValidity, checkInitialSettings, verboseTradeDescription};
