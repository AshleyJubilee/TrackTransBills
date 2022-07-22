import { getSearch } from "./API/legiscan.js";
import { getBill } from "./API/legiscan.js";
import { getLegiscanID } from "./API/legiscan.js";
import { sendTweet } from "./API/twitter.js";
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';



//Google Sheets Authentication and Initialation
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID)
    await doc.useServiceAccountAuth({
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY,
    });
    await doc.loadInfo();
;

const sheet0 = doc.sheetsByIndex[0];
const rows0 = await sheet0.getRows();
const sheet1 = doc.sheetsByIndex[1];
const rows1 = await sheet1.getRows();
const sheet4 = doc.sheetsByIndex[4];
const rows4 = await sheet4.getRows();




async function updateWatchList() {
    const getSearchResults = await getSearch(
        'all',
        'transgender+OR+(gender+NEAR+affirming+NEAR+care)+OR+(biological+NEAR+sex)',
    )
    const legiscanSearchResults = getSearchResults.data.searchresult 


    //Adds Bills to legiscanWatchList
    let legiscanWatchList = []

    for (let i = 0; i < 30; i++) {
            legiscanWatchList.push(legiscanSearchResults[i].state + ' ' + legiscanSearchResults[i].bill_number)
    }


    //Pulls watch list from Google Sheets
    let sheetsWatchList = []

    function readSheetsColumn0(i, header, rows0) {
        return rows0[i][header]
    };

    for (let i = 0; i < rows0.length; i++) {
        sheetsWatchList.push(readSheetsColumn0(i, 'bill_id', rows0))
    }
    

    //Pulls airtableWatchList from Google Sheets
    let airtableWatchList = []

    function readSheetsColumn4(i, header, rows4) {
        return rows4[i][header]
    };

    for (let i = 0; !!readSheetsColumn4(i, 'Active Bills', rows4); i++) {
        airtableWatchList.push(readSheetsColumn4(i, 'Active Bills', rows4))
    }


    //Pulls invalidWatchList from Google Sheets
    let invalidWatchList = []

    for (let i = 0; !!readSheetsColumn4(i, 'Invalid Bills', rows4); i++) {
        invalidWatchList.push(readSheetsColumn4(i, 'Invalid Bills', rows4))
    }   


    //(Airtable + Legiscan) - (Sheets + Invalid) - Duplicates = Add to Google Sheets
    const airtablePlusLegiscan = [...new Set(airtableWatchList.concat(legiscanWatchList))]
    const sheetsPlusInvalid = [...new Set(sheetsWatchList.concat(invalidWatchList))]

    let addToSheetList = []
    for (let i = 0; i < airtablePlusLegiscan.length; i++) { 
            if (sheetsPlusInvalid.indexOf(airtablePlusLegiscan[i]) == -1) {
                addToSheetList.push(airtablePlusLegiscan[i])
         }
    }

    //Write addToSheetList to Google Sheets
    let addToSheetObject = addToSheetList.map(
        function(element){
        return {'bill_id':element}
    })
    
    const addToSheets = await sheet0.addRows(addToSheetObject)
}

updateWatchList()


//Adds Legiscan_ID to sheets if none there
async function addLegiscanID() {

    //If no legiscan_ID, search, then add
    for(const row of rows0) {
        if (!row['legiscan_id']) {
            const legiscanData = await getLegiscanID(
                row['bill_id'].split(' ')[0],
                row['bill_id'].split(' ')[1]
            )

            row['legiscan_id'] = legiscanData.data.searchresult['0'].bill_id;
            await row.save();
        }
    }
}

addLegiscanID()

//Checks and Updates Statuses, then Tweets Bills with Updated Status
async function processBills() {

    //Initializes Sheets

    let sheetsWatchList = []

    function readSheetsColumn0(i, header, rows0) {
        return rows0[i][header]
    };

    for (let i = 0; i < rows0.length; i++) {
        sheetsWatchList.push(readSheetsColumn0(i, 'bill_id', rows0))
    }

    let legislature = []

    function readSheetsColumn1(i, header, rows1) {
        return rows1[i][header]
    };

    for (let i = 0; i < 51; i++) {
        legislature.push(readSheetsColumn1(i, 'Short', rows1))
    }


    //Updates Status if out of date, and sends out of date bills to tweetList.
    //Deletes Passed, Vetoed, and Failed Bills
    let tweetList = []
    for(const row of rows0) {
        const legiscanData = await getBill(row['legiscan_id'])
        if (row['status'] != legiscanData.data.bill.status) {
            tweetList.push(row['bill_id'])
            row['status'] = legiscanData.data.bill.status
            await row.save();
        }
    }


    //Generates Tweet Text, then tweets bill
    for (const item of tweetList) {
        //Matches tweetList item with sheets index to pull sheets data
        let i = sheetsWatchList.indexOf(item)


        //Gets Legiscan Data with getBill
        let legiscanResponse = await getBill(rows0[i]['legiscan_id'])
        let j = legislature.indexOf(legiscanResponse.data.bill.state)

        //Defines action with Legiscan data
        let action = ''
        const votesId = (legiscanResponse.data.bill.votes).length - 1
        switch (legiscanResponse.data.bill.status) {
            case 1:
                if (legiscanResponse.data.bill.sponsors.length > 0) {
                    action = `has been introduced by ${legiscanResponse.data.bill.sponsors[0].role}. ${legiscanResponse.data.bill.sponsors[0].last_name}, (${legiscanResponse.data.bill.sponsors[0].party}).`;
                } else {
                    action = `has been introduced.`;
                }
                break;
            case 2:
                action = `has passed the ${legiscanResponse.data.bill.votes[votesId].chamber == 'H' ? 'House' : 'A' ? 'House' : 'S' ? 'Senate' :  'Legislature' 
                } by a vote of ${legiscanResponse.data.bill.votes[votesId].yea}-${legiscanResponse.data.bill.votes[votesId].nay
                }-${legiscanResponse.data.bill.votes[votesId].absent}.`;
                break;    
            case 3:
                action = `has passed the ${legiscanResponse.data.bill.votes[votesId].chamber == 'H' ? 'House' : 'A' ? 'House' : 'S' ? 'Senate' :  'Legislature'
                } by a vote of ${legiscanResponse.data.bill.votes[votesId].yea}-${legiscanResponse.data.bill.votes[votesId].nay
                }-${legiscanResponse.data.bill.votes[votesId].absent} and moves to the desk of ${rows1[j]['Governor']}.`;
                break;
            case 4:
                action = `has been signed by ${rows1[j]['Governor']}.`;
                break;  
            case 5:
                action = `has been vetoed by ${rows1[j]['Governor']}.`;
                break;    
            case 6:
                action = `has failed. Link to bill below for more infomation.`;
                break;  
        }

        if (legiscanResponse.data.bill.sine_die = 1) {
            action = `has failed sine die. The ${rows1[j]['Short']} legislative session has ended.`
        }
    

        //Constructs Main Tweet Text
        const intro = `🏳️‍⚧️⚖️ ` + `${item}, ` + `${rows0[i]['category']}, ` + `${action}`

        const description = `\n\n ${rows0[i]['description']}`

        
        let mainTweet = intro + description


        //Constructs Replies
        let stateHouse = `${rows1[j]['Short']} House: ${rows1[j]['House']}`
        let stateSenate = `${rows1[j]['Short']} Senate: ${rows1[j]['Senate']}`
        let stateGovernor = `${rows1[j]['Short']} Governor: ${rows1[j]['Governor']}`
        let stateContact = `${rows1[j]['Representative Contact Link']}`

        const replyOne = `${stateHouse}` + `\n${stateSenate}` + `\n${stateGovernor}` + `\n${stateContact}`
        const replyTwo = `Link to bill: https://legiscan.com/${legiscanResponse.data.bill.state}/bill/${legiscanResponse.data.bill.bill_number}/${legiscanResponse.data.bill.session.year_start}`


        //Tweet Data
        let tweetData = []
        tweetData.push(mainTweet)
        tweetData.push(replyOne)
        tweetData.push(replyTwo)

        if (rows0[i]['category'] == '' || rows0[i]['description'] == '') {
            console.log('tweet no')
            return 
        }
            else {
            sendTweet(tweetData)
            console.log('tweet go')
        }
    }
}

processBills()


