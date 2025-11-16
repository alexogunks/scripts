import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

/** ====== ENV / CONSTANTS ====== */
const endpoint = "wss://ws.pett.ai/";
const origin = "https://app.pett.ai";
const pettName = `mines_${Math.floor(Math.random() * 999999)}_t1`;
const jwt = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWgyZDIwNTEwMTR4bDEwYmNydW8wNWQ0IiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NjMxMDEyNjcsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21lMGNkdWUyMDAycWwxMGF1dWdqanZ3bSIsImV4cCI6MTc2MzEyMjg2N30.Ya7QsAhQdcwvhP5di59qNDEiHqzo_oMcN7tl2If-TDxhCKaVtIzmySWyxZ0pLcdntCpLyrQMngeNFxaaOznFsw"

/** ====== CONFIG ====== */
const TOTAL_SOCKETS = 15; // number of sockets
const ROWS = 14;
const COLS = 10;
const TOTAL_MINES = 500;
let SAFE_TILES = [{ row: 0, col: 0 }, { row: 0, col: 0 }];

const BLAST_INTERVAL_MS = 55; // send mines payload every 2 seconds
const NONCE_INTERVAL_MS = 0;   // optional stagger between sockets

let tokenBalance = 0;

/** ====== HELPERS ====== */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function uniqueNonce() {
  return uuidv4();
}

/** ====== MAKE MINES PAYLOAD ====== */
function makeMinesPayload() {
    if (!SAFE_TILES.length) return null;
    const index = Math.floor(Math.random() * SAFE_TILES.length);
    const tile = SAFE_TILES.splice(index, 1)[0];
    return JSON.stringify({
      type: "MINESWEEPER_UNVEIL",
      data: {
        params: {
          position: { row: tile.row, col: tile.col },
          type: "unveil",
          difficulty: { rows: ROWS, cols: COLS, mines: TOTAL_MINES, name: "advanced" }
        }
      },
      nonce: uniqueNonce()
    });
}

/** ====== SOCKET HANDLING ====== */
let sockets = [];
let updated = 0;

const decode = (msg) => {
    if (updated > 0) return null;
    if ((msg?.type === "data" || msg?.type === "error") && msg?.data?.currentGame?.board) {
        const board = msg.data.currentGame.board;
        SAFE_TILES = []; // reset safe tiles
        for (let row = 0; row < board.length; row++) {
            for (let col = 0; col < board[row].length; col++) {
            const tile = board[row][col];
                if (!tile.isMine) {
                    SAFE_TILES.push({ row: tile.row, col: tile.col });
                    updated++
                }
            }
        }
        console.log(`✅ SAFE_TILES updated: ${SAFE_TILES.length} safe positions`);
    }
}

function connectSocket(socketId) {
  const headers = {
    Origin: origin,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  };

  const ws = new WebSocket(endpoint, { headers, perMessageDeflate: false });
  const sock = { ws, id: socketId, didAuth: false };

  ws.on("open", async () => {
    sockets.push(sock);
    console.log(`✅ Socket ${socketId} connected (${sockets.length}/${TOTAL_SOCKETS})`);

    // AUTH first
    ws.send(JSON.stringify({
      type: "AUTH",
      data: { params: { authType: "privy", authHash: { hash: jwt } } },
      nonce: uniqueNonce()
    }));

    sock.didAuth = true;

    // wait a short moment before sending first payload
    await sleep(500);

    // start blasting only when all sockets are connected
    if (sockets.length === TOTAL_SOCKETS) startBlastWave();
  });

  ws.on("message", async (m) => {
    let msg;
    try {
      msg = JSON.parse(m.toString());
      console.log('Message: ', msg);
    } catch {
      console.log("📩 (non-JSON message)", m.toString());
      return;
    }
  
    // ====== DECODE MINESWEEPER BOARD ======
    decode(msg);

    if (msg?.type === 'rate_limited') {
        console.log('Rate limited... Sleeping...')
        await sleep(Number(msg?.retryAfter * 1000))
    }

    // ====== EXISTING HANDLER LOGIC ======
    const lower = msg?.error?.toLowerCase()
    if (lower !== 'too many requests. please wait to try again.') {
      if (lower) console.log(JSON.stringify(msg?.error));
    }
  
    // Token balance
    if (msg?.pet?.PetTokens?.tokens != null) {
      tokenBalance = Number(msg.pet.PetTokens.tokens);
      const tokenBalanceDisplay = Math.floor(Number(tokenBalance / 1000000000000000000));
      console.log(`💰 Token balance: ${tokenBalanceDisplay}`);
    }
  });

  ws.on("close", () => {
    console.log(`🔒 Socket ${socketId} closed`);
    sockets = sockets.filter(s => s.id !== socketId);
  });

  ws.on("error", (err) => {
    console.error(`❌ Socket ${socketId} error:`, err?.message || err);
  });
}


/** ====== BLAST WAVE (randomized mines each wave) ====== */
let blasting = false;
let waveCounter = 0;

function startBlastWave() {
    if (blasting) return;
    blasting = true;

    async function wave() {
        if (!sockets.length) {
            console.log("⚠ No live sockets, stopping blast wave");
            blasting = false;
            return;
        }

        waveCounter++;
        console.log(`⚡ Blast Wave #${waveCounter} sending safe tiles...`);

        // If all tiles used, wait for board update
        if (!SAFE_TILES.length) {
            console.log("⏳ No unused safe tiles left, waiting for board update...");
            setTimeout(wave, BLAST_INTERVAL_MS);
            return;
        }

        let delay = 0;
        for (const sock of sockets) {
            setTimeout(() => {
                if (sock.ws.readyState === WebSocket.OPEN && sock.didAuth) {
                    const payload = makeMinesPayload();
                    if (payload) {
                        sock.ws.send(payload);
                        console.log(`💣 Socket ${sock.id} sent mines payload`);
                    }
                }
            }, delay);
            delay += NONCE_INTERVAL_MS;
        }

        setTimeout(wave, BLAST_INTERVAL_MS);
    }

    wave();
}

/** ====== BOOT ====== */
console.log(`🔌 Connecting ${TOTAL_SOCKETS} sockets for mines blast...`);
for (let i = 0; i < TOTAL_SOCKETS; i++) connectSocket(i + 1);