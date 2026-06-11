import { db } from '../denxanhdendo/firebase-config.js';
import { ref as dbRef, update as dbUpdate, onValue as dbOnValue, remove as dbRemove, get as dbGet } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const canvas = document.getElementById('man_hinh_game');
const ctx = canvas.getContext('2d');

const anh_nguoi_choi = new Image(); anh_nguoi_choi.src = '../denxanhdendo/res/anh/nhaiu.png';
const anh_nen_keoco = new Image(); anh_nen_keoco.src = '../denxanhdendo/res/anh/bg_keoco.png'; // Đảm bảo đường dẫn tới ảnh nền chính xác

let myId = localStorage.getItem("player_id");
let myName = localStorage.getItem("player_name");

if (!myId) window.location.href = '../denxanhdendo/index.html';

const urlParams = new URLSearchParams(window.location.search);
const currentRoomId = urlParams.get('phong');
if (!currentRoomId) window.location.href = '../denxanhdendo/index.html';

let isHost = false;
let roomData = {};
let playersList = {};

const NGUONG_THANG = 150; // Cần kéo lệch 150 lực để thắng
let rope_pos = 0; // -150 (Đội 1 thắng) <---> 0 (Cân bằng) <---> +150 (Đội 2 thắng)

document.getElementById('nut_thoat').addEventListener('click', () => { window.location.href = '../denxanhdendo/index.html'; });
document.getElementById('nut_ve_sanh').addEventListener('click', () => { window.location.href = '../denxanhdendo/index.html'; });

dbGet(dbRef(db, 'rooms/' + currentRoomId)).then((snapshot) => {
    if (snapshot.exists()) {
        roomData = snapshot.val();
        isHost = (roomData.chu_phong === myId);

        dbOnValue(dbRef(db, 'rooms/' + currentRoomId), (snap) => {
            if (!snap.exists()) { window.location.href = '../denxanhdendo/index.html'; return; }
            roomData = snap.val();
            playersList = roomData.players || {};

            xu_ly_logic_host();
            cap_nhat_ui();
        });
        requestAnimationFrame(vong_lap_game);
    }
});

function xu_ly_logic_host() {
    if (!isHost) return;

    // 1. Chia đội khi bắt đầu
    if (!roomData.keoco_setup_done) {
        let survivors = Object.values(playersList).filter(p => p.man2_trang_thai === "QUA_DICH" || p.trang_thai === "THANG");
        survivors.sort(() => Math.random() - 0.5); // Random vị trí

        let updates = { keoco_setup_done: true, keoco_bat_dau: false, game_ket_thuc_man3: false };
        survivors.forEach((p, idx) => {
            let team = (idx % 2 === 0) ? 1 : 2; // Chia 1, 2, 1, 2...
            updates[`players/${p.id}/man3_team`] = team;
            updates[`players/${p.id}/man3_trang_thai`] = "SONG";
            updates[`players/${p.id}/man3_clicks`] = 0;
        });
        dbUpdate(dbRef(db, 'rooms/' + currentRoomId), updates);

        // Đợi 3 giây rồi bắt đầu cho kéo
        setTimeout(() => {
            dbUpdate(dbRef(db, 'rooms/' + currentRoomId), { keoco_bat_dau: true });
        }, 3000);
    }
    // 2. Tính toán lực kéo liên tục
    else if (roomData.keoco_bat_dau && !roomData.game_ket_thuc_man3) {
        let team1_force = 0;
        let team2_force = 0;

        Object.values(playersList).forEach(p => {
            if (p.man3_team === 1) team1_force += (p.man3_clicks || 0);
            if (p.man3_team === 2) team2_force += (p.man3_clicks || 0);
        });

        rope_pos = team2_force - team1_force;

        // 3. Phân định thắng thua
        if (rope_pos <= -NGUONG_THANG || rope_pos >= NGUONG_THANG) {
            let team_thang = rope_pos <= -NGUONG_THANG ? 1 : 2;
            let updates = { game_ket_thuc_man3: true, keoco_team_thang: team_thang };

            Object.values(playersList).forEach(p => {
                if (p.man3_team) {
                    if (p.man3_team === team_thang) {
                        updates[`players/${p.id}/man3_trang_thai`] = "THANG_CUOC";
                        updates[`players/${p.id}/diem`] = (p.diem || 0) + (p.man2_diem || 0) + 200; // Thưởng điểm
                    } else {
                        updates[`players/${p.id}/man3_trang_thai`] = "CHET";
                    }
                }
            });
            dbUpdate(dbRef(db, 'rooms/' + currentRoomId), updates);
        }
    }
}

// Logic SPAM NÚT CHO NGƯỜI CHƠI (Tối ưu Firebase bằng cách gom 200ms gửi 1 lần)
let localClicks = 0;
let lastSyncTime = 0;

function hanh_dong_keo() {
    if (!roomData.keoco_bat_dau || roomData.game_ket_thuc_man3) return;
    let p = playersList[myId];
    if (!p || p.man3_trang_thai !== "SONG") return;

    localClicks++;
    let now = Date.now();
    if (now - lastSyncTime > 200) {
        let total = (p.man3_clicks || 0) + localClicks;
        dbUpdate(dbRef(db, `rooms/${currentRoomId}/players/${myId}`), { man3_clicks: total });
        localClicks = 0;
        lastSyncTime = now;
    }
}

document.getElementById('nut_spam').addEventListener('click', hanh_dong_keo);
document.addEventListener('keydown', (e) => { if (e.code === 'Space') hanh_dong_keo(); });

function cap_nhat_ui() {
    if (roomData.game_ket_thuc_man3) {
        document.getElementById('ui_keoco').style.display = 'none';
        document.getElementById('man_hinh_xep_hang').style.display = 'block';
        document.getElementById('ui_thoat').style.display = 'none';

        let p = playersList[myId];
        let h2 = document.getElementById('tieu_de_thang_thua');
        if (p && p.man3_trang_thai === "THANG_CUOC") {
            h2.innerText = "CHÚC MỪNG ĐỘI BẠN ĐÃ CHIẾN THẮNG!"; h2.style.color = "#00ff00";
        } else {
            h2.innerText = "ĐỘI CỦA BẠN ĐÃ RƠI XUỐNG VỰC!"; h2.style.color = "red";
        }

        // Render Bảng xếp hạng
        let arr = Object.values(playersList).filter(x => x.diem > 0);
        arr.sort((a, b) => b.diem - a.diem);
        let html = "";
        arr.forEach((p, idx) => {
            html += `<li style="color: ${p.id === myId ? '#00ff00' : 'white'}"><span>#${idx+1} ${p.ten}</span> <span>${p.diem} ĐIỂM</span></li>`;
        });
        document.getElementById('danh_sach_xep_hang').innerHTML = html;

        // Xoá phòng sau 10s
        if (isHost && !roomData.thoi_gian_xoa_phong) {
            dbUpdate(dbRef(db, 'rooms/' + currentRoomId), { thoi_gian_xoa_phong: Date.now() });
            setTimeout(() => {
                dbRemove(dbRef(db, 'rooms/' + currentRoomId)).then(() => window.location.href = '../denxanhdendo/index.html');
            }, 10000);
        }
    } else {
        if (!roomData.keoco_bat_dau) {
            document.getElementById('luot_cua_ai').innerText = "CHUẨN BỊ KÉO!";
            document.getElementById('nut_spam').style.opacity = '0.5';
        } else {
            document.getElementById('luot_cua_ai').innerText = "KÉO ĐI!!! KÉO ĐI!!!";
            document.getElementById('nut_spam').style.opacity = '1';
            document.getElementById('luot_cua_ai').style.color = "#ff007f";
        }
    }
}

function vong_lap_game() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Vẽ ảnh nền không gian kéo co
    if (anh_nen_keoco.complete) {
        ctx.drawImage(anh_nen_keoco, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Tính toán lại rope_pos local để vẽ cho mượt
    if (roomData.keoco_setup_done) {
        let t1 = 0, t2 = 0;
        Object.values(playersList).forEach(p => {
            if (p.man3_team === 1) t1 += (p.man3_clicks || 0);
            if (p.man3_team === 2) t2 += (p.man3_clicks || 0);
        });
        rope_pos = t2 - t1;
    }

    // 3. Tính toán vị trí
    let toa_do_giua = canvas.width / 2;
    let max_dich_chuyen = 200;
    let lech_x = (rope_pos / NGUONG_THANG) * max_dich_chuyen;
    let tam_day = toa_do_giua + lech_x;

    // --- CÁC HẰNG SỐ ĐỒNG BỘ VỊ TRÍ ---
    const CHAR_DRAW_WIDTH = 64;
    const CHAR_DRAW_HEIGHT = 64;
    const VISUAL_GROUND_Y = canvas.height * 0.43; // Mặt bục thép
    const ROPE_Y = VISUAL_GROUND_Y - (CHAR_DRAW_HEIGHT / 2) + 5; // Dây nằm ngang eo

    // 4. Vẽ dây thừng (Vẽ trước người để tạo cảm giác người cầm dây)
    ctx.beginPath();
    ctx.moveTo(tam_day - 600, ROPE_Y);
    ctx.lineTo(tam_day + 600, ROPE_Y);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#8B4513';
    ctx.stroke();

    // Vẽ cờ đỏ đánh dấu giữa dây thừng
    ctx.fillStyle = 'red';
    ctx.fillRect(tam_day - 10, ROPE_Y - 25, 20, 50);

    // 5. Vẽ người chơi
    if (anh_nguoi_choi.complete) {
        let t1_count = 0; let t2_count = 0;
        Object.values(playersList).forEach(p => {
            if (!p.man3_team) return;

            let isDead = (p.man3_trang_thai === "CHET");
            let p_x, p_y;

            // Chân chạm đất
            p_y = VISUAL_GROUND_Y - CHAR_DRAW_HEIGHT;

            const VISUAL_CHASM_EDGE_LEFT = tam_day - 110;
            const VISUAL_CHASM_EDGE_RIGHT = tam_day + 110;

            if (p.man3_team === 1) {
                // Đội 1 đứng bên trái sát mép vực
                p_x = VISUAL_CHASM_EDGE_LEFT - CHAR_DRAW_WIDTH - (t1_count * (CHAR_DRAW_WIDTH + 5));
                t1_count++;
            } else {
                // Đội 2 đứng bên phải sát mép vực
                p_x = VISUAL_CHASM_EDGE_RIGHT + (t2_count * (CHAR_DRAW_WIDTH + 5));
                t2_count++;
            }

            // Xử lý khi rơi xuống vực
            if (isDead) {
                p_x = toa_do_giua + (Math.random() * 40 - 20);
                p_y = (canvas.height / 2) + 150 + (Math.random() * 80);
                ctx.globalAlpha = 0.4;
            }

            // Vẽ nhân vật (Đè lên dây thừng)
            ctx.drawImage(anh_nguoi_choi, p_x, p_y, CHAR_DRAW_WIDTH, CHAR_DRAW_HEIGHT);
            ctx.globalAlpha = 1.0;

            ctx.font = '16px PixelKVN, sans-serif';
            ctx.fillStyle = (p.id === myId) ? '#00ff00' : (p.man3_team === 1 ? '#44aaff' : '#ff44aa');
            ctx.textAlign = 'center';
            ctx.fillText(p.ten, p_x + (CHAR_DRAW_WIDTH/2), p_y - 10);

            if (!isDead) {
                ctx.fillStyle = '#fff';
                ctx.fillText(`Lực: ${p.man3_clicks || 0}`, p_x + (CHAR_DRAW_WIDTH/2), p_y - 25);
            }
        });
    }

    requestAnimationFrame(vong_lap_game);
}