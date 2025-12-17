function $(id){ return document.getElementById(id); }

const STORE_KEY = "xau_signal_tool_v4";
let LAST = null;
let MODE = "risk"; // "risk" or "margin"

/* -------------------- Navigation -------------------- */
function showPage(page){
  const trade = $("pageTrade");
  const settings = $("pageSettings");
  const tabTrade = $("tabTrade");
  const tabSettings = $("tabSettings");

  if (page === "settings"){
    trade.classList.add("hidden");
    settings.classList.remove("hidden");
    tabTrade.classList.remove("active");
    tabSettings.classList.add("active");
  } else {
    settings.classList.add("hidden");
    trade.classList.remove("hidden");
    tabSettings.classList.remove("active");
    tabTrade.classList.add("active");
  }

  // remember preference
  try {
    const saved = loadRawSettings() || {};
    saved.defaultPage = page;
    localStorage.setItem(STORE_KEY, JSON.stringify(saved));
  } catch {}

  if (page === "trade") setTimeout(() => $("signal")?.focus(), 80);
}

/* -------------------- Mode -------------------- */
function setMode(mode){
  MODE = mode;

  const r = $("modeRiskBtn"), m = $("modeMarginBtn");
  if (r && m){
    r.classList.toggle("active", MODE === "risk");
    m.classList.toggle("active", MODE === "margin");
  }

  if (LAST) render();
  saveAllSettings();
}

/* -------------------- Helpers -------------------- */
function cleanText(s){
  return (s || "")
    .replace(/\*\*/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}

function parseSignal(raw){
  const text = cleanText(raw);

  const symMatch = text.match(/([A-Z]{3,6})\s*\/\s*([A-Z]{3,6})/);
  const symbol = symMatch ? (symMatch[1] + symMatch[2]) : "";

  const dirMatch = text.match(/Direction\s*:\s*(BUY|SELL)/i) || text.match(/\b(BUY|SELL)\b/i);
  const direction = dirMatch ? dirMatch[1].toUpperCase() : "";

  const entryMatch = text.match(/Entry\s*Price\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);
  const entry = entryMatch ? Number(entryMatch[1]) : NaN;

  const slMatch =
    text.match(/\bSL\b\s*[: ]\s*([0-9]+(?:\.[0-9]+)?)/i) ||
    text.match(/\bSL\b\s*([0-9]+(?:\.[0-9]+)?)/i);
  const sl = slMatch ? Number(slMatch[1]) : NaN;

  const tpRegex = /\bTP\s*([0-9]+)\b\s*[: ]\s*([0-9]+(?:\.[0-9]+)?)/gi;
  const tps = [];
  let m;
  while ((m = tpRegex.exec(text)) !== null){
    tps.push({ n: Number(m[1]), price: Number(m[2]) });
  }
  tps.sort((a,b) => a.n - b.n);

  return { symbol, direction, entry, sl, tps };
}

function floorToStep(value, step){
  const scaled = Math.floor(value / step) * step;
  return Number(scaled.toFixed(8));
}

function fmt2(n){
  if (!isFinite(n)) return "-";
  return (Math.round(n * 100) / 100).toFixed(2);
}

function fmtMoney(n){
  if (!isFinite(n)) return "-";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}$${v.toFixed(2)}`;
}

function showMessages(errors, warnings){
  const box = $("messages");
  box.innerHTML = "";

  if (errors.length){
    const div = document.createElement("div");
    div.className = "err";
    div.innerHTML = "<b>Fix this:</b><br>" + errors.map(e => "• " + e).join("<br>");
    box.appendChild(div);
  }

  if (warnings.length){
    const div = document.createElement("div");
    div.className = "warn";
    div.innerHTML = "<b>Warning:</b><br>" + warnings.map(w => "• " + w).join("<br>");
    box.appendChild(div);
  }
}

/* -------------------- Clipboard UX -------------------- */
async function pasteSignal(){
  try {
    const txt = await navigator.clipboard.readText();
    $("signal").value = txt || "";
    $("signal").focus();
  } catch {
    showMessages([], ["Clipboard paste blocked. Long-press inside the signal box and tap Paste."]);
    $("signal").focus();
  }
}

function clearSignal(){
  $("signal").value = "";
  $("signal").focus();
}

function scrollToQuickCopy(){
  const el = $("quick");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function copyText(spanId){
  const el = $(spanId);
  const text = el ? (el.textContent || "") : "";
  if (!text || text === "-") {
    showMessages([], ["Nothing to copy yet. Calculate first."]);
    return;
  }
  try {
    await navigator.clipboard.writeText(String(text));
    showMessages([], [`Copied: ${text}`]);
  } catch {
    showMessages([], ["Clipboard blocked. Long-press to copy."]);
  }
}

async function copyOutput(){
  try {
    await navigator.clipboard.writeText($("out").textContent || "");
    showMessages([], ["Copied output block."]);
  } catch {
    showMessages([], ["Clipboard blocked. Long-press the output block to copy."]);
  }
}

async function copyExecPlan(){
  try {
    await navigator.clipboard.writeText($("execPlan").textContent || "");
    showMessages([], ["Copied execution plan."]);
  } catch {
    showMessages([], ["Clipboard blocked. Long-press the execution plan to copy."]);
  }
}

/* -------------------- Settings persistence -------------------- */
function loadRawSettings(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAllSettings(){
  const data = {
    acct: $("acct")?.value || "",
    risk: $("risk")?.value || "",
    freeMargin: $("freeMargin")?.value || "",
    nettingMode: !!$("nettingMode")?.checked,

    marginPerLot: $("marginPerLot")?.value || "90000",
    step: $("step")?.value || "0.01",
    xauValue: $("xauValue")?.value || "100",
    defaultPage: $("defaultPage")?.value || "trade",

    mode: MODE
  };

  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function loadAllSettings(){
  const d = loadRawSettings();
  if (!d) return;

  if (d.acct !== undefined) $("acct").value = d.acct;
  if (d.risk !== undefined) $("risk").value = d.risk;
  if (d.freeMargin !== undefined) $("freeMargin").value = d.freeMargin;
  if (d.nettingMode !== undefined) $("nettingMode").checked = !!d.nettingMode;

  if (d.marginPerLot !== undefined) $("marginPerLot").value = d.marginPerLot;
  if (d.step !== undefined) $("step").value = d.step;
  if (d.xauValue !== undefined) $("xauValue").value = d.xauValue;
  if (d.defaultPage !== undefined) $("defaultPage").value = d.defaultPage;

  if (d.mode) setMode(d.mode);
}

function saveSettingsOnly(){
  saveAllSettings();
  showMessages([], ["Settings saved."]);
}

function resetDefaults(){
  $("marginPerLot").value = "90000";
  $("step").value = "0.01";
  $("xauValue").value = "100";
  $("defaultPage").value = "trade";
  saveAllSettings();
  showMessages([], ["Defaults restored."]);
}

/* -------------------- Netting toggle -------------------- */
function onNettingToggle(){
  saveAllSettings();
  if (LAST) render();
}

/* -------------------- Clear all -------------------- */
function clearAll(){
  $("signal").value = "";
  $("messages").innerHTML = "";

  $("tpBody").innerHTML = '<tr><td colspan="6" class="muted">Calculate to populate…</td></tr>';
  $("out").textContent = "Paste a signal and tap Calculate.";
  $("execPlan").textContent = "Calculate to populate…";

  $("info_symbol").textContent = "-";
  $("info_side").textContent = "-";
  $("info_mode").textContent = "RISK";

  $("qc_entry").textContent = "-";
  $("qc_sl").textContent = "-";
  $("qc_final_tp").textContent = "-";
  $("qc_lot_total").textContent = "-";
  $("qc_lot_slice").textContent = "-";
  $("qc_total_risk").textContent = "-";
  $("qc_total_margin").textContent = "-";
  $("slLossTotal").textContent = "-";

  $("oppHint").classList.remove("hidden");
  $("oppTable").classList.add("hidden");
  $("oppBody").innerHTML = '<tr><td colspan="5" class="muted">Calculate to populate…</td></tr>';

  LAST = null;
  saveAllSettings();
}

/* -------------------- Core calculate -------------------- */
function calculate(){
  const acct = Number($("acct").value);
  const riskPct = Number($("risk").value);
  const freeMargin = Number($("freeMargin").value);

  const step = Number($("step").value);
  const xauValue = Number($("xauValue").value);
  const marginPerLot = Number($("marginPerLot").value);

  const p = parseSignal($("signal").value);

  const errors = [];
  const warnings = [];

  if (!p.tps.length) errors.push("No TPs found (need TP1/TP2/TP3…).");
  if (!isFinite(p.entry)) errors.push("Entry Price not found.");
  if (!isFinite(p.sl)) errors.push("SL not found.");

  if (!isFinite(acct) || acct <= 0) errors.push("Account size must be a positive number (no commas).");
  if (!isFinite(riskPct) || riskPct <= 0) errors.push("Risk % must be a positive number.");
  if (!isFinite(step) || step <= 0) errors.push("Lot rounding step must be positive (e.g. 0.01).");
  if (!isFinite(xauValue) || xauValue <= 0) errors.push("XAU value must be positive (e.g. 100).");

  if (!isFinite(marginPerLot) || marginPerLot <= 0) warnings.push("Margin per lot in Settings is missing/invalid. Margin mode will be unavailable.");

  if (!p.direction) warnings.push("Direction not found (BUY/SELL). Double-check manually.");
  if (!p.symbol) warnings.push("Symbol not found (e.g. XAU/USD).");

  if (errors.length){
    showMessages(errors, warnings);
    return;
  }

  const tpCount = p.tps.length;
  const stop = Math.abs(p.entry - p.sl);
  if (stop <= 0){
    showMessages(["Stop distance is 0 (Entry equals SL)."], warnings);
    return;
  }

  // Risk sizing: compute SLICE lot first, then total = slice * tpCount
  const totalRiskTarget = acct * (riskPct / 100);
  const riskPerSlice = totalRiskTarget / tpCount;

  const sliceRiskRaw = riskPerSlice / (stop * xauValue);
  const sliceRisk = floorToStep(sliceRiskRaw, step);
  const totalRisk = floorToStep(sliceRisk * tpCount, step); // keep tidy

  if (!isFinite(sliceRisk) || sliceRisk <= 0){
    showMessages(["Risk slice lot became 0 after rounding down. Increase risk or reduce TP count/stop."], warnings);
    return;
  }

  // Margin sizing: compute TOTAL max lots first, then slice = total/tpCount
  let sliceMargin = NaN;
  let totalMargin = NaN;
  let marginOk = false;

  const freeMarginProvided = $("freeMargin").value.trim() !== "";

  if (isFinite(marginPerLot) && marginPerLot > 0 && isFinite(freeMargin) && freeMargin > 0) {
    totalMargin = floorToStep(freeMargin / marginPerLot, step);
    sliceMargin = floorToStep(totalMargin / tpCount, step);
    marginOk = isFinite(sliceMargin) && sliceMargin > 0;

    if (!marginOk) warnings.push("Margin inputs provided, but margin-max slice rounds to 0.00. Not enough free margin.");
    else if (totalRisk > totalMargin) warnings.push(`Risk TOTAL lot (${totalRisk.toFixed(2)}) exceeds margin TOTAL lot (${totalMargin.toFixed(2)}). Orders may be rejected.`);
  } else if (freeMarginProvided) {
    warnings.push("Free margin entered, but margin-per-lot missing/invalid in Settings. Margin mode not available.");
  }

  LAST = {
    p,
    tpCount,
    stop,
    xauValue,

    sliceRisk,
    totalRisk,

    sliceMargin,
    totalMargin,
    marginOk
  };

  showMessages([], warnings);
  render();
  saveAllSettings();
  setTimeout(scrollToQuickCopy, 50);
}

/* -------------------- Render based on MODE + netting -------------------- */
function render(){
  if (!LAST) return;

  const { p, tpCount, stop, xauValue, sliceRisk, totalRisk, sliceMargin, totalMargin, marginOk } = LAST;
  const netting = !!$("nettingMode").checked;

  const isBuy = (p.direction || "").toUpperCase() === "BUY";
  const isSell = (p.direction || "").toUpperCase() === "SELL";
  const closeSide = isBuy ? "SELL" : isSell ? "BUY" : "OPPOSITE";

  // Choose TOTAL and SLICE for display based on MODE
  let totalDisplay = totalRisk;
  let sliceDisplay = sliceRisk;
  let using = "risk";

  if (MODE === "margin" && marginOk){
    totalDisplay = totalMargin;
    sliceDisplay = sliceMargin;
    using = "margin";
  } else if (MODE === "margin" && !marginOk){
    using = "risk";
  }

  const finalTp = p.tps[p.tps.length - 1].price;

  // Quick copy info
  $("info_symbol").textContent = p.symbol || "-";
  $("info_side").textContent = p.direction || "-";
  $("info_mode").textContent = using.toUpperCase();

  // Primary order fields
  $("qc_entry").textContent = fmt2(p.entry);
  $("qc_sl").textContent = fmt2(p.sl);
  $("qc_final_tp").textContent = fmt2(finalTp);

  // Lots (TOTAL for main order; SLICE for partial closes)
  $("qc_lot_total").textContent = totalDisplay.toFixed(2);
  $("qc_lot_slice").textContent = sliceDisplay.toFixed(2);

  $("qc_total_risk").textContent = totalRisk.toFixed(2);
  $("qc_total_margin").textContent = marginOk ? totalMargin.toFixed(2) : "-";

  // SL $ uses TOTAL exposure
  const slLossTotal = stop * xauValue * totalDisplay;
  $("slLossTotal").textContent = fmtMoney(-slLossTotal);

  // TP table:
  // - Netting: each TP is one SLICE close (including final TP as remaining slice)
  // - Multi: think of it as one position per TP (same as slice)
  const tpLotForTable = sliceDisplay;

  const tpBody = $("tpBody");
  tpBody.innerHTML = "";

  for (const tp of p.tps){
    let profitMove = NaN;
    if (isBuy) profitMove = (tp.price - p.entry);
    else if (isSell) profitMove = (p.entry - tp.price);
    else profitMove = (tp.price - p.entry);

    const profit = profitMove * xauValue * tpLotForTable;

    const tr = document.createElement("tr");
    const priceSpanId = `tp_price_${tp.n}`;
    const lotSpanId = `tp_lot_${tp.n}`;

    tr.innerHTML = `
      <td>TP${tp.n}</td>
      <td><span id="${priceSpanId}">${fmt2(tp.price)}</span></td>
      <td><button onclick="copyText('${priceSpanId}')">Copy</button></td>
      <td class="right"><span id="${lotSpanId}">${tpLotForTable.toFixed(2)}</span></td>
      <td><button onclick="copyText('${lotSpanId}')">Copy</button></td>
      <td class="right">${fmtMoney(profit)}</td>
    `;
    tpBody.appendChild(tr);
  }

  // Opposing orders table (netting only): TP1..TP(n-1), each SLICE lot
  if (netting) {
    $("oppHint").classList.add("hidden");
    $("oppTable").classList.remove("hidden");

    const oppBody = $("oppBody");
    oppBody.innerHTML = "";

    for (let i = 0; i < p.tps.length - 1; i++){
      const tp = p.tps[i];
      const oppEntryId = `opp_entry_${tp.n}`;
      const oppLotId = `opp_lot_${tp.n}`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${closeSide}</td>
        <td><span id="${oppEntryId}">${fmt2(tp.price)}</span></td>
        <td><button onclick="copyText('${oppEntryId}')">Copy</button></td>
        <td class="right"><span id="${oppLotId}">${sliceDisplay.toFixed(2)}</span></td>
        <td><button onclick="copyText('${oppLotId}')">Copy</button></td>
      `;
      oppBody.appendChild(tr);
    }
  } else {
    $("oppHint").classList.remove("hidden");
    $("oppTable").classList.add("hidden");
  }

  // Execution plan
  const plan = [];
  plan.push(`MODE: ${using.toUpperCase()}`);
  plan.push(`ACCOUNT: ${netting ? "NETTING" : "MULTI-POSITION"}`);
  plan.push(`Symbol: ${p.symbol || "(not found)"}`);
  plan.push(`Side: ${p.direction || "(not found)"}`);
  plan.push(`Entry: ${fmt2(p.entry)}`);
  plan.push(`SL: ${fmt2(p.sl)}`);
  plan.push(`Final TP: ${fmt2(finalTp)}`);
  plan.push("");

  if (!netting){
    plan.push(`Place ${tpCount} positions (each ${sliceDisplay.toFixed(2)} lots). Each TP closes one position.`);
    for (const tp of p.tps){
      plan.push(`- ${p.direction} ${sliceDisplay.toFixed(2)} | TP${tp.n} @ ${fmt2(tp.price)}`);
    }
  } else {
    plan.push(`1) Open ONE ${p.direction} trade (TOTAL): ${totalDisplay.toFixed(2)} lots`);
    plan.push(`   SL: ${fmt2(p.sl)}`);
    plan.push(`   TP (final): ${fmt2(finalTp)}`);
    plan.push("");
    plan.push(`2) Place partial closes as opposite LIMIT orders (SLICE): ${sliceDisplay.toFixed(2)} lots each`);
    for (let i = 0; i < p.tps.length - 1; i++){
      const tp = p.tps[i];
      plan.push(`   - ${closeSide} LIMIT @ ${fmt2(tp.price)} | Lot: ${sliceDisplay.toFixed(2)}`);
    }
    plan.push("");
    plan.push(`Result: ${tpCount} take-profits of ${sliceDisplay.toFixed(2)} lots each.`);
  }

  $("execPlan").textContent = plan.join("\n");

  // Output block
  const out = [];
  out.push(`Mode: ${using.toUpperCase()}`);
  out.push(`Account: ${netting ? "NETTING" : "MULTI"}`);
  out.push(`Symbol: ${p.symbol || "(not found)"}`);
  out.push(`Side: ${p.direction || "(not found)"}`);
  out.push(`Entry: ${fmt2(p.entry)}`);
  out.push(`SL: ${fmt2(p.sl)}`);
  out.push(`Final TP: ${fmt2(finalTp)}`);
  out.push("");

  if (!netting){
    out.push(`Lots per TP (each position): ${sliceDisplay.toFixed(2)}`);
  } else {
    out.push(`Main order TOTAL lot: ${totalDisplay.toFixed(2)}`);
    out.push(`Slice lot (each TP): ${sliceDisplay.toFixed(2)}`);
    out.push("");
    out.push(`Opposing orders:`);
    for (let i = 0; i < p.tps.length - 1; i++){
      const tp = p.tps[i];
      out.push(`${closeSide} LIMIT @ ${fmt2(tp.price)} | Lot: ${sliceDisplay.toFixed(2)}`);
    }
  }

  $("out").textContent = out.join("\n");
}

/* -------------------- Boot -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  $("jsok").textContent = "JS: OK";
  loadAllSettings();

  const d = loadRawSettings();
  const defaultPage = d.defaultPage || $("defaultPage")?.value || "trade";
  showPage(defaultPage);

  // 🔗 Import signal from URL (?s=...&auto=1)
  try {
    const qs = new URLSearchParams(window.location.search);
    const s = qs.get("s");
    const auto = qs.get("auto");
    if (s) {
      $("signal").value = s;
      if (auto === "1") setTimeout(() => calculate(), 50);
    }
  } catch (e) {
    console.warn("URL import failed", e);
  }

  if (!MODE) setMode("risk");

  setTimeout(() => {
    if (!($("pageTrade")?.classList.contains("hidden"))) $("signal")?.focus();
  }, 80);
});
