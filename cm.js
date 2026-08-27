// ==========================================================================
// CONFIGURATIONS & CONSTANTS
// ==========================================================================
const SUPABASE_BASE_URL = "https://aawqggptasdfnhjtzrdr.supabase.co/functions/v1/get_ps_cm";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhd3FnZ3B0YXNkZm5oanR6cmRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxOTA1MzUsImV4cCI6MjA1NTc2NjUzNX0.a0vBfIQL5DInyQpC2wSsnXJqllzL66S2v9a45vW-8hE";
const DB_NAME = "InventoryCacheDB";
const DB_VERSION = 1;
const STORE_DATA = "items";
const STORE_META = "metadata";

// Token Cache Settings (30 Days)
const TOKEN_KEY = "app_auth_token";
const TOKEN_EXPIRY_KEY = "app_auth_token_expiry";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const CAT_FILTERS = [
  { id: "cat-1", chipId: "chip-cat-1", label: "สีพ่น", keyword: "สี" },
  { id: "cat-2", chipId: "chip-cat-2", label: "แลคเกอร์", keyword: "แลคเกอร์" },
  { id: "cat-3", chipId: "chip-cat-3", label: "ทินเนอร์", keyword: "ทินเนอร์" }
];

const DIV_FILTERS = [
  { id: "div-1", chipId: "chip-div-1", label: "แผนก A", value: "DivA" },
  { id: "div-2", chipId: "chip-div-2", label: "แผนก B", value: "DivB" }
];

// State Variables
let rawData = [];
let filteredData = [];
let viewData = [];
let globalVerifiedPassword = "";
let securityBreached = false;
let countdownInterval = null;
let currentDynamicColumn = "onhand";
let sortState = { key: null, dir: "asc" };

// ==========================================================================
// 9. AUTHENTICATION, TOKEN CACHE & LOCKOUT ENGINE
// ==========================================================================
function saveAuthToken(pass) {
  const expiryTime = Date.now() + THIRTY_DAYS_MS;
  localStorage.setItem(TOKEN_KEY, pass);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
}

function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

function getValidAuthToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (!token || !expiry) return null;

  if (Date.now() > parseInt(expiry, 10)) {
    clearAuthToken();
    return null;
  }

  return token;
}

async function checkAutoLogin() {
  const savedToken = getValidAuthToken();
  if (savedToken) {
    globalVerifiedPassword = savedToken;
    hideLockScreen();
    loadTable();
    return true;
  }
  return false;
}

function hideLockScreen() {
  const lockScreen = document.getElementById("lock-screen");
  if (lockScreen) {
    lockScreen.style.removeProperty("display");
    lockScreen.style.setProperty("display", "none", "important");
  }
  const mainArea = document.getElementById("main-content-area");
  if (mainArea) {
    mainArea.style.display = "block";
  }
}

async function submitPassword() {
  const inputEl = document.getElementById("passInput");
  const msgEl = document.getElementById("lock-msg");
  const btnEl = document.getElementById("submitBtn");
  const boxEl = document.querySelector(".lock-box");

  if (!inputEl) return;
  const userPass = inputEl.value.trim();
  if (!userPass) return;

  btnEl.disabled = true;
  msgEl.style.color = "#888";
  msgEl.textContent = "⏳กำลังตรวจสอบสิทธิ์...";
  boxEl.classList.remove("brutal-danger");

  try {
    const response = await fetch(SUPABASE_BASE_URL, {
      method: "POST",
      headers: {
        "apikey": ANON_KEY,
        "Authorization": "Bearer " + ANON_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_input_password: userPass,
        limit: 1,
        offset: 0
      })
    });

    if (response.status === 400) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.message && errorData.message.includes("locked")) {
        securityBreached = true;
        executeBrutalLockout(errorData.message);
        return;
      }
    }

    if (!response.ok) throw new Error("Server firewall authentication dropped");

    const data = await response.json();

    if (data.length === 0) {
      boxEl.classList.add("brutal-danger");
      msgEl.style.color = "#dc2626";
      msgEl.textContent = "🛑 ACCESS DENIED: INVALID PRIVILEGE IDENTIFIER KEY!";
      inputEl.value = "";
      btnEl.disabled = false;
      inputEl.focus();
      
      const checkResp = await fetch(SUPABASE_BASE_URL, {
        method: "POST", 
        headers: { "apikey": ANON_KEY, "Authorization": "Bearer " + ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ user_input_password: "CHECK_REMAINING_ATTEMPTS_ONLY", limit: 1, offset: 0 })
      });
      
      if (checkResp.status === 400) {
        const checkData = await checkResp.json().catch(() => ({}));
        if (checkData.message && checkData.message.includes("locked")) {
          securityBreached = true;
          executeBrutalLockout(checkData.message);
        } else if (checkData.message) {
          msgEl.textContent = `🛑 ACCESS DENIED: (${checkData.message})`;
        }
      }
      return;
    }

    // ล็อกอินสำเร็จ -> บันทึก Token อายุ 30 วันลง localStorage
    globalVerifiedPassword = userPass;
    saveAuthToken(userPass);

    hideLockScreen();
    loadTable();

  } catch (err) {
    console.error(err);
    msgEl.style.color = "#dc2626";
    msgEl.textContent = "🚨 CRITICAL ERROR: SECURE TUNNEL DISCONNECTED";
    btnEl.disabled = false;
  }
}

function executeBrutalLockout(message) {
  securityBreached = true;
  clearAuthToken();
  
  const mainArea = document.getElementById("main-content-area");
  if (mainArea) { mainArea.remove(); }

  const inputEl = document.getElementById("passInput");
  const msgEl = document.getElementById("lock-msg");
  const btnEl = document.getElementById("submitBtn");
  const boxEl = document.querySelector(".lock-box");

  if(inputEl) { inputEl.disabled = true; inputEl.value = ""; }
  if(btnEl) btnEl.disabled = true;
  if(boxEl) boxEl.classList.add("brutal-danger");
  
  if(msgEl) msgEl.style.color = "#ef4444";

  let secondsLeft = 300; 
  const match = message.match(/\d+/);
  if (match) { secondsLeft = parseInt(match[0], 10); }

  if (countdownInterval) clearInterval(countdownInterval);
  
  countdownInterval = setInterval(() => {
    if (secondsLeft <= 0) {
      clearInterval(countdownInterval);
      location.reload();
    } else {
      const minutes = Math.floor(secondsLeft / 60);
      const seconds = secondsLeft % 60;
      if(msgEl) {
        msgEl.innerHTML = `🚨 <span style="font-weight:900;font-size:14px;letter-spacing:0.5px;">IP TEMPORARILY BLACKLISTED</span><br>ระบบเซิร์ฟเวอร์ตรวจพบการสุ่มรหัสผ่าน พอร์ตไอพีถูกระงับ <br><span style="font-size:18px;font-weight:bold;color:#fff;margin-top:10px;display:inline-block;">💥 LOCKDOWN TIMER: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}</span>`;
      }
      secondsLeft--;
    }
  }, 1000);
}

// ==========================================================================
// 10. INDEXED LOCAL DB STORAGE MANAGEMENT
// ==========================================================================
function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_DATA)) {
        db.createObjectStore(STORE_DATA, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function loadTable(){
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = '<tr><td colspan="3" class="status-loading">กำลังตรวจสอบฐานข้อมูลแคชความเร็วสูง...</td></tr>';
  
  try {
    const db = await initIndexedDB();
    const tx = db.transaction([STORE_DATA, STORE_META], "readonly");
    const dataStore = tx.objectStore(STORE_DATA);
    const metaStore = tx.objectStore(STORE_META);
    
    const cachedItems = await new Promise(r => { dataStore.getAll().onsuccess = e => r(e.target.result); });
    const lastUpdate = await new Promise(r => { metaStore.get("last_sync").onsuccess = e => r(e.target.result); });
    
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    if (cachedItems && cachedItems.length > 0 && lastUpdate && (now - lastUpdate < oneDayMs)) {
      rawData = cachedItems;
      updateChipStyles();
      applyAll();
      return;
    }
    
    await fetchAllDataFromServer(db);
  } catch(e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:red;padding:20px;">เกิดข้อผิดพลาดในการโหลดระบบภายในฐานข้อมูลแคช</td></tr>`;
  }
}

// ==========================================================================
// 11. BULK DATA STREAMING & CHUNK PROCESSING
// ==========================================================================
async function fetchAllDataFromServer(db) {
  const tbody = document.getElementById("table-body");
  const syncBtn = document.getElementById("syncBtn");
  const progressText = document.getElementById("syncProgress");
  
  try {
    syncBtn.disabled = true;
    syncBtn.innerText = "⏳ กำลังโหลด...";
    progressText.style.display = "inline"; 
    
    rawData = []; 
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
      if (securityBreached) return;
      progressText.textContent = `⏳ Loading: ${rawData.length.toLocaleString()} rows...`;
      
      const response = await fetch(SUPABASE_BASE_URL, {
        method: "POST",
        headers: {
          "apikey": ANON_KEY,
          "Authorization": "Bearer " + ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_input_password: globalVerifiedPassword,
          limit: limit,
          offset: offset
        })
      });
      
      if (response.status === 400) {
        const errJson = await response.json().catch(() => ({}));
        if (errJson.message && errJson.message.includes("locked")) {
          executeBrutalLockout(errJson.message);
          throw new Error("SERVER BLACKLIST BLOCK DETECTED");
        }
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          clearAuthToken();
          location.reload();
        }
        throw new Error(`HTTP Fail Status Code: ${response.status}`);
      }
      
      const chunk = await response.json();
      
      const cleanChunk = chunk.map(item => {
        let newItem = {};
        for (let k in item) {
          let cleanKey = String(k).replace(/\s/g, "").toLowerCase();
          newItem[cleanKey] = item[k];
        }
        return newItem;
      });
      
      rawData = rawData.concat(cleanChunk);
      
      updateChipStyles();
      applyAll(); 
      
      if (chunk.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }
    
    progressText.textContent = `✅ Loaded: ${rawData.length.toLocaleString()} rows (100%)`;
    
    const writeTx = db.transaction([STORE_DATA, STORE_META], "readwrite");
    const dataStore = writeTx.objectStore(STORE_DATA);
    const metaStore = writeTx.objectStore(STORE_META);
    
    dataStore.clear();
    rawData.forEach(item => dataStore.add(item));
    metaStore.put(Date.now(), "last_sync");
    
    syncBtn.disabled = false;
    syncBtn.innerText = "🔄 Sync ข้อมูล";
  } catch (error) {
    console.error(error);
    syncBtn.disabled = false;
    syncBtn.innerText = "🔄 Sync ข้อมูล";
    progressText.textContent = `❌ Load Failed`;
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:red;padding:20px;">การเชื่อมต่อล้มเหลว ดึงข้อมูลไม่สำเร็จ</td></tr>`;
  }
}

async function forceSyncFromServer() {
  try {
    const db = await initIndexedDB();
    await fetchAllDataFromServer(db);
  } catch (e) {
    console.error(e);
    alert("❌ ไม่สามารถดึงข้อมูลแบบบังคับรีเฟรชได้ในขณะนี้");
  }
}

// ==========================================================================
// 12. MULTI-LAYER FILTER ENGINE
// ==========================================================================
function applyAll(){
  if(securityBreached) return;
  const q         = document.getElementById("searchBox").value.toLowerCase().trim();
  const hideZero = document.getElementById("hideZero").checked;
  const selectedBrand = document.getElementById("brandSelector").value;

  const activeCats = CAT_FILTERS.filter(f => document.getElementById(f.id) && document.getElementById(f.id).checked);
  const activeDivs = DIV_FILTERS.filter(f => document.getElementById(f.id) && document.getElementById(f.id).checked);

  let result = rawData;

  if(activeDivs.length > 0){
    result = result.filter(i => {
      const prodDiv = String(i.productdivision || "").trim().toLowerCase();
      return activeDivs.some(f => prodDiv === f.value.toLowerCase());
    });
  }

  if(activeCats.length > 0){
    result = result.filter(i => {
      const gname = String(i.gnamechr || "").toLowerCase();
      return activeCats.some(f => gname.includes(f.keyword.toLowerCase()));
    });
  }

  if(selectedBrand !== "ALL"){
    result = result.filter(i => {
      const typeVal = String(i.type || "").trim().toUpperCase();
      if(selectedBrand === "CROMAX") {
        return typeVal === "CROMAX" || typeVal === "NASON";
      }
      return typeVal === selectedBrand;
    });
  }

  if(q){
    result = result.filter(i =>
      String(i.code || "").toLowerCase().includes(q) ||
      String(i.codematch || "").toLowerCase().includes(q) ||
      String(i.gbarcode || "").toLowerCase().includes(q) ||
      String(i.name || "").toLowerCase().includes(q) ||
      String(i.gnamechr || "").toLowerCase().includes(q) ||
      String(i.spcodes || "").toLowerCase().includes(q) || 
      String(i[currentDynamicColumn] || "").toLowerCase().includes(q)
    );
  }

  if(hideZero){
    result = result.filter(i => {
      let v = String(i[currentDynamicColumn] || "-").trim();
      v = v.replace(/,/g, '');
      if(v === "" || v === "-") return false;
      const n = parseFloat(v);
      if(!isNaN(n) && n === 0) return false;
      return true;
    });
  }

  filteredData = result;

  if(sortState.key){
    applySortOnFiltered();
  } else {
    viewData = filteredData;
    renderTable(viewData);
  }

  calculateInventorySum(viewData);
  updateResultCount(viewData.length);
}

// ==========================================================================
// 13. DATA AGGREGATION & ALGEBRA
// ==========================================================================
function calculateInventorySum(data) {
  let totalCost = 0;
  data.forEach(item => {
    let rawVal = item.onhand_cost ? String(item.onhand_cost).trim().replace(/,/g, '') : "";
    const costVal = parseFloat(rawVal);
    if(!isNaN(costVal)) { totalCost += costVal; }
  });
  
  let formattedCost = "";
  if (totalCost >= 1000000) {
    formattedCost = (totalCost / 1000000).toFixed(2) + "M";
  } else if (totalCost >= 1000) {
    formattedCost = (totalCost / 1000).toFixed(2) + "K";
  } else {
    formattedCost = totalCost.toFixed(2);
  }
  
  document.getElementById("inventory-cost-sum").textContent = `Value: ${formattedCost}`;
}

// ==========================================================================
// 14. SORTING SYSTEM (ALPHANUMERIC)
// ==========================================================================
function sortTable(key){
  if(sortState.key === key){
    sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
  } else {
    sortState.key = key;
    sortState.dir = "asc";
  }
  applySortOnFiltered();
}

function applySortOnFiltered(){
  const { key, dir } = sortState;
  const targetKey = key === "dynamic" ? currentDynamicColumn : key;

  viewData = [...filteredData].sort((a, b) => {
    let v1 = a[targetKey] ?? "";
    let v2 = b[targetKey] ?? "";
    if(typeof v1 === 'string') v1 = v1.replace(/,/g, '');
    if(typeof v2 === 'string') v2 = v2.replace(/,/g, '');
    const n1 = parseFloat(v1);
    const n2 = parseFloat(v2);
    
    if(!isNaN(n1) && !isNaN(n2)){
      return dir === "asc" ? n1 - n2 : n2 - n1;
    }
    v1 = String(v1).toLowerCase();
    v2 = String(v2).toLowerCase();
    if(v1 < v2) return dir === "asc" ? -1 : 1;
    if(v1 > v2) return dir === "asc" ?  1 : -1;
    return 0;
  });
  
  updateArrows(key, dir);
  renderTable(viewData);
  calculateInventorySum(viewData);
  updateResultCount(viewData.length);
}

// ==========================================================================
// 15. UI RENDERERS & CLIPBOARD ASSISTANTS
// ==========================================================================
function copyRowToClipboard(index) {
  const item = viewData[index];
  if (!item) return;

  let rawVal = item[currentDynamicColumn] || "-";
  if(typeof rawVal === 'string') rawVal = rawVal.replace(/,/g, '');
  let formattedVal = rawVal;
  if (currentDynamicColumn !== "stockstatus" && currentDynamicColumn !== "glocat" && !isNaN(parseFloat(rawVal))) {
    formattedVal = parseFloat(rawVal).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }

  const textToCopy = `${item.gbarcode || "-"} ${item.name || "-"} ${formattedVal}`;

  navigator.clipboard.writeText(textToCopy).then(() => {
    const toast = document.getElementById("copyToast");
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 1800);
  }).catch(err => { console.error("Clipboard copy exception: ", err); });
}

function renderTable(data){
  const tbody = document.getElementById("table-body");
  if(!tbody) return;
  if(!data || data.length === 0){
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#aaa;padding:20px;">ไม่พบรายการข้อมูลที่ค้นหา...</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map((p, index) => {
    let rawVal = p[currentDynamicColumn] || "-";
    if(typeof rawVal === 'string') rawVal = rawVal.replace(/,/g, '');
    let formattedVal = rawVal;
    
    if (currentDynamicColumn !== "stockstatus" && currentDynamicColumn !== "glocat" && !isNaN(parseFloat(rawVal))) {
      formattedVal = parseFloat(rawVal).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    return `
      <tr data-index="${index}">
        <td class="col-barcode">${p.gbarcode || "-"}</td>
        <td class="col-desc">${p.name || "-"}</td>
        <td class="col-dynamic">${formattedVal}</td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("tr").forEach(tr => {
    tr.addEventListener("click", () => {
      const idx = tr.getAttribute("data-index");
      if (idx !== null) copyRowToClipboard(parseInt(idx, 10));
    });
  });
}

function updateResultCount(n){
  const el = document.getElementById("result-count");
  if(el) el.textContent = n > 0 ? n.toLocaleString() + " items" : "0 items";
}

function updateArrows(active, dir){
  ["gbarcode", "name", "dynamic"].forEach(k => {
    const el = document.getElementById("arrow-" + k);
    if(!el) return;
    el.textContent = k === active ? (dir === "asc" ? "↑" : "↓") : "↕";
  });
}

function updateChipStyles(){
  CAT_FILTERS.forEach(f => {
    const checkbox = document.getElementById(f.id);
    const chip     = document.getElementById(f.chipId);
    if(checkbox && chip) {
      if(checkbox.checked) chip.classList.add("active");
      else                 chip.classList.remove("active");
    }
  });
  DIV_FILTERS.forEach(f => {
    const checkbox = document.getElementById(f.id);
    const chip     = document.getElementById(f.chipId);
    if(checkbox && chip) {
      if(checkbox.checked) chip.classList.add("active");
      else                 chip.classList.remove("active");
    }
  });
}

function renderChipsUI() {
  const catContainer = document.getElementById("cat-chips-container");
  if (catContainer) {
    catContainer.innerHTML = CAT_FILTERS.map(f => `
      <label id="${f.chipId}" class="chip">
        <input type="checkbox" id="${f.id}"> ${f.label}
      </label>
    `).join("");
  }

  const divContainer = document.getElementById("div-chips-container");
  if (divContainer) {
    divContainer.innerHTML = DIV_FILTERS.map(f => `
      <label id="${f.chipId}" class="chip">
        <input type="checkbox" id="${f.id}"> ${f.label}
      </label>
    `).join("");
  }
}

// ==========================================================================
// 16. APPLICATION INITIALIZATION LIFECYCLE
// ==========================================================================
window.addEventListener("DOMContentLoaded", async () => {
  renderChipsUI();

  // ตรวจสอบ Auto-Login จาก Token Cache 30 วันก่อน
  const isAutoLogged = await checkAutoLogin();

  document.getElementById("searchBox").addEventListener("input", applyAll);
  document.getElementById("hideZero").addEventListener("change", applyAll);
  document.getElementById("brandSelector").addEventListener("change", applyAll);

  const colSelector = document.getElementById("columnSelector");
  colSelector.addEventListener("change", (e) => {
    currentDynamicColumn = e.target.value;
    document.getElementById("dynamic-th-label").innerHTML = `${colSelector.options[colSelector.selectedIndex].text} <span class="sort-arrow" id="arrow-dynamic">↕</span>`;
    sortState = { key: null, dir: "asc" }; 
    applyAll();
  });

  CAT_FILTERS.forEach(f => {
    const checkbox = document.getElementById(f.id);
    if(checkbox) { checkbox.addEventListener("change", () => { updateChipStyles(); applyAll(); }); }
  });

  DIV_FILTERS.forEach(f => {
    const checkbox = document.getElementById(f.id);
    if(checkbox) { checkbox.addEventListener("change", () => { updateChipStyles(); applyAll(); }); }
  });

  document.getElementById("th-gbarcode").addEventListener("click", () => sortTable("gbarcode"));
  document.getElementById("th-name").addEventListener("click", () => sortTable("name"));
  document.getElementById("th-dynamic").addEventListener("click", () => sortTable("dynamic"));

  document.getElementById("submitBtn").addEventListener("click", submitPassword);
  document.getElementById("syncBtn").addEventListener("click", forceSyncFromServer);
  document.getElementById("toTop").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const passInput = document.getElementById("passInput");
  if (passInput) {
    if (!isAutoLogged) passInput.focus();
    passInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") submitPassword();
    });
  }
});
