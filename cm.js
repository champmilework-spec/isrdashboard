// ==========================================================================
// 8. GLOBAL CONFIGURATION & CRYPTO ROUTING
// ==========================================================================
const SUPABASE_BASE_URL = "https://lhnhmjbdowlmurpvxzew.supabase.co/rest/v1/rpc/get_cm_data_secure";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxobmhtamJkb3dsbXVycHZ4emV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NTIyNTAsImV4cCI6MjA5ODAyODI1MH0.suJwzEkJKLD3tsv2o-fY_hOwatmy7i3-saD3Nt0hb4A";

const DB_NAME = "CM_Cache_DB";
const DB_VERSION = 1;
const STORE_DATA = "cm_data";
const STORE_META = "cm_meta";

// ตัวแปรสำหรับจัดการ Local Session Token (กำหนดหมดอายุ 1 ชั่วโมง)
const SESSION_KEY = "CM_AUTH_TOKEN";
const SESSION_EXPIRY_KEY = "CM_AUTH_EXPIRY";
const ONE_HOUR_MS = 60 * 60 * 1000;

// เพิ่มตัวกรอง keyword สำหรับกระดาษทรายน้ำในระบบแมตช์ข้อมูล
const CAT_FILTERS = [
  { id: "cat-lacquer", keyword: "แลคเกอร์", chipId: "chip-lacquer" },
  { id: "cat-tape",    keyword: "กระดาษกาว", chipId: "chip-tape"    },
  { id: "cat-primer",  keyword: "สีรองพื้น",  chipId: "chip-primer"  },
  { id: "cat-spray",   keyword: "สีพ่น",      chipId: "chip-spray"    }, 
  { id: "cat-putty",   keyword: "สีโป๊ว",      chipId: "chip-putty"    },
  { id: "cat-sandpaper", keyword: "กระดาษทราย", chipId: "chip-sandpaper" }
];

const DIV_FILTERS = [
  { id: "div-tool", value: "Tool and Equipment", chipId: "chip-div-tool" },
  { id: "div-wos",  value: "Workshop Product Solution", chipId: "chip-div-wos" }
];

let rawData       = [];
let filteredData = [];
let viewData     = [];
let sortState    = { key: null, dir: "asc" };
let currentDynamicColumn = "onhand_all";

let globalVerifiedPassword = "";
let countdownInterval = null;
let securityBreached = false;

// ==========================================================================
// 9. BRUTAL PROTECTION ENGINE (CORE LOGIC)
// ==========================================================================
async function verifyPasswordBrutal(autoSavedPass = null) {
  if (securityBreached) {
    executeBrutalLockout("CRITICAL: IP Address strictly locked out by backend policy.");
    return;
  }

  const inputEl = document.getElementById("passInput");
  const msgEl = document.getElementById("lock-msg");
  const btnEl = document.getElementById("submitBtn");
  const boxEl = document.querySelector(".lock-box");
  
  const userPass = autoSavedPass || (inputEl ? inputEl.value.trim() : "");
  
  if (!userPass) return;

  if (msgEl) {
    msgEl.style.color = "#3b82f6";
    msgEl.textContent = "⏳ REQUESTING SECURE PROTOCOL AT SERVER SIDE...";
  }
  if (btnEl) btnEl.disabled = true;
  if (boxEl) boxEl.classList.remove("brutal-danger");

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
        clearAuthSession();
        securityBreached = true;
        executeBrutalLockout(errorData.message);
        return;
      }
    }

    if (!response.ok) throw new Error("Server firewall authentication dropped");

    const data = await response.json();

    if (data.length === 0) {
      clearAuthSession();
      if (boxEl) boxEl.classList.add("brutal-danger");
      if (msgEl) {
        msgEl.style.color = "#dc2626";
        msgEl.textContent = "🛑 ACCESS DENIED: INVALID PRIVILEGE IDENTIFIER KEY!";
      }
      if (inputEl) inputEl.value = "";
      if (btnEl) btnEl.disabled = false;
      if (inputEl) inputEl.focus();
      
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
        } else if (checkData.message && msgEl) {
          msgEl.textContent = `🛑 ACCESS DENIED: (${checkData.message})`;
        }
      }
      return;
    }

    // เมื่อตรวจสอบสำเร็จ บันทึก Token ลง localStorage ไว้ใช้ 1 ชั่วโมง
    saveAuthSession(userPass);

    globalVerifiedPassword = userPass;
    const lockScreen = document.getElementById("lock-screen");
    if (lockScreen) {
      lockScreen.style.removeProperty("display");
      lockScreen.style.setProperty("display", "none", "important");
    }
    document.getElementById("main-content-area").style.display = "block";
    loadTable();

  } catch (err) {
    console.error(err);
    if (msgEl) {
      msgEl.style.color = "#dc2626";
      msgEl.textContent = "🚨 CRITICAL ERROR: SECURE TUNNEL DISCONNECTED";
    }
    if (btnEl) btnEl.disabled = false;
  }
}

function saveAuthSession(pass) {
  const expiryTime = Date.now() + ONE_HOUR_MS;
  localStorage.setItem(SESSION_KEY, pass);
  localStorage.setItem(SESSION_EXPIRY_KEY, expiryTime.toString());
}

function clearAuthSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_EXPIRY_KEY);
}

function getValidAuthSession() {
  const savedPass = localStorage.getItem(SESSION_KEY);
  const expiryTime = localStorage.getItem(SESSION_EXPIRY_KEY);

  if (!savedPass || !expiryTime) return null;

  if (Date.now() > parseInt(expiryTime, 10)) {
    clearAuthSession();
    return null;
  }

  return savedPass;
}

function logoutCM() {
  clearAuthSession();
  location.reload();
}

function executeBrutalLockout(message) {
  clearAuthSession();
  securityBreached = true;
  
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
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#777;">กำลังตรวจสอบฐานข้อมูลแคชความเร็วสูง...</td></tr>';
  
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

      if (!response.ok) throw new Error(`HTTP Fail Status Code: ${response.status}`);
      
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
      <tr onclick="copyRowToClipboard(${index})">
        <td class="col-barcode">${p.gbarcode || "-"}</td>
        <td class="col-desc">${p.name || "-"}</td>
        <td class="col-dynamic">${formattedVal}</td>
      </tr>
    `;
  }).join("");
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

// ==========================================================================
// 16. APPLICATION INITIALIZATION LIFECYCLE
// ==========================================================================
window.addEventListener("DOMContentLoaded", () => {
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
  
  // ตรวจสอบ Token ใน LocalStorage อัตโนมัติเมื่อเปิดหน้าเว็บ
  const savedPass = getValidAuthSession();
  if (savedPass) {
    verifyPasswordBrutal(savedPass);
  } else {
    const passInput = document.getElementById("passInput");
    if (passInput) passInput.focus();
  }
});

document.getElementById("toTop").onclick = () => { window.scrollTo({ top: 0, behavior: "smooth" }); };
