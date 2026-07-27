const STORAGE_KEY = "bunny-bp-readings-v2";
let readings = loadReadings();
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);
const form = $("readingForm");

document.addEventListener("DOMContentLoaded", () => {
  setDefaultDateTime();
  runLoader();
  renderAll();

  form.addEventListener("submit", saveReading);
  $("cancelEditBtn").addEventListener("click", resetForm);
  $("rangeSelect").addEventListener("change", drawChart);
  $("searchInput").addEventListener("input", renderHistory);
  $("exportCsvBtn").addEventListener("click", exportCsv);
  $("exportJsonBtn").addEventListener("click", exportJson);
  $("importJsonInput").addEventListener("change", importJson);
  $("clearAllBtn").addEventListener("click", clearAll);
  $("installBtn").addEventListener("click", installApp);

  window.addEventListener("resize", drawChart);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    $("installBtn").hidden = false;
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  }
});

function runLoader() {
  const duration = 2000;
  const start = performance.now();
  const fill = $("progressFill");
  const rabbit = $("loaderRabbit");
  const text = $("progressText");

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const percent = Math.round(eased * 100);
    fill.style.width = `${percent}%`;
    rabbit.style.left = `clamp(0px, ${percent}%, 100%)`;
    text.textContent = `${percent}%`;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      setTimeout(() => {
        $("app").hidden = false;
        $("loader").classList.add("hide");
        setTimeout(() => $("loader").remove(), 500);
        drawChart();
      }, 180);
    }
  }
  requestAnimationFrame(tick);
}

function loadReadings() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function persist() {
  readings.sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
}

function localDatetimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function setDefaultDateTime() {
  $("takenAt").value = localDatetimeValue();
  const hour = new Date().getHours();
  $("timeOfDay").value = hour < 12 ? "Morning" : hour >= 17 ? "Evening" : "Other";
}

function saveReading(event) {
  event.preventDefault();
  const systolic = Number($("systolic").value);
  const diastolic = Number($("diastolic").value);
  const takenAt = $("takenAt").value;

  if (!systolic || !diastolic || !takenAt) {
    showMessage("Please complete all required fields.");
    return;
  }
  if (systolic <= diastolic) {
    showMessage("Systolic should normally be higher than diastolic.");
    return;
  }

  const id = $("editingId").value || crypto.randomUUID();
  const reading = {
    id,
    systolic,
    diastolic,
    takenAt,
    medication: $("medication").checked,
    timeOfDay: $("timeOfDay").value,
    notes: $("notes").value.trim(),
    updatedAt: new Date().toISOString()
  };

  const index = readings.findIndex((item) => item.id === id);
  if (index >= 0) readings[index] = reading;
  else readings.push(reading);

  persist();
  renderAll();
  resetForm();
  showMessage(index >= 0 ? "Reading updated." : "Reading saved.");
}

function resetForm() {
  form.reset();
  $("editingId").value = "";
  $("saveBtn").textContent = "Save reading";
  $("cancelEditBtn").hidden = true;
  setDefaultDateTime();
}

function showMessage(message) {
  $("formMessage").textContent = message;
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => $("formMessage").textContent = "", 3000);
}

function renderAll() {
  renderSummary();
  renderHistory();
  drawChart();
}

function renderSummary() {
  if (!readings.length) {
    $("latestReading").textContent = "— / —";
    $("latestMeta").textContent = "No readings yet";
    $("avgReading").textContent = "— / —";
    $("avgCount").textContent = "0 readings";
    return;
  }

  const latest = readings[0];
  $("latestReading").textContent = `${latest.systolic} / ${latest.diastolic}`;
  $("latestMeta").textContent = formatDate(latest.takenAt);

  const cutoff = Date.now() - 7 * 86400000;
  const recent = readings.filter((r) => new Date(r.takenAt).getTime() >= cutoff);
  const source = recent.length ? recent : [latest];
  $("avgReading").textContent =
    `${average(source, "systolic")} / ${average(source, "diastolic")}`;
  $("avgCount").textContent = `${source.length} reading${source.length === 1 ? "" : "s"}`;
}

function average(list, key) {
  return Math.round(list.reduce((sum, item) => sum + Number(item[key]), 0) / list.length);
}

function renderHistory() {
  const query = $("searchInput").value.trim().toLowerCase();
  const filtered = readings.filter((r) => {
    return `${r.notes} ${r.timeOfDay} ${r.systolic}/${r.diastolic}`
      .toLowerCase().includes(query);
  });

  $("historyCount").textContent = `${readings.length} reading${readings.length === 1 ? "" : "s"}`;
  $("emptyHistory").hidden = filtered.length > 0;

  $("historyList").innerHTML = filtered.map((r) => {
    return `
      <article class="history-item">
        <div>
          <div class="reading-main">
            <span class="reading-value">${r.systolic} / ${r.diastolic}</span>
          </div>
          <div class="reading-meta">
            ${formatDate(r.takenAt)} · ${escapeHtml(r.timeOfDay)}
            ${r.medication ? " · Medication taken" : ""}
          </div>
          ${r.notes ? `<div class="reading-notes">${escapeHtml(r.notes)}</div>` : ""}
        </div>
        <div class="item-actions">
          <button class="icon-btn" onclick="editReading('${r.id}')">Edit</button>
          <button class="icon-btn" onclick="deleteReading('${r.id}')">Delete</button>
        </div>
      </article>`;
  }).join("");
}

window.editReading = function(id) {
  const r = readings.find((item) => item.id === id);
  if (!r) return;
  $("editingId").value = r.id;
  $("systolic").value = r.systolic;
  $("diastolic").value = r.diastolic;
  $("takenAt").value = r.takenAt;
  $("medication").checked = r.medication;
  $("timeOfDay").value = r.timeOfDay || "Other";
  $("notes").value = r.notes || "";
  $("saveBtn").textContent = "Update reading";
  $("cancelEditBtn").hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
};

window.deleteReading = function(id) {
  if (!confirm("Delete this reading?")) return;
  readings = readings.filter((item) => item.id !== id);
  persist();
  renderAll();
};

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit"
  }).format(new Date(value));
}

function drawChart() {
  const canvas = $("trendChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = canvas.clientWidth || 900;
  const displayHeight = 320;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const range = $("rangeSelect").value;
  const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
  const data = readings
    .filter((r) => new Date(r.takenAt).getTime() >= cutoff)
    .slice()
    .sort((a,b) => new Date(a.takenAt) - new Date(b.takenAt));

  $("emptyChart").hidden = data.length >= 2;
  canvas.hidden = data.length < 2;
  if (data.length < 2) return;

  const pad = { left: 42, right: 18, top: 20, bottom: 38 };
  const w = displayWidth - pad.left - pad.right;
  const h = displayHeight - pad.top - pad.bottom;
  const allValues = data.flatMap((r) => [r.systolic, r.diastolic]);
  let min = Math.max(20, Math.floor((Math.min(...allValues) - 15) / 10) * 10);
  let max = Math.ceil((Math.max(...allValues) + 15) / 10) * 10;
  if (max - min < 60) max = min + 60;

  const x = (i) => pad.left + (data.length === 1 ? w/2 : i * w/(data.length-1));
  const y = (v) => pad.top + h - (v-min)/(max-min)*h;

  ctx.font = "12px system-ui";
  ctx.strokeStyle = "rgba(255,255,255,.09)";
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 1;
  for (let i=0; i<=4; i++) {
    const val = Math.round(min + (max-min)*i/4);
    const yy = y(val);
    ctx.beginPath(); ctx.moveTo(pad.left, yy); ctx.lineTo(displayWidth-pad.right, yy); ctx.stroke();
    ctx.fillText(String(val), 6, yy+4);
  }

  const series = [
    { key:"systolic", color:"#ff5c9a" },
    { key:"diastolic", color:"#8dc3ff" }
  ];
  series.forEach((s) => {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    data.forEach((r,i) => {
      const xx = x(i), yy = y(r[s.key]);
      if (i===0) ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy);
    });
    ctx.stroke();
    data.forEach((r,i) => {
      ctx.beginPath(); ctx.arc(x(i), y(r[s.key]), 3.5, 0, Math.PI*2); ctx.fill();
    });
  });

  const labelIndexes = [...new Set([0, Math.floor((data.length-1)/2), data.length-1])];
  ctx.fillStyle = "rgba(255,255,255,.55)";
  labelIndexes.forEach((i) => {
    const label = new Intl.DateTimeFormat(undefined, { month:"short", day:"numeric" }).format(new Date(data[i].takenAt));
    ctx.fillText(label, Math.max(pad.left, Math.min(x(i)-20, displayWidth-pad.right-40)), displayHeight-12);
  });
}

function exportCsv() {
  if (!readings.length) return alert("There are no readings to export.");
  const headers = ["Date/Time","Systolic","Diastolic","Medication Taken","Time of Day","Notes"];
  const rows = readings.map((r) => [
    r.takenAt, r.systolic, r.diastolic,
    r.medication ? "Yes" : "No", r.timeOfDay, r.notes
  ]);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
  downloadBlob(csv, "bunny-bp-readings.csv", "text/csv;charset=utf-8");
}

function exportJson() {
  const payload = JSON.stringify({ app:"Bunny BP Tracker", version:2, exportedAt:new Date().toISOString(), readings }, null, 2);
  downloadBlob(payload, "bunny-bp-backup.json", "application/json");
}

async function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const imported = Array.isArray(data) ? data : data.readings;
    if (!Array.isArray(imported)) throw new Error("Invalid format");
    const valid = imported.filter((r) => r && r.id && r.systolic && r.diastolic && r.takenAt);
    if (!confirm(`Import ${valid.length} reading(s)? Existing readings with matching IDs will be replaced.`)) return;
    const map = new Map(readings.map((r) => [r.id,r]));
    valid.forEach((r) => map.set(r.id,r));
    readings = [...map.values()];
    persist(); renderAll();
    alert("Backup imported.");
  } catch {
    alert("That file could not be imported.");
  } finally {
    event.target.value = "";
  }
}

function clearAll() {
  if (!readings.length) return;
  if (!confirm("Delete every saved reading from this device? This cannot be undone unless you have a backup.")) return;
  readings = [];
  persist();
  renderAll();
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"','""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("installBtn").hidden = true;
}
