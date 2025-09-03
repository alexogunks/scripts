const axios = require('axios');
const faker = require('faker');

// Base URL of the website's API (replace with the correct registration API endpoint)
const BASE_URL = 'https://www.bet88u.com/o/i/69364911/4505';

// Delay function to avoid rate-limiting (e.g., 1 second delay)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Function to create a single account
const createAccount = async () => {
    // Generate random user data using Faker
    // const firstName = faker.name.firstName();
    // const lastName = faker.name.lastName();
    const email = faker.internet.email();
    
    // Generate a password with at least 12 characters, a capital letter, and ending with '1$'
    const password = faker.internet.password(12, false, /[A-Z]/, '1$');

    // Create the payload to be sent in the request body
    const payload = {
        // first_name: firstName,
        // last_name: lastName,
        email: email,
        password: password,
    };

    // Headers, including User-Agent, Referer, and Origin to mimic a real browser
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36',
        'Referer': 'https://www.bet88u.com/o/i/69364911/4505',  // Replace with the actual registration page URL
        'Origin': 'https://www.bet88u.com',            // Replace with the actual website's origin
        'Accept': 'application/json',
    };

    try {
        // Send a POST request to the registration endpoint
        const response = await axios.post(BASE_URL, payload, { headers });

        // Check if the registration was successful
        if (response.status === 201 || response.data.success) {
            console.log(`Account created: ${email}`);
        } else {
            console.log(`Failed to create account: ${email}, Reason: ${response.data.message || 'Unknown error'}`);
        }
    } catch (error) {
        // Detailed error handling with full response
        if (error.response) {
            console.error(`Error creating account: ${email}`);
            console.error(`Status: ${error.response.status}`);
            console.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
            console.error(`Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
        } else {
            console.error(`Error creating account: ${email}, Message: ${error.message}`);
        }
    }
};

// Function to create multiple accounts with a delay to avoid rate-limiting
const createMultipleAccounts = async (numAccounts) => {
    for (let i = 0; i < numAccounts; i++) {
        await createAccount();
        await delay(1000);  // Introduce a 1-second delay between each request
    }
};

// Call the function to create 10 accounts (you can change the number)
createMultipleAccounts(5);
