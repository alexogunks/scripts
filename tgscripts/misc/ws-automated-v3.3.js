import WebSocket from "ws";
import crypto from "crypto";

/** CONFIG **/
const ENDPOINT = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const ORIGIN = "https://app.pett.ai";
const JWT = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZyaDJ3bWkwMDFubDIwZGFvc2YxYzFwIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTgzNzA4MjMsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21lMGx0N25mMDA5MWpsMGJ6b2tybDB4aiIsImV4cCI6MTc1ODM3NDQyM30.NlQr2X_-_b9KcTVfcGdsjzOAD4pZOGYu3g-BZ30-ubuKc28l8FDiWGtpdTZ--Yea55YtlFkIpwVjCVf9PJk85Q"

// pick mode
const type = "5-socket"; // "5-socket" | "1-socket"

const INTER_MESSAGE_DELAY_MS = 500;
const HEARTBEAT_PING_MS = 5000;
const AUTH_REFRESH_MS = 1500;
const CONNECT_TIMEOUT_MS = 2000;
const RECONNECT_DELAY_MS = 2000;

const FOOD_TYPE = "COOKIE"; // "SALAD" | "COOKIE"
const PLAY_TIMES = 5;       // how many play actions per cycle

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const nonce = () => crypto.randomUUID();

/** MESSAGE BUILDERS **/
const makeAuthString = (jwt = JWT) => JSON.stringify({
  type: "AUTH",
  data: { params: { authType: "privy", authHash: { hash: jwt } } },
  nonce: nonce(),
});
const makeEnergyString = () => JSON.stringify({
  type: "CONSUMABLES_USE",
  data: { params: { foodId: "ENERGIZER" } },
  nonce: nonce()
});
const makePlayString = () => JSON.stringify({
  type: "THROWBALL",
  data: {},
  nonce: nonce()
});
const makeBathString = () => JSON.stringify({
  type: "SHOWER",
  data: {},
  nonce: nonce(),
});
const makeEatString = () => JSON.stringify({
  type: "CONSUMABLES_USE",
  data: { params: { foodId: FOOD_TYPE } },
  nonce: nonce()
});
const makeHealthString = () => JSON.stringify({
  type: "CONSUMABLES_USE",
  data: { params: { foodId: FOOD_TYPE === "SALAD" ? FOOD_TYPE : "LARGE_POTION" } },
  nonce: nonce()
});

/** RobustSocket **/
class RobustSocket {
  constructor(actionType = null, smart = false) {
    this.actionType = actionType;
    this.smart = smart;
    this.ws = null;
    this.isAlive = false;
    this.heartbeatTimer = null;
    this.authTimer = null;
    this.connectTimer = null;
    this.stopped = false;
    this.lastStats = null;

    this.lastMessageTime = Date.now();
    this.skippedSends = 0;
  }

  async start() {
    this.stopped = false;
    await this._connect();
  }

  stop() {
    this.stopped = true;
    this._clearTimers();
    try { this.ws?.terminate(); } catch {}
  }

  _clearTimers() {
    [this.heartbeatTimer, this.authTimer, this.connectTimer]
      .forEach(t => { if (t) clearInterval(t) || clearTimeout(t); });
    this.heartbeatTimer = this.authTimer = this.connectTimer = null;
  }

  async _connect() {
    if (this.stopped) return;
    const headers = { Origin: ORIGIN, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };

    console.log(`[${this.actionType || "smart"}] connecting...`);
    this.ws = new WebSocket(ENDPOINT, { headers, perMessageDeflate: false });

    // if not open in CONNECT_TIMEOUT_MS → close & retry
    this.connectTimer = setTimeout(() => {
      if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        console.warn(`[${this.actionType}] connect timeout → retrying`);
        try { this.ws.terminate(); } catch {}
        this._scheduleReconnect(0);
      }
    }, CONNECT_TIMEOUT_MS);

    this.ws.on("open", async () => await this._onOpen());
    this.ws.on("message", (m) => this._onMessage(m));
    this.ws.on("pong", () => { this.isAlive = true; });
    this.ws.on("close", () => this._onClose());
    this.ws.on("error", (err) => console.error(`[${this.actionType}] error:`, err?.message || err));
  }

  async _onOpen() {
    clearTimeout(this.connectTimer);
    console.log(`✅ [${this.actionType || "smart"}] socket open`);

    await this._safeSend(makeAuthString());
    await sleep(250);

    this.isAlive = true;
    this.lastMessageTime = Date.now();
    this.skippedSends = 0;

    // heartbeat watchdog
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      // watchdog: no messages in 5s → reconnect
      if (Date.now() - this.lastMessageTime > 5000) {
        console.warn(`[${this.actionType}] no messages in 5s → reconnecting`);
        try { this.ws.terminate(); } catch {}
        return;
      }

      if (!this.isAlive) {
        console.warn(`[${this.actionType}] missed pong → reconnecting`);
        try { this.ws.terminate(); } catch {}
        return;
      }
      this.isAlive = false;
      this.ws.ping(() => {});
    }, HEARTBEAT_PING_MS);

    // refresh auth periodically
    this.authTimer = setInterval(() => {
      this._safeSend(makeAuthString());
    }, AUTH_REFRESH_MS);

    this._runLoop().catch(e => console.error(`[${this.actionType}] loop stopped:`, e?.message));
  }

  async _safeSend(payload) {
    let tries = 0;
    while (this.ws && this.ws.readyState !== WebSocket.OPEN && tries < 10) {
      await sleep(100);
      tries++;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      this.skippedSends = 0; // reset counter
    } else {
      this.skippedSends++;
      console.warn(`[${this.actionType}] skipped send (${this.skippedSends}) — socket not open`);
      if (this.skippedSends > 20) {
        console.warn(`[${this.actionType}] too many skipped sends → reconnecting`);
        try { this.ws.terminate(); } catch {}
      }
    }
  }

  _onMessage(raw) {
    this.lastMessageTime = Date.now(); // refresh watchdog
    try {
      const obj = JSON.parse(raw.toString());
      if (obj.type === "auth_result" && obj.pet?.PetStats) {
        this.lastStats = obj.pet.PetStats;
      }

      if (obj?.error) {
        console.warn(`[${this.actionType}] server error:`, obj.error);
        const lowerErr = String(obj.error).toLowerCase();
        if (lowerErr.includes("pet has reached the maximum for energy") || lowerErr.includes("pet does not have enough energy")) {
          console.log(`[${this.actionType}] ⚡ auto-fixing energy low`);
          this._safeSend(makeEnergyString());
        }

        if (lowerErr.includes("pet does not have enough health") || lowerErr.includes("pet has reached the maximum for health")) {
          console.log(`[${this.actionType}] ❤️ auto-fixing health low`);
          this._safeSend(makeHealthString());
        }
      }
    } catch {}
  }

  _onClose() {
    this._clearTimers();
    console.warn(`🔒 [${this.actionType}] socket closed, reconnecting...`);
    if (!this.stopped) this._scheduleReconnect(RECONNECT_DELAY_MS);
  }

  _scheduleReconnect(delayMs) {
    if (this.stopped) return;
    setTimeout(() => this._connect(), delayMs);
  }

  async _runLoop() {
    while (!this.stopped) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await sleep(500);
        continue;
      }

      if (this.smart) {
        const s = this.lastStats;
        if (s) {
          const hunger = Math.floor(parseFloat(s.hunger));
          const health = Math.floor(parseFloat(s.health));
          const hygiene = Math.floor(parseFloat(s.hygiene));

          if (hunger < 25) {
            this._safeSend(makeEatString());
          } else if (health < 70) {
            this._safeSend(makeHealthString());
          } else if (hygiene < 70) {
            this._safeSend(makeBathString());
          } else {
            for (let i = 0; i < PLAY_TIMES; i++) {
              this._safeSend(makePlayString());
              await sleep(INTER_MESSAGE_DELAY_MS);
            }
          }
        }
      } else {
        switch (this.actionType) {
          case "eat":    this._safeSend(makeEatString()); break;
          case "energy": this._safeSend(makeEnergyString()); break;
          case "play":   this._safeSend(makePlayString()); break;
          case "bath":   this._safeSend(makeBathString()); break;
          case "health": this._safeSend(makeHealthString()); break;
        }
      }
      await sleep(INTER_MESSAGE_DELAY_MS);
    }
  }
}

/** BOOT **/
(async () => {
  if (type === "5-socket") {
    const sockets = [
      new RobustSocket("eat"),
      new RobustSocket("energy"),
      new RobustSocket("play"),
      new RobustSocket("bath"),
      new RobustSocket("health"),
    ];
    for (const s of sockets) s.start();
  } else {
    const smart = new RobustSocket(null, true);
    smart.start();
  }
})();
