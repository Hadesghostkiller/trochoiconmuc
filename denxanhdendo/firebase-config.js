// Tải các thư viện Firebase từ CDN (Gói 0đ chạy thẳng trình duyệt)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Sao chép cấu hình Firebase từ Firebase Console của bạn dán vào đây
const firebaseConfig = {
    apiKey: "AIzaSyBZwxru6OvkblNIjHMAQzMeGE6DIbAfmbk",
  authDomain: "squidgame2007-log.firebaseapp.com",
  databaseURL: "https://squidgame2007-log-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "squidgame2007-log",
  storageBucket: "squidgame2007-log.firebasestorage.app",
  messagingSenderId: "759869953102",
  appId: "1:759869953102:web:7f206bda5c215d77301f1f",
  measurementId: "G-G45KFWQNL6"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);