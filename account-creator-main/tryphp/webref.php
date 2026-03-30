<?php

// URL of the registration endpoint (replace this if it's different after inspecting the form action)
$signupUrl = 'https://www.bet88u.com/o/i/69364911/4505';

// Generate 1000 accounts dynamically
function generateAccounts($total = 1000) {
    $accounts = [];
    for ($i = 1; $i <= $total; $i++) {
        $randomSuffix = rand(1000, 9999); // Add a random number to avoid duplicates
        // $username = "testuser{$i}_{$randomSuffix}";
        $email = "aoworks{$i}_{$randomSuffix}@gmail.com";
        $password = "aoworks{$i}_{$randomSuffix}";  // You can make this dynamic too
        $accounts[] = [
            // 'username' => $username,
            'email' => $email,
            'password' => $password
        ];
    }
    return $accounts;
}

// Function to create an account using cURL
function createAccount($account) {
    global $signupUrl;

    $ch = curl_init();

    // Prepare POST data
    $postData = [
        // 'username' => $account['username'],
        'email' => $account['email'],
        'password' => $account['password'],
        // Add other fields as required by the form (check from the form using Developer Tools)
    ];

    curl_setopt($ch, CURLOPT_URL, $signupUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    // If SSL verification causes issues, you can disable it (not recommended for production environments)
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

    // Execute the request
    $response = curl_exec($ch);

    // Check for errors
    if ($response === false) {
        echo "cURL Error: " . curl_error($ch) . "\n";
    } else {
        echo "Account created: " . $account['username'] . "\n";
    }

    // Close the cURL session
    curl_close($ch);

    // Return the response for debugging purposes
    return $response;
}

// Generate 1000 accounts
$accounts = generateAccounts(1000);

// Loop through accounts and create each one
foreach ($accounts as $account) {
    createAccount($account);

    // Introduce a small delay between account creations to avoid being flagged by the server
    sleep(1); // Wait 1 second between each account creation to reduce load on the server
}

?>
