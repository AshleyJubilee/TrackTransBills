import * as dotenv from 'dotenv'
dotenv.config()
import { TwitterApi } from 'twitter-api-v2'

const client = new TwitterApi({
    //Twitter Client
    appKey: process.env.APP_KEY,
    appSecret: process.env.APP_SECRET,
    accessToken: process.env.ACCESS_TOKEN,
    accessSecret: process.env.ACCESS_SECRET,
});

export function sendTweet(data) {
    client.readWrite.v1.tweetThread(data);
}