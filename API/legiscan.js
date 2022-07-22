import * as dotenv from 'dotenv'
dotenv.config()
import axios from 'axios'
const apiKeyLegiscan = process.env.API_KEY

//API request to keyword search Legiscan
export async function getSearch(state, query) {
    const responseData = await axios.get(
       `https://api.legiscan.com/?key=${apiKeyLegiscan}&op=getSearch&year=2&state=${state}&query=${query}`
    );
    return responseData;
};

//API request to search for specific bill
export async function getBill(id) {
    const responseData = await axios.get(
            `https://api.legiscan.com/?key=${apiKeyLegiscan}&op=getBill&id=${id}`
    );
    return responseData;
};

export async function getLegiscanID(state, bill) {
    const responseData = await axios.get(
        `https://api.legiscan.com/?key=${apiKeyLegiscan}&op=getSearch&state=${state}&bill=${bill}`
    );
    return responseData;
};