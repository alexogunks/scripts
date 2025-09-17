# === Windows Socket Boost Script ===
Write-Host "Applying TCP/IP tuning for high socket counts..."

# Expand ephemeral port range (IPv4 + IPv6)
netsh int ipv4 set dynamicport tcp start=1025 num=64510
netsh int ipv6 set dynamicport tcp start=1025 num=64510

# Lower TIME_WAIT delay to 30s
reg add "HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" /v TcpTimedWaitDelay /t REG_DWORD /d 30 /f

# Increase max available ports (MaxUserPort)
reg add "HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" /v MaxUserPort /t REG_DWORD /d 65534 /f

# Raise max connections tracking
reg add "HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" /v MaxFreeTcbs /t REG_DWORD /d 65535 /f
reg add "HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" /v MaxHashTableSize /t REG_DWORD /d 65535 /f

Write-Host "✅ TCP/IP tuning applied. Please reboot for changes to take effect."
