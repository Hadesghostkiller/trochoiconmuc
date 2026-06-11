import { db } from '../denxanhdendo/firebase-config.js';
import { ref as dbRef, update as dbUpdate, onValue as dbOnValue, remove as dbRemove, get as dbGet } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const canvas = document.getElementById('man_hinh_game');
const ctx = canvas.getContext('2d');

const anh_nen = new Image(); anh_nen.src = '../denxanhdendo/res/anh/glass_step_bg.png';
const kinh_img = new Image(); kinh_img.src = '../denxanhdendo/res/anh/kinh1.png';
const anh_nguoi_choi = new Image(); anh_nguoi_choi.src = '../denxanhdendo/res/anh/nhaiu.png';
const am_thanh_kinh_vo = new Audio('../denxanhdendo/res/sound/glassbroken.mp3');

let myId = localStorage.getItem("player_id");
let myName = localStorage.getItem("player_name");

if (!myId) {
    window.location.href = '../denxanhdendo/index.html';
}

const urlParams = new URLSearchParams(window.location.search);
const currentRoomId = urlParams.get('phong');

if (!currentRoomId) {
    window.location.href = '../denxanhdendo/index.html';
}

let isHost = false;
let roomData = {};
let playersList = {};

let played_broken_glasses = {};
let localBrokenTimes = {};
let localEventTimes = {};
let isInitialLoad = true;

const startGlassX = 350;
const stepWidth = 75;
const topRowY = 220;
const bottomRowY = 380;
const safeZoneX = 1150;

function hien_thong_bao(chuoi_text) {
    document.getElementById('noi_dung_thong_bao').innerText = chuoi_text;
    document.getElementById('hop_thoai_thong_bao').style.display = 'flex';
}

document.getElementById('nut_dong_thong_bao').addEventListener('click', () => {
    document.getElementById('hop_thoai_thong_bao').style.display = 'none';
});

document.getElementById('nut_thoat').addEventListener('click', () => {
    window.location.href = '../denxanhdendo/index.html';
});

document.getElementById('nut_ve_sanh').addEventListener('click', () => {
    window.location.href = '../denxanhdendo/index.html';
});

dbGet(dbRef(db, 'rooms/' + currentRoomId)).then((snapshot) => {
    if (snapshot.exists()) {
        roomData = snapshot.val();
        isHost = (roomData.chu_phong === myId);
        
        dbOnValue(dbRef(db, 'rooms/' + currentRoomId), (snap) => {
            if (!snap.exists()) {
                window.location.href = '../denxanhdendo/index.html';
                return;
            }
            roomData = snap.val();
            playersList = roomData.players || {};
            
            if (isInitialLoad) {
                if (roomData.broken_glasses) {
                    for (let key in roomData.broken_glasses) {
                        played_broken_glasses[key] = true;
                        localBrokenTimes[key] = Date.now() - 5000; // past
                    }
                }
                isInitialLoad = false;
            } else {
                if (roomData.broken_glasses) {
                    for (let key in roomData.broken_glasses) {
                        if (!localBrokenTimes[key]) {
                            localBrokenTimes[key] = Date.now();
                        }
                        if (!played_broken_glasses[key]) {
                            played_broken_glasses[key] = true;
                            let soundClone = am_thanh_kinh_vo.cloneNode(true);
                            soundClone.volume = 1.0;
                            soundClone.play().catch(() => {});
                        }
                    }
                }
            }
            
            cap_nhat_giao_dien_kinh();
            xu_ly_logic_host();
        });
        
        requestAnimationFrame(vong_lap_game);
    } else {
        alert("Phòng không tồn tại!");
        window.location.href = '../denxanhdendo/index.html';
    }
});

function xu_ly_logic_host() {
    if (!isHost) return;
    
    if (!roomData.glass_setup_done) {
        let seq = [];
        for(let i=0; i<10; i++) seq.push(Math.round(Math.random())); // 1 = top, 0 = bottom
        
        let survivors = Object.values(playersList).filter(p => p.trang_thai === "THANG");
        survivors.sort((a, b) => (a.diem || 0) - (b.diem || 0));
        let queue = survivors.map(p => p.id);
        
        let updates = {
            glass_setup_done: true,
            glass_sequence: seq,
            glass_queue: queue,
            current_turn_index: 0,
            broken_glasses: {},
            game_ket_thuc_man2: false
        };
        
        survivors.forEach((p, idx) => {
            updates[`players/${p.id}/x`] = 100 + (idx % 3) * 60;
            updates[`players/${p.id}/y`] = 200 + Math.floor(idx / 3) * 60;
            updates[`players/${p.id}/man2_trang_thai`] = "DANG_CHO"; 
            updates[`players/${p.id}/current_step`] = -1;
            updates[`players/${p.id}/man2_diem`] = 0;
        });
        
        dbUpdate(dbRef(db, 'rooms/' + currentRoomId), updates);
    } else if (!roomData.game_ket_thuc_man2) {
        let currentPlayerId = roomData.glass_queue ? roomData.glass_queue[roomData.current_turn_index] : null;
        if (currentPlayerId) {
            let p = playersList[currentPlayerId];
            if (p && (p.man2_trang_thai === "ROT" || p.man2_trang_thai === "QUA_DICH")) {
                let eventKey = p.id + "_" + p.current_step + "_" + p.man2_trang_thai;
                if (!localEventTimes[eventKey]) {
                    localEventTimes[eventKey] = Date.now();
                }
                
                let timeToWait = p.man2_trang_thai === "ROT" ? 1500 : 500; 
                let elapsed = Date.now() - localEventTimes[eventKey];
                
                if (elapsed >= timeToWait) {
                    let nextIdx = roomData.current_turn_index + 1;
                    if (nextIdx >= roomData.glass_queue.length) {
                        dbUpdate(dbRef(db, 'rooms/' + currentRoomId), { game_ket_thuc_man2: true });
                    } else {
                        dbUpdate(dbRef(db, 'rooms/' + currentRoomId), { current_turn_index: nextIdx });
                    }
                } else {
                    clearTimeout(window.turnTimeout);
                    window.turnTimeout = setTimeout(() => {
                        xu_ly_logic_host();
                    }, timeToWait - elapsed + 50);
                }
            } else if (!p) {
                let nextIdx = roomData.current_turn_index + 1;
                dbUpdate(dbRef(db, 'rooms/' + currentRoomId), { current_turn_index: nextIdx });
            }
        } else {
            dbUpdate(dbRef(db, 'rooms/' + currentRoomId), { game_ket_thuc_man2: true });
        }
    }
}

function cap_nhat_giao_dien_kinh() {
    if (!roomData.glass_setup_done || roomData.game_ket_thuc_man2) {
        document.getElementById('ui_kinh').style.display = 'none';
    } else {
        document.getElementById('ui_kinh').style.display = 'block';
        let currentPlayerId = roomData.glass_queue ? roomData.glass_queue[roomData.current_turn_index] : null;
        
        let pName = playersList[currentPlayerId] ? playersList[currentPlayerId].ten : "Trống";
        document.getElementById('luot_cua_ai').innerText = (currentPlayerId === myId) ? "TỚI LƯỢT BẠN!" : `Lượt của: ${pName}`;
        
        let amICurrent = (currentPlayerId === myId);
        let myP = playersList[myId];
        let canPlay = amICurrent && myP && myP.man2_trang_thai === "DANG_CHO";
        
        document.querySelector('.nut_dieu_khien').style.display = canPlay ? 'flex' : 'none';
    }

    if (roomData.game_ket_thuc_man2) {
        hien_thi_bang_xep_hang();

        // Đếm số người đã qua đích an toàn ở màn 2
        let so_nguoi_qua = Object.values(playersList).filter(x => x.man2_trang_thai === "QUA_DICH").length;

        if (so_nguoi_qua > 0) {
            // NẾU CÓ NGƯỜI SỐNG SÓT -> CHUYỂN SANG MÀN 3 (KÉO CO)
            if (isHost && !roomData.chuyen_man_3) {
                // Chủ phòng cập nhật cờ chuyển màn lên Firebase
                dbUpdate(dbRef(db, 'rooms/' + currentRoomId), {chuyen_man_3: true});

                // Đợi 5 giây (để xem kết quả) rồi nhảy sang thư mục keoco
                setTimeout(() => {
                    window.location.href = '../keoco/index.html?phong=' + currentRoomId;
                }, 5000);
            } else if (!isHost) {
                // Các máy khách (Client) cũng sẽ tự động nhảy theo Host
                setTimeout(() => {
                    window.location.href = '../keoco/index.html?phong=' + currentRoomId;
                }, 5000);
            }
        } else {
            // NẾU KHÔNG AI SỐNG SÓT -> GAME OVER VÀ XÓA PHÒNG
            if (isHost && !roomData.thoi_gian_xoa_phong) {
                dbUpdate(dbRef(db, 'rooms/' + currentRoomId), {thoi_gian_xoa_phong: Date.now()});
                setTimeout(() => {
                    dbRemove(dbRef(db, 'rooms/' + currentRoomId)).then(() => {
                        window.location.href = '../denxanhdendo/index.html'; // Về lại sảnh
                    });
                }, 8000);
            } else if (!isHost) {
                setTimeout(() => {
                    window.location.href = '../denxanhdendo/index.html';
                }, 8000);
            }
        }
    }
}

function hien_thi_bang_xep_hang() {
    let m = document.getElementById('man_hinh_xep_hang');
    if (m.style.display === 'block') return;
    m.style.display = 'block';
    document.getElementById('ui_thoat').style.display = 'none';
    
    let arr = Object.values(playersList).filter(p => p.trang_thai === "THANG" || p.diem > 0);
    arr.sort((a, b) => {
        let scoreA = (a.diem || 0) + (a.man2_diem || 0);
        let scoreB = (b.diem || 0) + (b.man2_diem || 0);
        return scoreB - scoreA; // Descending
    });
    
    let html = "";
    arr.forEach((p, idx) => {
        let score = (p.diem || 0) + (p.man2_diem || 0);
        let color = (p.id === myId) ? "#00ff00" : "white";
        html += `<li style="color: ${color}"><span>#${idx+1} ${p.ten}</span> <span>${score} ĐIỂM</span></li>`;
    });
    
    if (arr.length === 0) html = "<li style='text-align:center;'>Không có ai sống sót!</li>";
    
    document.getElementById('danh_sach_xep_hang').innerHTML = html;
}

document.getElementById('nut_len').addEventListener('click', () => xu_ly_nhay(1));
document.getElementById('nut_xuong').addEventListener('click', () => xu_ly_nhay(0));

function xu_ly_nhay(rowChoice) {
    let p = playersList[myId];
    if (!p || p.man2_trang_thai !== "DANG_CHO") return;
    
    let nextStep = (p.current_step !== undefined ? p.current_step : -1) + 1;
    if (nextStep >= 10) return;
    
    let isSafe = (roomData.glass_sequence && roomData.glass_sequence[nextStep] === rowChoice);
    let targetX = startGlassX + nextStep * stepWidth;
    let targetY = (rowChoice === 1) ? topRowY : bottomRowY;
    
    if (isSafe) {
        let updates = {
            [`players/${myId}/current_step`]: nextStep,
            [`players/${myId}/x`]: targetX,
            [`players/${myId}/y`]: targetY - 20
        };
        
        if (nextStep === 9) {
            let so_nguoi_qua = Object.values(playersList).filter(x => x.man2_trang_thai === "QUA_DICH").length;
            let diem_thuong = Math.max(0, 100 - so_nguoi_qua * 10);
            
            updates[`players/${myId}/man2_trang_thai`] = "QUA_DICH";
            updates[`players/${myId}/man2_diem`] = diem_thuong;
            updates[`players/${myId}/x`] = safeZoneX;
            updates[`players/${myId}/y`] = 300 + (so_nguoi_qua * 30);
        }
        dbUpdate(dbRef(db, 'rooms/' + currentRoomId), updates);
        
    } else {
        let breakKey = nextStep + "_" + rowChoice;
        let updates = {
            [`players/${myId}/current_step`]: nextStep,
            [`players/${myId}/x`]: targetX,
            [`players/${myId}/y`]: targetY - 20,
            [`players/${myId}/man2_trang_thai`]: "ROT",
            [`broken_glasses/${breakKey}`]: { time: Date.now() }
        };
        dbUpdate(dbRef(db, 'rooms/' + currentRoomId), updates);
    }
}

function vong_lap_game() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (anh_nen.complete) {
        ctx.drawImage(anh_nen, 0, 0, canvas.width, canvas.height);
    }
    
    if (roomData.glass_setup_done && kinh_img.complete) {
        let fw = kinh_img.width / 4;
        let fh = kinh_img.height;
        let scale = 1.0; 
        
        for (let step = 0; step < 10; step++) {
            let glassX = startGlassX + step * stepWidth;
            
            let frameTop = 0;
            if (localBrokenTimes[step + "_1"]) {
                let el = Date.now() - localBrokenTimes[step + "_1"];
                if (el < 100) frameTop = 1;
                else if (el < 200) frameTop = 2;
                else frameTop = 3;
            }
            ctx.drawImage(kinh_img, frameTop * fw, 0, fw, fh, glassX, topRowY, fw * scale, fh * scale);
            
            let frameBot = 0;
            if (localBrokenTimes[step + "_0"]) {
                let el = Date.now() - localBrokenTimes[step + "_0"];
                if (el < 100) frameBot = 1;
                else if (el < 200) frameBot = 2;
                else frameBot = 3;
            }
            ctx.drawImage(kinh_img, frameBot * fw, 0, fw, fh, glassX, bottomRowY, fw * scale, fh * scale);
        }
    }
    
    if (anh_nguoi_choi.complete) {
        Object.values(playersList).forEach(p => {
            if (!p.man2_trang_thai) return; 
            
            let drawY = p.y;
            if (p.man2_trang_thai === "ROT") {
                let rowChoice = (p.y < 300) ? 1 : 0;
                let bk = p.current_step + "_" + rowChoice;
                if (localBrokenTimes[bk]) {
                    let el = Date.now() - localBrokenTimes[bk];
                    if (el > 300) {
                        drawY += (el - 300) * 0.8; 
                    }
                }
            }
            
            let do_rong = p.width || 65;
            let do_cao = p.height || 65;
            
            ctx.save();
            if (p.man2_trang_thai === "QUA_DICH") ctx.globalAlpha = 0.6;
            ctx.drawImage(anh_nguoi_choi, p.x, drawY, do_rong, do_cao);
            
            ctx.font = '16px PixelKVN, Arial';
            ctx.fillStyle = (p.id === myId) ? '#00ff00' : '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(p.ten, p.x + do_rong / 2, drawY - 10);
            ctx.restore();
        });
    }
    
    requestAnimationFrame(vong_lap_game);
}