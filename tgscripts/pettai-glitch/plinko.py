import subprocess

with open('query.txt', 'r') as f:
    queries = [line.strip() for line in f if line.strip()]

data = '{ "ballBet": "10", "amountOfBalls": "10", "nrRows": "8", "risk": "2" }'
url = "https://petbot-monorepo-main-333713154917.europe-west1.run.app/api/plinko/createGame"

for query in queries:
    auth_header = f"Authorization: {query}"
    content_type = "Content-Type: application/json"
    content_length = f"Content-Length: {len(data.encode('utf-8'))}"  # <- accurate byte length

    curl_command = [
        "curl",
        "-X", "POST",
        url,
        "-H", auth_header,
        "-H", content_type,
        "-H", content_length,
        "-d", data
    ]

    def quote_if_needed(arg):
        return f'"{arg}"' if any(c in arg for c in ' &=%{}:,') else arg

    formatted_cmd = " ".join(quote_if_needed(arg) for arg in curl_command)

    # Debug print
    print(f"Running: title Plinko hack && {formatted_cmd}")

    # Run in a new cmd window
    subprocess.Popen([
        "cmd", "/k", f"title Plinko hack && {formatted_cmd}"
    ])
