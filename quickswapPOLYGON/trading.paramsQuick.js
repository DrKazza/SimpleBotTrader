// if you're feeling grateful - pls chuck me some coins :)
// 0xcF3F6B64C216Fd624408F02c1F89FC330BEDA92F

// PLEASE READ THE COMMENTS AT THE END IF YOU DON'T KNOW WHAT THESE PARAMETERS MEAN
// Some coin tokens:
// QUICK = 0x831753dd7087cac61ab5644b308642cc1c33dc13
// USDC = 0x2791bca1f2de4661ed88a30c99a7a9449aa84174
// ADDY = 0xc3fdbadc7c795ef1d6ba111e06ff8f16a20ea539
// WETH = 0x7ceb23fd6bc0add59e62ac25578270cff1b9f619
// WBTC = 0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6
// WEXPOLY = 0x4c4BF319237D98a30A929A96112EfFa8DA3510EB
// pAAVE = 0xd6df932a45c0f255f85145f286ea0b292b21c90b
// PAUTO = 0x7f426f6dc648e50464a0392e60e1bb465a67e9cf ??? this seems to be Autofarm's poly token but check before you use it


const tradeParameters = {
    pair1: {
        activate: false,
        buyAddress: 'MATIC',
        sellAddress: '0xc3fdbadc7c795ef1d6ba111e06ff8f16a20ea539',
        buyMoonBag: 0, // Don't ever trade this number of buyAddress coins
        sellMoonBag: 0, // Don't ever trade this number of sellAddress coins

        tradeType: 'BUY-SELL-PRICE-LIMITS',

        // TRADE TYPE 1:    BUY-SELL-PRICE-LIMITS
        buyPrice :  15.2, // set this to -1 if you don't want to buy any tokens
        sellPrice : 15.8 // set this to -1 if you don't want to sell any tokens

        //don't forget NO comma after the last variable
    },
    pair2: {
        activate: false,
        buyAddress: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
        sellAddress: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        buyMoonBag: 0, // Don't ever trade this number of buyAddress coins
        sellMoonBag: 0, // Don't ever trade this number of sellAddress coins

        tradeType: 'TRAILING-STOP-LOSS',
        
        buySTOPPctTSL :  -1, // the ammount in percent above the lowest price to execute your buy, 50 is 50 percent, 0.5 is half a percent
                // set this to -1 to disable this
        sellSTOPPctTSL : 1 // the ammount in percent above the lowest price to execute your buy, 50 is 50 percent, 0.5 is half a percent
                // set this to -1 to disable this

        //don't forget NO comma after the last variable
    },
    pair3: {
        activate: true,
        buyAddress: '0xc3fdbadc7c795ef1d6ba111e06ff8f16a20ea539',  
        sellAddress: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', 
        buyMoonBag: 0, // Don't ever trade this number of buyAddress coins
        sellMoonBag: 0, // Don't ever trade this number of sellAddress coins

        tradeType: 'SMART-RANGE',

        buyInitialTargetSR : 0.025,    // where the initial buy starts
        profitPctSR : 5,   // profit targe percentage
        reversalPctSR : 1   // amount the trailing stop needs to reverse by to get triggered

        //don't forget NO comma after the last variable
    },
    template: {
        activate: false, // if this is false then this trading strategy will not happen
        buyAddress: 'MATIC or an Address',
        sellAddress: 'MATIC or an Address',
        buyMoonBag: 0, // Don't ever trade this number of buyAddress coins
        sellMoonBag: 0, // Don't ever trade this number of sellAddress coins
    
        // note these are the MID prices at which the buys or sells will kick in - execution price may be worse than the limits due to slippage
        tradeType: 'BUY-SELL-PRICE-LIMITS', // Choose one of the following - and additional parameters

            // TRADE TYPE 1:    BUY-SELL-PRICE-LIMITS
        buyPrice :  0.0029, // set this to -1 if you don't want to buy any tokens
        sellPrice : 0.00310, // set this to -1 if you don't want to sell any tokens
    
            // TRADE TYPE 2:    DEAD-CAT-BOUNCE
        buyPriceDCB :  1, 
        sellPctDCB : 50, // this is the percentage increase following the purchase 50 is fifty percent, 0.5 is half a percent
        stopAfterOneBounceDCB : true,
        // there's no such thing as an initial sell on a DCB
    
            // TRADE TYPE 3:    PCT-RANGE-TRADING
        buyPctPRT :  10, // this is the percentage drop following the sale 50 is fifty percent, 0.5 is half a percent
        sellPctPRT : 10, // this is the percentage increase following the purchase 50 is fifty percent, 0.5 is half a percent
        // for range trading you need to have both buy and sell active
    
            // TRADE TYPE 4:    STOP-LOSS
        buySTOPPrice :  720, // set this to -1 if you don't want to buy any tokens
        sellSTOPPrice : 100, // set this to -1 if you don't want to sell any tokens
            // *** DO NOT SET A BUY STOP LOSS AND A SELL PRICE LIMIT TOGETHER!!! 
            // *** DO NOT SET A SELL STOP LOSS AND A BUY PRICE LIMIT TOGETHER!!! 
            // *** IT'S FINE TO SET A BUYSTOP AND A BUY LIMIT OR A SELLSTOP AND A SELL LIMIT
            // *** JUST NEVER MIX AND MATCH OR YOU CAN END UP IN A LOOP OF TRADES
    
            // TRADE TYPE 5:    TRAILING-STOP-LOSS
        buySTOPPctTSL :  10, // the ammount in percent above the lowest price to execute your buy, 50 is 50 percent, 0.5 is half a percent
                // set this to -1 to disable this
        sellSTOPPctTSL : 10, // the ammount in percent above the lowest price to execute your buy, 50 is 50 percent, 0.5 is half a percent
                // set this to -1 to disable this

            // TRADE TYPE 6:    SMART-RANGE
        buyInitialTargetSR : 50,    // where the initial buy starts
        profitPctSR : 10,   // profit targe percentage
        reversalPctSR : 2   // amount the trailing stop needs to reverse by to get triggered

        //don't forget NO comma after the last variable
    }
}

module.exports = {
    tradeParameters: tradeParameters
}
    
    /***************************************************************************************************
    TRADE TYPE EXPLANATIONS:    
        TRADE TYPE 1:    BUY-SELL-PRICE-LIMITS
            This trade will just sell at a fixed target following a rally, or buy at a fixed level
            following a sell off

        TRADE TYPE 2:    DEAD-CAT-BOUNCE
            This trade will look for a big sell off and when the buyPriceDCB is reached it will try to
            buy some tokens - it will then initiate a sell limit a set percentage above that purchase
            level, so if the coin is trading at 100, you initiate a buy at 50, if it drops suddenly
            down to 20 you buy them there and then if the sellPctDCB is 40 you'll try to sell it again
            at 28 (40% above the purchase of 20 not the trigger up at 50!) 

        TRADE TYPE 3:    PCT-RANGE-TRADING
            This trade will take a percentage range and look to trade around there, so if you set it 
            at +/- 10% then with a starting point of 100 it will try to sell at 110 and buy at 90.
            These strikes move so if you buy at 90 your next sell will be at 99.
            Make sure the % ranges aren't too tight as a bad slippage variable could eat thru all
            the profits of the range trading.
            If you set the range to Buy = 5, sell = 15 that will take advantage of an uptrending range
            likewise buy = 15, sell = 5 is a range that is trending downwards.

        TRADE TYPE 4:    STOP-LOSS
            Although this is called a Stop Loss, it can also be a profit take. You set the BUY _above_
            the market and the SELL _below_ the market so if you have bought something you can sell if
            it starts crashing, these are used when you see a range that may be broken.
            It's important you consider slippage as when you break a range slippage can be high because
            the market is moving quickly.
            Setting stops too close to the market can be painful if the market is volatile.

        TRADE TYPE 5:    TRAILING-STOP-LOSS
            Similar to a Stop Loss this re-adjusts your stop levels from a fixed price. Lets say you
            have bought something at 100 and have a Stop Loss sale at 90. If the market keeps going up
            to 200 for example you want to automatically move your Stop sell to 180 for example and to
            do that just set it (sellSTOPPctTSL) at 10 and it will follow the market up.
            Likewise if the market is falling from 100 down to 50 you want your buy stop to move down
            from 110 to 55 to catch a rebound, this would be a setting of 10 in the buySTOPPctTSL. 
            Setting stops too close to the market can be painful if the market is volatile.

        TRADE TYPE 6:   SMART-RANGE
            You set a buy target price to start the trade. As the market drops to that level a trailing stop
            loss will follow the market down and will buy when the market reverses by reversalPctSR %.
            so if the buy is at 50 and the reversalPctSR is 2 then you could buy when the price spikes
            above 51 (or you could follow it down further). Once you've bought a sell is initiated at 
            profitPctSR % above the purchase trigger if this is 10 then in the example above the sell 
            will look for the price to go up to 56.1 (= 51 * 110%) and then follow the market up until 
            it drops by reversalPctSR, using the same example this could be when the market drops down 
            to 54.978 (= 56.1 * 98%). When this is complete the cycle starts again at lower of: the 
            initial buy price (50) or wherever profitPctSR below the last sale.
            In case you already own the asset an initial sale is set at the initial price + profitPctSR%


    PARAMETER EXPLANATION:
    Note that if you have a BUY-SELL-PRICE-LIMITS type trade then changing (or omitting) the parameters
    for another trade type will have no impact.

    ****        price triggers           **************************************************************
     Note that the price trigger that you set will initiate the trade which will inevitably incur some
     slippage, so if you have a sell limit of 150, you may actually end up selling at 148.5 if there's 
     1% of slippage for example. Make sure you factor this into your calculations

    ****        amounts to trade         **************************************************************
     The bot will automatically try to trade all the token balance you have in your wallet...
     LESS the amount of tokens you specify in your respective moonbag...
     Also LESS the amount of _keepMATIC specified in the global parameters so you always have
     something to pay for gas
     If you want to only buy on a dip without a set being put in then just change "noSells" to true
     likewise if you're only looking to sell something without buying again swap "noBuys" to true

    ****         buyMoonBag and sellMoonBag       *****************************************************
     moonBag is the amount of tokens that you will never sell 
     To sell all of your tokens just set buyMoonBag and sellMoonBag equal to 0

    ****             stopAfterOneBounce           *****************************************************
     this should pretty much always be true if something crashes and you buy at the bottom and turn a 
     tidy profit you don't want to buy it again when it hits the bottom again because it may not 
     bounce a second time - take your gains and run

     **************************************************************************************************/