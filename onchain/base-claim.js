import { ethers } from "ethers";

const RPC="https://mainnet.base.org";
const MNEMONIC="PUT YOUR SEED PHRASE HERE";
const COUNT=100;
const BATCH=20;
const DELAY=300;
const TO="0xReceiver";
const AMOUNT="0.0001";

const provider = new ethers.JsonRpcProvider(RPC);

function wallet(i){
  return ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`).connect(provider);
}

async function dummyNonce (addr){
  return "LOGIN_" + addr.slice(0, 6) + "_" + Date.now();
}

async function dummyVerify (addr, sig){
  return "TOKEN_" + Buffer.from(addr + sig).toString("base64").slice(0, 32);
}

async function dummySwap(token, addr){
  return { ok:true, session:token, address:addr };
}

async function send(i, retry=0){
  try{
    const w = wallet(i);
    const addr = await w.getAddress();
    const nonce = await dummyNonce(addr);
    const sig = await w.signMessage(nonce);
    const token = await dummyVerify(addr, sig);
    await dummySwap(token, addr);
    const tx = await w.sendTransaction({ to:TO, value:ethers.parseEther(AMOUNT) });
    return { i, hash:tx.hash };
  }catch(e){
    if(retry < 2) return send(i, retry+1);
    return { i, error:e.message };
  }
}

function sleep(ms){return new Promise(r => setTimeout(r, ms));}

async function main(){
  let i = 0;
  while(i < COUNT){
    const jobs=[];
    for(let j = 0; j < BATCH && i < COUNT; j++, i++)jobs.push(send(i));
    console.log(await Promise.allSettled(jobs));
    await sleep(DELAY);
  }
}

main();