const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


const endpoint = 'http://localhost:5000/testing';
const authHeader = '';

async function sendRequests(requestCount) {
    const promises = [];
    
    for (let i = 0; i < requestCount; i++) {
        promises.push(
            fetch(`${endpoint}/${i}`, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                }
            })
            .then(response => response.text())
            .then(data => console.log(data))
            .catch(err => console.error('Request failed', err))
        );
    }

    await Promise.all(promises);
    console.log(`Sent ${requestCount} requests successfully`);
}

const requestsPerSecond = 5000;
setInterval(() => {
    sendRequests(requestsPerSecond);
}, 1000);