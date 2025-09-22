SCRIPT="ws-automated-v3.3.3.js"

pkill -f "node $SCRIPT"

sleep 2

nohup node "$SCRIPT" > output.log 2>&1 &
echo "✅ Restarted $SCRIPT"
