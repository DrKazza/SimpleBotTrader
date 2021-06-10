// PLEASE READ THE COMMENTS AT THE END IF YOU DON'T KNOW WHAT THESE PARAMETERS MEAN
// Some BSC coin tokens:
// CAKE = 0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82
// BUSD = 0xe9e7cea3dedca5984780bafc599bd69add087d56 
// BUNNY = 0xc9849e6fdb743d08faee3e34dd2d1bc69ea11a51
// BMXX = 0x4131b87f74415190425ccd873048c708f8005823 (BSC Version)
// AUTO = 0xa184088a740c695e156f91f5cc086a06bb78b827
// ALPACA = 0x8f0528ce5ef7b51152a59745befdd91d97091d2f
// EPS = 0xa7f552078dcc247c2684336020c03648500c6d9f
// BIFI = 0xca3f508b8e4dd382ee878a314789373d80a5190a (BEEFY)
// BFI = 0x81859801b01764d4f0fa5e64729f5a6c3b91435b (BEARNFI)
// WATCH = 0x7a9f28eb62c791422aa23ceae1da9c847cbec9b0
// ICE = 0xf16e81dce15b08f326220742020379b855b87df9
// KILI = 0x865d0c78d08bd6e5f0db6bcbf36d3f8eb4ad48f8 
// CODEX = 0x9e95cb3d0560f9cba88991f828322526851bfb56 (Caution v low trading volumes)

const tradeParameters = {
    pair1: {
        activate: false,
        buyAddress: 'BNB',
        sellAddress: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        buyMoonBag: 0, // Don't ever trade this number of buyAddress coins
        sellMoonBag: 0, // Don't ever trade this number of sellAddress coins

        tradeType: 'BUY-SELL-PRICE-LIMITS',

        // TRADE TYPE 1:    BUY-SELL-PRICE-LIMITS
        buyPrice :  420, // set this to -1 if you don't want to buy any tokens
        sellPrice : -1 // set this to -1 if you don't want to sell any tokens
    },
    pair2: {
        activate: true,
        buyAddress: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
        sellAddress: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        buyMoonBag: 0, // Don't ever trade this number of buyAddress coins
        sellMoonBag: 0, // Don't ever trade this number of sellAddress coins

        tradeType: 'BUY-SELL-PRICE-LIMITS',

        // TRADE TYPE 1:    BUY-SELL-PRICE-LIMITS
        buyPrice :  12.5, // set this to -1 if you don't want to buy any tokens
        sellPrice : 21 // set this to -1 if you don't want to sell any tokens
    },
    pair3: {
        activate: false,
        buyAddress: 'BNB',
        sellAddress: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        buyMoonBag: 0, // Don't ever trade this number of buyAddress coins
        sellMoonBag: 0, // Don't ever trade this number of sellAddress coins

        tradeType: 'STOP-LOSS',

            // TRADE TYPE 4:    STOP-LOSS
        buySTOPPrice :  360, // set this to -1 if you don't want to buy any tokens
        sellSTOPPrice : -1 // set this to -1 if you don't want to sell any tokens
    },
    pair4: {
        activate: false,
        buyAddress: 'BNB',
        sellAddress: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        buyMoonBag: 0, // Don't ever trade this number of buyAddress coins
        sellMoonBag: 0, // Don't ever trade this number of sellAddress coins

        tradeType: 'TRAILING-STOP-LOSS',

           // TRADE TYPE 5:    TRAILING-STOP-LOSS
        buySTOPPctTSL :  10, // the ammount in percent above the lowest price to execute your buy, 50 is 50 percent, 0.5 is half a percent
        sellSTOPPctTSL : -1 // the ammount in percent above the lowest price to execute your buy, 50 is 50 percent, 0.5 is half a percent
    },
    pair5: {
        activate: false,
        buyAddress: 'BNB',
        sellAddress: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
        buyMoonBag: 0, // Don't ever trade this number of buyAddress coins
        sellMoonBag: 0, // Don't ever trade this number of sellAddress coins

        tradeType: 'DEAD-CAT-BOUNCE',

            // TRADE TYPE 2:    DEAD-CAT-BOUNCE
        buyPriceDCB :  1, 
        sellPctDCB : 50, // this is the percentage increase following the purchase 50 is fifty percent, 0.5 is half a percent
        stopAfterOneBounceDCB : true,
    },
    template: {
        activate: false, // if this is false then this trading strategy will not happen
        buyAddress: 'BNB or an Address',
        sellAddress: 'BNB or an Address',
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
        sellSTOPPctTSL : 10 // the ammount in percent above the lowest price to execute your buy, 50 is 50 percent, 0.5 is half a percent
                // set this to -1 to disable this
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
     Also LESS the amount of _keepBNB specified in the global parameters so you always have
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