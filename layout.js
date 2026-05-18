/* ==========================================================
   SUPERPART LAYOUT LOADER & INTERACTION SYSTEM
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const headerPlaceholder = document.getElementById("header-placeholder");

  if (headerPlaceholder) {
    // 1. ดึงไฟล์ header.html เข้ามาแทนที่ใน Placeholder บล็อก
    fetch("header.html")
      .then(response => {
        if (!response.ok) {
          throw new Error("Network response was not ok for header.html");
        }
        return response.text();
      })
      .then(data => {
        headerPlaceholder.innerHTML = data;

        // 2. เรียกใช้งานระบบ Event Listeners หลังจาก Element โหลดเสร็จแล้ว
        initHeaderInteractions();
      })
      .catch(error => {
        console.error("Error loading the header layout:", error);
      });
  }
});

function initHeaderInteractions() {
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");

  if (menuBtn && menuDropdown) {
    // จับการคลิกที่ปุ่มแฮมเบอร์เกอร์เพื่อ Toggle คลาส active
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // กันไม่ให้ event ไหลไปโดน window
      menuDropdown.classList.toggle("active");
    });

    // ตรวจจับการคลิกที่อื่นภายนอกเมนู (Outside Click) เพื่อหุบเมนูเก็บลงไป
    window.addEventListener("click", (e) => {
      if (!menuBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
        menuDropdown.classList.remove("active");
      }
    });

    // ป้องกันการปิดเมนูเมื่อผู้ใช้ทำการคลิกด้านในกล่อง dropdown
    menuDropdown.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
}