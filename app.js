const $ = selector => document.querySelector(selector);
const entries = $("#entries");
const empty = $("#empty");
const filter = $("#filter");
const entryForm = $("#entry-form");
const draftKey = "tradejournal-entry-draft-v1";
const savedEntriesKey = "tradejournal-manual-entries-v1";
let latestAnalysis = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function render(items) {
  if (!entries || !empty) return;
  entries.replaceChildren();
  empty.hidden = items.length > 0;
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "entry";
    const tags = Array.isArray(item.tags) ? item.tags : [];
    card.innerHTML = `<time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
      <h3><a href="${escapeHtml(item.path)}">${escapeHtml(item.title)}</a></h3>
      <p>${escapeHtml(item.summary)}</p>
      <div>${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
    entries.append(card);
  }
}

function loadPublishedEntries() {
  if (!entries && !empty) return;
  fetch("journal/entries.json")
    .then(response => response.ok ? response.json() : Promise.reject(response.status))
    .then(data => {
      const list = Array.isArray(data) ? data : [];
      const all = list.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
      render(all);
      if (filter) {
        filter.addEventListener("input", () => {
          const query = filter.value.trim().toLowerCase();
          render(all.filter(item => JSON.stringify(item).toLowerCase().includes(query)));
        });
      }
    })
    .catch(() => {
      if (empty) {
        empty.hidden = false;
        empty.textContent = "Journal entries are not available yet. You can still add a local entry below.";
      }
    });
}

function formObject() {
  if (!entryForm) return {};
  return Object.fromEntries(new FormData(entryForm).entries());
}

function setEntryStatus(message) {
  const status = $("#entry-status");
  if (status) status.textContent = message;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function loadDraft() {
  if (!entryForm) return;
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
    if (draft) {
      Object.entries(draft).forEach(([name, value]) => {
        if (entryForm.elements[name]) entryForm.elements[name].value = value;
      });
    }
  } catch {
    setEntryStatus("Browser storage was unavailable.");
  }
}

function saveDraft() {
  if (!entryForm) return;
  try {
    localStorage.setItem(draftKey, JSON.stringify(formObject()));
    setEntryStatus("Draft saved locally.");
  } catch {
    setEntryStatus("Could not save this browser draft.");
  }
}

function downloadJson(filename, value) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function focusEntryForm() {
  if (!entryForm) return;
  const title = entryForm.elements.title || entryForm.querySelector("input, textarea, select");
  if (title && typeof title.focus === "function") title.focus({ preventScroll: false });
}

function initEntryForm() {
  if (!entryForm) return;

  entryForm.addEventListener("input", saveDraft);
  entryForm.addEventListener("submit", event => {
    event.preventDefault();
    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      savedAt: new Date().toISOString(),
      ...formObject()
    };
    try {
      const saved = JSON.parse(localStorage.getItem(savedEntriesKey) || "[]");
      if (!Array.isArray(saved)) throw new Error("corrupt");
      saved.push(entry);
      localStorage.setItem(savedEntriesKey, JSON.stringify(saved));
      localStorage.removeItem(draftKey);
      entryForm.reset();
      if (entryForm.elements.date) entryForm.elements.date.value = todayIsoDate();
      setEntryStatus("Entry saved locally in this browser. Use Export entries JSON for a backup.");
    } catch {
      setEntryStatus("Could not save this entry. Fill the form and export manually if storage is blocked.");
    }
  });

  const clearDraft = $("#clear-draft");
  if (clearDraft) {
    clearDraft.addEventListener("click", () => {
      entryForm.reset();
      if (entryForm.elements.date) entryForm.elements.date.value = todayIsoDate();
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      setEntryStatus("Local draft cleared.");
    });
  }

  const exportEntries = $("#export-entries");
  if (exportEntries) {
    exportEntries.addEventListener("click", () => {
      try {
        const saved = JSON.parse(localStorage.getItem(savedEntriesKey) || "[]");
        downloadJson("tradejournal-entries.json", saved);
        setEntryStatus(`Exported ${Array.isArray(saved) ? saved.length : 0} local entr${Array.isArray(saved) && saved.length === 1 ? "y" : "ies"} as JSON.`);
      } catch {
        setEntryStatus("No readable local entries to export.");
      }
    });
  }

  loadDraft();
  if (entryForm.elements.date && !entryForm.elements.date.value) {
    entryForm.elements.date.value = todayIsoDate();
  }

  document.querySelectorAll('a[href="#workspace"], a[href="#entry-form"]').forEach(link => {
    link.addEventListener("click", () => {
      requestAnimationFrame(focusEntryForm);
    });
  });

  if (location.hash === "#workspace" || location.hash === "#entry-form") {
    requestAnimationFrame(focusEntryForm);
  }
}

function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find(value => value.trim()) || "";
  return ["\t", ";", ","].sort((a, b) => line.split(b).length - line.split(a).length)[0];
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      if (row.some(value => value)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field.trim());
    if (row.some(value => value)) rows.push(row);
  }
  return rows;
}

function normaliseHeader(value) {
  return String(value || "").toLowerCase().replace(/[\s_.()\-\/]+/g, "");
}

function firstIndex(headers, names, used) {
  const wanted = new Set(names);
  for (let i = 0; i < headers.length; i += 1) {
    if (used.has(i)) continue;
    if (wanted.has(normaliseHeader(headers[i]))) return i;
  }
  return -1;
}

function columnMap(headers) {
  const used = new Set();
  const pick = names => {
    const index = firstIndex(headers, names, used);
    if (index >= 0) used.add(index);
    return index;
  };

  // Prefer specific labels; bare "time"/"price" only for the open-side columns.
  return {
    ticket: pick(["ticket", "order", "deal", "position", "positionid"]),
    openTime: pick(["opentime", "timeopen", "openingtime", "time", "date"]),
    closeTime: pick(["closetime", "timeclose", "closingtime"]),
    symbol: pick(["symbol", "instrument", "item"]),
    type: pick(["type", "side", "action", "dealtype", "direction"]),
    volume: pick(["volume", "lots", "lot", "size"]),
    openPrice: pick(["openprice", "priceopen", "price"]),
    closePrice: pick(["closeprice", "priceclose", "price"]),
    commission: pick(["commission", "commissions", "fee"]),
    swap: pick(["swap", "storage"]),
    profit: pick(["profit", "pl", "pnl", "profitloss", "netprofit"]),
    entry: pick(["entry", "dealentry", "directioninout"])
  };
}

function number(value) {
  const cleaned = String(value ?? "").replace(/\s/g, "").replace(/[^\d,.\-+]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "+") return 0;
  if (cleaned.includes(",") && !cleaned.includes(".")) return Number(cleaned.replace(",", ".")) || 0;
  return Number(cleaned.replace(/,/g, "")) || 0;
}

function valueAt(row, index) {
  return index >= 0 ? row[index] : "";
}

function isNonTradeRow(trade) {
  const blob = `${trade.type} ${trade.symbol} ${trade.entry}`.toLowerCase();
  return /balance|credit|deposit|withdrawal|charge|correction|bonus/.test(blob) || !trade.symbol;
}

function isClosedTradeRow(trade, map) {
  if (map.entry >= 0) {
    // MT5 Deal history: keep exit deals only (out / inout / out by).
    return /^(out|inout|outby|close)/.test(trade.entry) || /\bout\b/.test(trade.entry);
  }
  if (map.closeTime >= 0) {
    return Boolean(String(trade.closeTime || "").trim());
  }
  // MT4-style single closed-order rows, or deal exports without Entry:
  // require a buy/sell-like type so balance rows without a type label stay out.
  return /buy|sell|long|short/.test(trade.type);
}

function makeTrades(rows) {
  if (!rows.length) {
    throw new Error("The file is empty. Export Account History as CSV and try again, or use samples/mt4-account-history-sample.csv.");
  }

  const headerIndex = rows.findIndex(row => /ticket|order|deal|symbol|item|profit|p\/l/i.test(row.join(" ")));
  if (headerIndex < 0) {
    throw new Error("No recognizable header row. Export Account History as a CSV with column headings (see samples/).");
  }

  const headers = rows[headerIndex];
  const map = columnMap(headers);
  if (map.profit < 0 || map.symbol < 0) {
    throw new Error("Could not identify both Profit and Symbol/Item columns. Rename headers to match a standard Account History export, or start from the sample CSV.");
  }

  const seen = new Set();
  const trades = [];
  let skippedNonTrade = 0;
  let skippedOpen = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    const type = valueAt(row, map.type).toLowerCase();
    const symbol = valueAt(row, map.symbol);
    const profit = number(valueAt(row, map.profit));
    const commission = number(valueAt(row, map.commission));
    const swap = number(valueAt(row, map.swap));
    const ticket = valueAt(row, map.ticket);
    const openTime = valueAt(row, map.openTime);
    const closeTime = valueAt(row, map.closeTime) || openTime;
    const entry = valueAt(row, map.entry).toLowerCase();
    const trade = {
      ticket,
      openTime,
      closeTime,
      symbol,
      type,
      entry,
      volume: number(valueAt(row, map.volume)),
      openPrice: number(valueAt(row, map.openPrice)),
      closePrice: number(valueAt(row, map.closePrice)),
      commission,
      swap,
      profit,
      net: profit + commission + swap
    };

    if (isNonTradeRow(trade)) {
      skippedNonTrade += 1;
      continue;
    }
    if (!isClosedTradeRow(trade, map)) {
      skippedOpen += 1;
      continue;
    }

    const key = `${trade.ticket}|${trade.symbol}|${trade.closeTime}|${trade.profit}|${trade.volume}|${trade.entry}`;
    if (seen.has(key)) continue;
    seen.add(key);
    trades.push(trade);
  }

  if (!trades.length) {
    throw new Error("No closed trade rows were found. Balance/credit rows are ignored; for MT5 Deal history include the Entry column (out / inout). Check that Profit is present.");
  }

  return { trades, map, skippedNonTrade, skippedOpen, headers };
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value);
}

function cell(value) {
  return `<td>${escapeHtml(value)}</td>`;
}

function renderAnalysis(result, filename) {
  const { trades, map, skippedNonTrade, skippedOpen } = result;
  const wins = trades.filter(trade => trade.net > 0);
  const losses = trades.filter(trade => trade.net < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.net, 0);
  const grossLoss = losses.reduce((sum, trade) => sum + trade.net, 0);
  const net = trades.reduce((sum, trade) => sum + trade.net, 0);
  const longCount = trades.filter(trade => /buy|long/.test(trade.type)).length;
  const shortCount = trades.filter(trade => /sell|short/.test(trade.type)).length;
  const profitFactor = grossLoss ? (grossProfit / Math.abs(grossLoss)) : null;

  const metrics = [
    ["Closed trades", trades.length],
    ["Win rate", `${(wins.length / trades.length * 100).toFixed(1)}%`],
    ["Gross profit", formatMoney(grossProfit)],
    ["Gross loss", formatMoney(grossLoss)],
    ["Net P/L", formatMoney(net)],
    ["Profit factor", profitFactor === null ? "n/a" : profitFactor.toFixed(2)],
    ["Average P/L", formatMoney(net / trades.length)],
    ["Average win / loss", `${wins.length ? formatMoney(grossProfit / wins.length) : "n/a"} / ${losses.length ? formatMoney(grossLoss / losses.length) : "n/a"}`],
    ["Long / short", `${longCount} / ${shortCount}`]
  ];

  const metricsEl = $("#metrics");
  if (metricsEl) {
    metricsEl.innerHTML = metrics
      .map(([label, value]) => `<article><span>${label}</span><strong>${escapeHtml(value)}</strong></article>`)
      .join("");
  }

  const symbols = Object.values(trades.reduce((all, trade) => {
    const summary = all[trade.symbol] || { symbol: trade.symbol, count: 0, net: 0, wins: 0 };
    summary.count += 1;
    summary.net += trade.net;
    summary.wins += trade.net > 0 ? 1 : 0;
    all[trade.symbol] = summary;
    return all;
  }, {})).sort((a, b) => b.net - a.net);

  const symbolSummary = $("#symbol-summary");
  if (symbolSummary) {
    symbolSummary.innerHTML = `<thead><tr><th>Symbol</th><th>Trades</th><th>Win rate</th><th>Net P/L</th></tr></thead><tbody>${
      symbols.map(item => `<tr>${cell(item.symbol)}${cell(item.count)}${cell(`${(item.wins / item.count * 100).toFixed(1)}%`)}${cell(formatMoney(item.net))}</tr>`).join("")
    }</tbody>`;
  }

  const recent = [...trades]
    .sort((a, b) => String(b.closeTime).localeCompare(String(a.closeTime)))
    .slice(0, 20);
  const recentTrades = $("#recent-trades");
  if (recentTrades) {
    recentTrades.innerHTML = `<thead><tr><th>Close time</th><th>Symbol</th><th>Type</th><th>Lots</th><th>Net P/L</th></tr></thead><tbody>${
      recent.map(trade => `<tr>${cell(trade.closeTime)}${cell(trade.symbol)}${cell(trade.type || "—")}${cell(trade.volume || "—")}${cell(formatMoney(trade.net))}</tr>`).join("")
    }</tbody>`;
  }

  const notes = [];
  if (map.entry >= 0) notes.push("MT5 Entry column detected; only out / inout-style deals are counted.");
  else notes.push("No Entry column detected; treating rows as MT4-style closed orders (or deal rows with buy/sell type).");
  if (skippedNonTrade) notes.push(`Ignored ${skippedNonTrade} balance/credit/non-trade row(s).`);
  if (skippedOpen) notes.push(`Ignored ${skippedOpen} open / in-deal row(s).`);
  notes.push("Figures combine Profit + Commission + Swap when those columns exist.");

  const caption = $("#analysis-caption");
  if (caption) {
    caption.textContent = `${trades.length} closed trade row(s) from ${filename}. ${notes.join(" ")}`;
  }

  const analysis = $("#analysis");
  if (analysis) analysis.hidden = false;
  const exportAnalysis = $("#export-analysis");
  if (exportAnalysis) exportAnalysis.disabled = false;

  latestAnalysis = {
    importedAt: new Date().toISOString(),
    filename,
    privacy: "Parsed locally in the browser; never uploaded by this static site.",
    notes,
    summary: {
      totalClosedTrades: trades.length,
      winRate: wins.length / trades.length,
      grossProfit,
      grossLoss,
      net,
      profitFactor,
      averagePnL: net / trades.length,
      averageWin: wins.length ? grossProfit / wins.length : null,
      averageLoss: losses.length ? grossLoss / losses.length : null,
      longCount,
      shortCount,
      perSymbol: symbols
    },
    trades
  };
}

function initCsvImport() {
  const csvFile = $("#csv-file");
  if (!csvFile) return;

  csvFile.addEventListener("change", async event => {
    const file = event.target.files && event.target.files[0];
    const importStatus = $("#import-status");
    if (!file) return;
    if (importStatus) importStatus.textContent = `Reading ${file.name} locally…`;

    try {
      const text = await file.text();
      renderAnalysis(makeTrades(parseCsv(text)), file.name);
      if (importStatus) {
        importStatus.textContent = `${file.name} analyzed locally. Nothing was uploaded.`;
      }
    } catch (error) {
      const analysis = $("#analysis");
      if (analysis) analysis.hidden = true;
      const exportAnalysis = $("#export-analysis");
      if (exportAnalysis) exportAnalysis.disabled = true;
      latestAnalysis = null;
      if (importStatus) {
        importStatus.textContent = error && error.message
          ? error.message
          : "Could not parse that file. Try the sample CSV or a standard Account History export with headers.";
      }
    }
  });

  const exportAnalysis = $("#export-analysis");
  if (exportAnalysis) {
    exportAnalysis.addEventListener("click", () => {
      if (!latestAnalysis) return;
      downloadJson("tradejournal-import-analysis.json", latestAnalysis);
      const importStatus = $("#import-status");
      if (importStatus) importStatus.textContent = "Analysis JSON downloaded locally.";
    });
  }
}

try { initEntryForm(); } catch { /* form remains usable as plain HTML */ }
try { loadPublishedEntries(); } catch { /* ignore */ }
try { initCsvImport(); } catch { /* ignore */ }

const year = $("#year");
if (year) year.textContent = new Date().getFullYear();
