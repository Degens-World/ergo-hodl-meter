// ============================================================
// Ergo HODL Meter — app.js
// ============================================================

const EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

// ── DOM refs ─────────────────────────────────────────────────
const addressInput   = document.getElementById('addressInput');
const analyzeBtn     = document.getElementById('analyzeBtn');
const loadingSection = document.getElementById('loadingSection');
const loadingText    = document.getElementById('loadingText');
const resultSection  = document.getElementById('resultSection');
const errorSection   = document.getElementById('errorSection');
const errorText      = document.getElementById('errorText');

// ── Stars background ─────────────────────────────────────────
(function spawnStars() {
  const container = document.getElementById('stars');
  for (let i = 0; i < 120; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2.5 + 0.5;
    s.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      --d: ${(Math.random() * 4 + 2).toFixed(1)}s;
      animation-delay: ${(Math.random() * 4).toFixed(1)}s;
      opacity: ${Math.random() * 0.5 + 0.1};
    `;
    container.appendChild(s);
  }
})();

// ── Event listeners ──────────────────────────────────────────
analyzeBtn.addEventListener('click', run);
addressInput.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
document.getElementById('resetBtn').addEventListener('click', reset);
document.getElementById('errorResetBtn').addEventListener('click', reset);

function reset() {
  resultSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  addressInput.value = '';
  addressInput.focus();
}

// ── Main flow ─────────────────────────────────────────────────
async function run() {
  const address = addressInput.value.trim();
  if (!address) {
    addressInput.focus();
    addressInput.style.outline = '2px solid #ff4060';
    setTimeout(() => { addressInput.style.outline = ''; }, 1000);
    return;
  }

  showLoading('Fetching wallet transactions...');
  resultSection.classList.add('hidden');
  errorSection.classList.add('hidden');

  try {
    const [txsData, balanceData] = await Promise.all([
      fetchTransactions(address),
      fetchBalance(address),
    ]);

    setLoadingText('Calculating your degen level...');
    await sleep(600);

    const analysis = analyze(txsData, balanceData, address);
    showResult(analysis);
  } catch (err) {
    showError(err.message || 'Could not fetch wallet data. Check the address and try again.');
  }
}

// ── API calls ─────────────────────────────────────────────────
async function fetchTransactions(address) {
  const url = `${EXPLORER_API}/addresses/${address}/transactions?limit=500&offset=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Explorer API error (${res.status}). Is the address valid?`);
  return res.json();
}

async function fetchBalance(address) {
  const url = `${EXPLORER_API}/addresses/${address}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Explorer API error (${res.status}).`);
  return res.json();
}

// ── Analysis engine ───────────────────────────────────────────
function analyze(txsData, balanceData, address) {
  const txs = txsData.items || [];
  const totalTxCount = txsData.total || txs.length;

  if (txs.length === 0) {
    throw new Error('No transactions found for this address. Is it a fresh wallet?');
  }

  // Sort by timestamp ascending
  const sorted = [...txs].sort((a, b) => a.timestamp - b.timestamp);
  const firstTx = sorted[0];
  const lastTx  = sorted[sorted.length - 1];

  const now       = Date.now();
  const firstDate = new Date(firstTx.timestamp);
  const lastDate  = new Date(lastTx.timestamp);

  const walletAgeDays  = Math.floor((now - firstTx.timestamp) / 86400000);
  const daysSinceLastTx = Math.floor((now - lastTx.timestamp) / 86400000);

  // Balance in ERG (nanoERG → ERG)
  const confirmedNano = balanceData?.confirmed?.nanoErgs ?? 0;
  const ergBalance    = confirmedNano / 1e9;

  // ── Scoring ──────────────────────────────────────────────────
  // Each component out of 25 pts (total 100)

  // 1. Wallet age score (0–25)
  //    >2 years = 25, 1–2 years = 18, 6mo–1yr = 12, <6mo = proportional
  let ageScore;
  if (walletAgeDays >= 730)      ageScore = 25;
  else if (walletAgeDays >= 365) ageScore = 18;
  else if (walletAgeDays >= 180) ageScore = 12;
  else                            ageScore = Math.round((walletAgeDays / 180) * 12);

  // 2. HODL recency score (0–25) — how long since you last moved coins?
  //    >365 days = 25, 180–365 = 20, 90–180 = 14, 30–90 = 8, <30 = proportional
  let hodlScore;
  if (daysSinceLastTx >= 365)      hodlScore = 25;
  else if (daysSinceLastTx >= 180) hodlScore = 20;
  else if (daysSinceLastTx >= 90)  hodlScore = 14;
  else if (daysSinceLastTx >= 30)  hodlScore = 8;
  else                              hodlScore = Math.round((daysSinceLastTx / 30) * 8);

  // 3. Transaction discipline score (0–25)
  //    Fewer tx per year of life = higher score
  const txPerYear = totalTxCount / Math.max(walletAgeDays / 365, 0.1);
  let txScore;
  if (txPerYear <= 5)        txScore = 25;
  else if (txPerYear <= 12)  txScore = 20;
  else if (txPerYear <= 30)  txScore = 14;
  else if (txPerYear <= 60)  txScore = 8;
  else if (txPerYear <= 120) txScore = 4;
  else                       txScore = 1;

  // 4. Balance commitment score (0–25)
  //    Holding real ERG is commitment
  let balScore;
  if (ergBalance >= 10000)      balScore = 25;
  else if (ergBalance >= 1000)  balScore = 20;
  else if (ergBalance >= 100)   balScore = 14;
  else if (ergBalance >= 10)    balScore = 8;
  else if (ergBalance > 0)      balScore = 4;
  else                          balScore = 0;

  const total = ageScore + hodlScore + txScore + balScore;

  // ── Rating tier ───────────────────────────────────────────────
  let tier;
  if (total >= 85)      tier = 'diamond';
  else if (total >= 65) tier = 'gold';
  else if (total >= 45) tier = 'silver';
  else if (total >= 25) tier = 'bronze';
  else                  tier = 'paper';

  const tierMap = {
    diamond: { icon: '💎', label: 'DIAMOND HANDS', sub: 'Absolute Believer. The blockchain is your home.',      color: '#00d4ff' },
    gold:    { icon: '🥇', label: 'GOLD HANDS',    sub: 'Committed holder. You know how this works.',           color: '#ffd700' },
    silver:  { icon: '🥈', label: 'SILVER HANDS',  sub: 'Decent discipline. A few more sunsets and you\'ll shine.', color: '#aaaaaa' },
    bronze:  { icon: '🥉', label: 'BRONZE HANDS',  sub: 'Still finding your footing. Keep accumulating.',       color: '#cd7f32' },
    paper:   { icon: '📄', label: 'PAPER HANDS',   sub: 'The slightest dip and you flee. Work on that.',        color: '#ff4060' },
  };

  const prophecy = generateProphecy(tier, walletAgeDays, daysSinceLastTx, ergBalance, totalTxCount);

  return {
    total, tier, tierMap,
    walletAgeDays, daysSinceLastTx, totalTxCount, ergBalance,
    breakdown: [
      { label: 'Wallet age',          pts: ageScore,  max: 25, color: '#00e676' },
      { label: 'HODL patience',       pts: hodlScore, max: 25, color: '#00d4ff' },
      { label: 'Tx discipline',       pts: txScore,   max: 25, color: '#f7931a' },
      { label: 'Balance commitment',  pts: balScore,  max: 25, color: '#ffd700' },
    ],
    prophecy,
    firstDate, lastDate,
  };
}

// ── Prophecy generator ────────────────────────────────────────
function generateProphecy(tier, ageDays, idleDays, erg, txCount) {
  const prophecies = {
    diamond: [
      `The ancient ones spoke of wallets like yours — sleeping giants that have outlasted three bear markets, two hard forks, and one very bad tweet. Your ERG slumbers, and in that slumber, empires crumble while your stack endures. The oracle sees: you will not sell. Not today. Not when it moons. Not ever. You've become the blockchain itself.`,
      `${ageDays} days since your first on-chain breath. ${idleDays} days of perfect silence. The blockchain has felt your stillness and whispered back: "This one understands." Your wallet is not an asset — it is a monument. The oracle decrees: you will be mentioned in the post-capitalist history books.`,
      `Other wallets panic-sold at the first rumor. Yours remained. Still. Patient. The oracle sees your ${ergBalance(erg)}-ERG vault and knows — this is not investment, this is religion. Diamond hands are not born, they are forged. You have been forged.`,
    ],
    gold: [
      `Your wallet carries the quiet confidence of someone who has seen a -70% dip and simply said "interesting." Not quite a diamond — but gold doesn't need to be diamonds to be worth everything. The oracle sees you holding through the next storm. Almost there.`,
      `${ageDays} days of on-chain existence, ${idleDays} days of voluntary stillness. The oracle sees a holder of conviction, one coin-flip away from legend status. Keep your hands warm. The upgrade is coming.`,
      `You buy. You hold. You resist the Discord whispers. The oracle nods approvingly. Your ${ergBalance(erg)} ERG stack grows heavy with intent. One more bear market survived and the diamond tier opens to you.`,
    ],
    silver: [
      `The oracle sees potential shadowed by occasional weakness. ${txCount} transactions suggest you've dipped your toe into the selling pool more than a true HODL master would admit. But ${ageDays} days of commitment says you're not done yet. Polish yourself — silver can become gold with heat.`,
      `You are at the crossroads, traveler. One path leads to diamond hands, the other to a sad exit at -8%. The oracle senses ${idleDays} quiet days and believes you're leaning toward glory. Keep leaning.`,
      `A middle path walker. Not paper, not gold. The oracle sees your ${ergBalance(erg)} ERG balance and reads indecision in the transaction runes. Resolve it. Choose your lane. The blockchain rewards the committed.`,
    ],
    bronze: [
      `The oracle has seen your wallet and is choosing its words carefully. ${txCount} transactions. Let's just say: you move coins like you're late for the bus. But you're still here, ${ageDays} days in — that's something. Most paper hands are long gone by now.`,
      `Early days. Shaky hands, but not fully paper. The oracle sees a future holder — one who has learned from the scars of selling too soon. ${idleDays} days since your last move is promising. Maybe you're changing.`,
      `Your HODL journey is… a work in progress. The oracle sees ${ergBalance(erg)} ERG and a transaction history that tells stories of doubt. Build the habit. The blockchain is patient. Are you?`,
    ],
    paper: [
      `The oracle does not sugarcoat: your hands are soft. Like fresh baked bread soft. Like tissue paper in a hurricane soft. ${txCount} transactions in ${ageDays} days? Every pump you sold. Every dip you fled. The blockchain has your whole history, and it is judging you right now.`,
      `"Sell the news" — that's what the oracle sees written in your transaction runes. Your ${ergBalance(erg)} ERG balance is a testament to your survival, but barely. The oracle prescribes one thing: close the price chart. Breathe. Come back in 365 days.`,
      `Every time the market sneezed, your wallet caught a cold. ${idleDays} days of stillness is the longest streak the oracle has detected. That's progress. Barely. The oracle suggests: remove the app. Lose the seed phrase. Just kidding — but HODL, please.`,
    ],
  };

  const pool = prophecies[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}

function ergBalance(erg) {
  if (erg >= 1000) return erg.toFixed(0);
  if (erg >= 10)   return erg.toFixed(2);
  return erg.toFixed(4);
}

// ── Render result ─────────────────────────────────────────────
function showResult(a) {
  hideLoading();

  const { tier, tierMap, total, walletAgeDays, daysSinceLastTx, totalTxCount, ergBalance: erg, breakdown, prophecy } = a;
  const info = tierMap[tier];

  // Badge
  const badge = document.getElementById('ratingBadge');
  badge.className = `rating-badge ${tier}-hands`;
  document.getElementById('ratingIcon').textContent    = info.icon;
  document.getElementById('ratingTitle').textContent   = info.label;
  document.getElementById('ratingSubtitle').textContent = info.sub;

  // Score meter — animate after brief delay
  setTimeout(() => {
    document.getElementById('meterFill').style.width = `${total}%`;
    document.getElementById('scoreDisplay').textContent = total;
  }, 100);

  // Stats
  document.getElementById('statAge').textContent         = walletAgeDays.toLocaleString();
  document.getElementById('statLastMove').textContent    = daysSinceLastTx.toLocaleString();
  document.getElementById('statTxCount').textContent     = totalTxCount.toLocaleString();
  document.getElementById('statBalance').textContent     = ergBalance(erg);

  // Breakdown
  const breakdownContainer = document.getElementById('breakdownItems');
  breakdownContainer.innerHTML = '';
  breakdown.forEach(row => {
    const pct = Math.round((row.pts / row.max) * 100);
    const el = document.createElement('div');
    el.className = 'breakdown-row';
    el.innerHTML = `
      <div class="breakdown-label">${row.label}</div>
      <div class="breakdown-bar-track">
        <div class="breakdown-bar-fill" data-pct="${pct}" style="width:0%; background:${row.color};"></div>
      </div>
      <div class="breakdown-pts" style="color:${row.color}">${row.pts}<span style="color:#6b6b8a;font-weight:400">/${row.max}</span></div>
    `;
    breakdownContainer.appendChild(el);
  });

  // Animate breakdown bars
  setTimeout(() => {
    document.querySelectorAll('.breakdown-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.pct + '%';
    });
  }, 200);

  // Prophecy
  document.getElementById('prophecyText').textContent = prophecy;

  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Loading helpers ───────────────────────────────────────────
function showLoading(msg) {
  loadingText.textContent = msg;
  loadingSection.classList.remove('hidden');
}
function setLoadingText(msg) {
  loadingText.textContent = msg;
}
function hideLoading() {
  loadingSection.classList.add('hidden');
}
function showError(msg) {
  hideLoading();
  errorText.textContent = msg;
  errorSection.classList.remove('hidden');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
