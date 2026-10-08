// =========================
// LAYOUT CONTROLLER + ACCESS AUTH
// =========================

document.addEventListener("DOMContentLoaded", () => {
  initLayout();
});

let layoutInitialized = false;
let authInitialized = false;

// =========================
// SUPABASE AUTH CONFIG
// =========================

const SUPABASE_AUTH_URL =
  "https://lhnhmjbdowlmurpvxzew.supabase.co/rest/v1/rpc/verify_superpart_password";
  
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxobmhtamJkb3dsm3JweHpldyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzgyNDUyMjUwLCJleHAiOjIwOTgwMjgyNTB9.suJwzEkJKLD3tsv2o-fY_hOwatmy7i3-saD3Nt0hb4A";

const AUTH_CACHE_KEY = "SUPERPART_AUTH_CACHE";
const AUTH_CACHE_DAYS = 3;
const AUTH_CACHE_MS = AUTH_CACHE_DAYS * 24 * 60 * 60 * 1000;


// =========================
// MAIN LAYOUT
// =========================

async function initLayout() {

  if (layoutInitialized) return;
  layoutInitialized = true;

  // =========================
  // LOAD HEADER
  // =========================

  const headerPlaceholder = document.getElementById("header-placeholder");

  if (headerPlaceholder && !headerPlaceholder.dataset.loaded) {

    const headerRes = await fetch("header.html");
    const headerHtml = await headerRes.text();

    headerPlaceholder.innerHTML = headerHtml;
    headerPlaceholder.dataset.loaded = "true";
  }

  // =========================
  // LOAD FOOTER
  // =========================

  const footerPlaceholder = document.getElementById("footer-placeholder");

  if (footerPlaceholder && !footerPlaceholder.dataset.loaded) {

    const footerRes = await fetch("footer.html");
    const footerHtml = await footerRes.text();

    footerPlaceholder.innerHTML = footerHtml;
    footerPlaceholder.dataset.loaded = "true";
  }

  // =========================
  // AUTHENTICATION
  // =========================

  await initAuthentication();

  // =========================
  // INIT INTERACTIONS
  // =========================

  initHamburgerMenu();
}


// =========================
// AUTHENTICATION CONTROLLER
// =========================

async function initAuthentication() {

  if (authInitialized) return;
  authInitialized = true;

  const cachedAuth = getAuthCache();

  if (cachedAuth) {
    enableProtectedPage();
    return;
  }

  disableProtectedPage();
  showLoginScreen();
}


// =========================
// CHECK LOCAL AUTH CACHE
// =========================

function getAuthCache() {

  const raw = localStorage.getItem(AUTH_CACHE_KEY);

  if (!raw) return null;

  try {

    const data = JSON.parse(raw);

    if (!data.authenticated || !data.expiresAt) {
      clearAuthCache();
      return null;
    }

    if (Date.now() > Number(data.expiresAt)) {
      clearAuthCache();
      return null;
    }

    return data;

  } catch (error) {

    clearAuthCache();
    return null;
  }
}


// =========================
// SAVE AUTH CACHE
// =========================

function saveAuthCache() {

  const expiresAt = Date.now() + AUTH_CACHE_MS;

  const authData = {
    authenticated: true,
    loginAt: Date.now(),
    expiresAt: expiresAt
  };

  localStorage.setItem(
    AUTH_CACHE_KEY,
    JSON.stringify(authData)
  );
}


// =========================
// CLEAR AUTH CACHE
// =========================

function clearAuthCache() {

  localStorage.removeItem(AUTH_CACHE_KEY);
}


// =========================
// DISABLE PAGE UNTIL LOGIN
// =========================

function disableProtectedPage() {

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  const protectedElements = document.querySelectorAll(
    "body > *:not(#header-placeholder):not(#footer-placeholder)"
  );

  protectedElements.forEach(el => {
    el.style.visibility = "hidden";
  });
}


// =========================
// ENABLE PAGE AFTER LOGIN
// =========================

function enableProtectedPage() {

  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";

  const protectedElements = document.querySelectorAll(
    "body > *:not(#header-placeholder):not(#footer-placeholder)"
  );

  protectedElements.forEach(el => {
    el.style.visibility = "";
  });

  const loginScreen = document.getElementById("superpartLoginScreen");

  if (loginScreen) {
    loginScreen.remove();
  }
}


// =========================
// CREATE LOGIN SCREEN
// =========================

function showLoginScreen() {

  if (document.getElementById("superpartLoginScreen")) {
    return;
  }

  const loginScreen = document.createElement("div");

  loginScreen.id = "superpartLoginScreen";

  loginScreen.innerHTML = `
    <div class="superpart-login-overlay">

      <div class="superpart-login-box">

        <div class="superpart-login-logo">
          SUPERPART
        </div>

        <div class="superpart-login-title">
          INTERNAL SYSTEM
        </div>

        <div class="superpart-login-subtitle">
          กรุณาใส่รหัสผ่านเพื่อเข้าใช้งาน
        </div>

        <input
          type="password"
          id="superpartLoginPassword"
          class="superpart-login-input"
          placeholder="Password"
          autocomplete="current-password"
        >

        <button
          id="superpartLoginButton"
          class="superpart-login-button"
        >
          LOGIN
        </button>

        <div
          id="superpartLoginMessage"
          class="superpart-login-message"
        ></div>

        <div class="superpart-login-footer">
          Internal Use Only
        </div>

      </div>

    </div>
  `;

  document.body.appendChild(loginScreen);

  injectLoginStyles();

  const input = document.getElementById("superpartLoginPassword");
  const button = document.getElementById("superpartLoginButton");

  if (input) {
    input.focus();

    input.addEventListener("keydown", event => {

      if (event.key === "Enter") {
        verifySuperpartPassword();
      }

    });
  }

  if (button) {
    button.addEventListener(
      "click",
      verifySuperpartPassword
    );
  }
}


// =========================
// VERIFY PASSWORD
// =========================

async function verifySuperpartPassword() {

  const input = document.getElementById(
    "superpartLoginPassword"
  );

  const button = document.getElementById(
    "superpartLoginButton"
  );

  const message = document.getElementById(
    "superpartLoginMessage"
  );

  if (!input || !button || !message) return;

  const password = input.value.trim();

  if (!password) {

    message.textContent =
      "กรุณาใส่รหัสผ่าน";

    message.className =
      "superpart-login-message error";

    input.focus();

    return;
  }

  button.disabled = true;
  button.textContent = "CHECKING...";

  message.textContent =
    "กำลังตรวจสอบสิทธิ์...";

  message.className =
    "superpart-login-message loading";

  try {

    const response = await fetch(
      SUPABASE_AUTH_URL,
      {
        method: "POST",

        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization":
            "Bearer " + SUPABASE_ANON_KEY,
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          user_input_password: password,
          limit: 1,
          offset: 0
        })
      }
    );

    if (response.status === 400) {

      const errorData =
        await response.json().catch(() => ({}));

      if (
        errorData.message &&
        errorData.message.includes("locked")
      ) {

        message.textContent =
          "ระบบถูกระงับชั่วคราว กรุณาลองใหม่ภายหลัง";

        message.className =
          "superpart-login-message error";

        button.disabled = true;

        return;
      }
    }

    if (!response.ok) {
      throw new Error(
        "Authentication request failed"
      );
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {

      message.textContent =
        "รหัสผ่านไม่ถูกต้อง";

      message.className =
        "superpart-login-message error";

      input.value = "";
      input.focus();

      button.disabled = false;
      button.textContent = "LOGIN";

      return;
    }

    // =========================
    // LOGIN SUCCESS
    // =========================

    saveAuthCache();

    enableProtectedPage();

  } catch (error) {

    console.error(
      "Authentication error:",
      error
    );

    message.textContent =
      "ไม่สามารถเชื่อมต่อระบบตรวจสอบสิทธิ์ได้";

    message.className =
      "superpart-login-message error";

    button.disabled = false;
    button.textContent = "LOGIN";
  }
}


// =========================
// LOGOUT
// =========================

function superpartLogout() {

  clearAuthCache();

  location.reload();
}


// =========================
// LOGIN STYLES
// =========================

function injectLoginStyles() {

  if (
    document.getElementById(
      "superpartLoginStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "superpartLoginStyles";

  style.textContent = `

    .superpart-login-overlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(248, 249, 251, 0.98);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 20px;
      box-sizing: border-box;
    }

    .superpart-login-box {
      width: 100%;
      max-width: 360px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 20px;
      padding: 34px 30px;
      box-sizing: border-box;
      box-shadow:
        0 20px 60px rgba(0,0,0,0.08);
      text-align: center;
    }

    .superpart-login-logo {
      font-size: 15px;
      letter-spacing: 5px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 12px;
    }

    .superpart-login-title {
      font-size: 12px;
      letter-spacing: 2px;
      color: #6b7280;
      font-weight: 600;
    }

    .superpart-login-subtitle {
      margin-top: 24px;
      margin-bottom: 18px;
      font-size: 13px;
      color: #6b7280;
    }

    .superpart-login-input {
      width: 100%;
      height: 46px;
      padding: 0 14px;
      box-sizing: border-box;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      outline: none;
      font-size: 14px;
      background: #fff;
    }

    .superpart-login-input:focus {
      border-color: #111827;
    }

    .superpart-login-button {
      width: 100%;
      height: 46px;
      margin-top: 12px;
      border: 0;
      border-radius: 10px;
      background: #111827;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 1px;
      cursor: pointer;
    }

    .superpart-login-button:hover {
      opacity: 0.9;
    }

    .superpart-login-button:disabled {
      opacity: 0.5;
      cursor: wait;
    }

    .superpart-login-message {
      min-height: 20px;
      margin-top: 14px;
      font-size: 12px;
      line-height: 1.5;
    }

    .superpart-login-message.loading {
      color: #2563eb;
    }

    .superpart-login-message.error {
      color: #dc2626;
    }

    .superpart-login-footer {
      margin-top: 24px;
      font-size: 10px;
      color: #9ca3af;
      letter-spacing: 0.5px;
    }

    @media(max-width:768px){

      .superpart-login-box {
        padding: 30px 22px;
        border-radius: 18px;
      }

    }

  `;

  document.head.appendChild(style);
}


// =========================
// HAMBURGER MENU
// =========================

let hamburgerBound = false;
let outsideClickBound = false;

function initHamburgerMenu() {

  const menuBtn =
    document.getElementById("menuBtn");

  const menuDropdown =
    document.getElementById("menuDropdown");

  if (!menuBtn || !menuDropdown) return;

  if (hamburgerBound) return;

  hamburgerBound = true;

  menuBtn.addEventListener("click", (e) => {

    e.stopPropagation();

    menuDropdown.classList.toggle("active");

  });

  if (!outsideClickBound) {

    window.addEventListener("click", (e) => {

      const menuBtnLive =
        document.getElementById("menuBtn");

      const menuDropdownLive =
        document.getElementById("menuDropdown");

      if (
        !menuBtnLive ||
        !menuDropdownLive
      ) {
        return;
      }

      if (
        !menuBtnLive.contains(e.target) &&
        !menuDropdownLive.contains(e.target)
      ) {

        menuDropdownLive.classList.remove(
          "active"
        );

      }

    });

    outsideClickBound = true;
  }
}
