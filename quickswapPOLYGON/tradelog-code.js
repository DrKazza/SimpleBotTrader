// To create the log file
const readline = require('readline');

const confirmDialog = (confirmQuestion) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    var response;
    rl.setPrompt(`${confirmQuestion}... continue [Y/n]`);
    rl.prompt();
    return new Promise (( resolve, reject) =>{
        rl.on('line', (userInput) => {
            response = userInput;
            rl.close();
        });
        rl.on('close', () => {resolve(response);});
    });
}

// EVERY TRADE IS PUSHED TO A TRADE LOG WITH A TIMESTAMP
const appendTradeLog = (stream, messageToSave) => {
    let execTime = new Date();
    let execTimeStamp = execTime.getHours() + ":" + execTime.getMinutes().toString().padStart(2,'0') + ":" + execTime.getSeconds().toString().padStart(2,'0');
    stream.write(`${execTimeStamp} - ${messageToSave}`);
    console.log(`${execTimeStamp} - ${messageToSave}`);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

module.exports = {appendTradeLog, confirmDialog, delay};
