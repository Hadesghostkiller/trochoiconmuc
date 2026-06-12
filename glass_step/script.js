import { db } from '../denxanhdendo/firebase-config.js';
import { ref as dbRef, update as dbUpdate, onValue as dbOnValue, remove as dbRemove, get as dbGet } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { bo_cau_hoi } from './question.js';

const canvas = document.getElementById('man_hinh_game');
const ctx = canvas.getContext('2d');

const anh_nen = new Image(); anh_nen.src = '../denxanhdendo/res/anh/glass_step_bg.png';
const kinh_img = new Image(); kinh_img.src = '../denxanhdendo/res/anh/kinh1.png';
const anh_nguoi_choi = new Image(); anh_nguoi_choi.src = '../denxanhdendo/res/anh/nhaiu.png';
const am_thanh_kinh_vo = new Audio('../denxanhdendo/res/sound/glassbroken.mp3');
const anh_goi_y = new Image(); anh_goi_y.src = '../denxanhdendo/res/anh/goiy_man2.png';
const am_thanh_mua_goi_y = new Audio('../denxanhdendo/res/sound/boong.mp3');

let nhan_vat_goi_y = {
    x: 50, y: 150, startX: 50, startY: 150, targetX: 50, targetY: 150,
    state: 'idle', // idle, moving_to_player, moving_to_start
    frame: 0, lastFrameTime: 0,
    width: 32.5, height: 32.5, speed: 2
};

let danh_sach_cau_hoi_random = [];
let cau_hoi_hien_tai = 0;
let ket_qua_tra_loi = [];

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

let da_dung_goi_y_buoc_nay = false;
let floatingTexts = [];

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
    // Không làm gì, chuyển bảng xếp hạng qua màn 3
}

document.getElementById('nut_len').addEventListener('click', () => xu_ly_nhay(1));
document.getElementById('nut_xuong').addEventListener('click', () => xu_ly_nhay(0));

// Logic Gợi ý
let timer_tra_loi;
let thoi_gian_con_lai = 30;
let timer_ket_qua;

canvas.addEventListener('click', (e) => {
    if (nhan_vat_goi_y.state !== 'idle' || !roomData.glass_setup_done || roomData.game_ket_thuc_man2) return;
    
    let currentPlayerId = roomData.glass_queue ? roomData.glass_queue[roomData.current_turn_index] : null;
    if (currentPlayerId !== myId) {
        hien_thong_bao("Chỉ được dùng gợi ý khi tới lượt của bạn!");
        return;
    }

    if (da_dung_goi_y_buoc_nay) {
        hien_thong_bao("Bạn đã sử dụng gợi ý cho lượt đi này rồi!");
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    let hw = nhan_vat_goi_y.width;
    let hh = nhan_vat_goi_y.height;
    
    if (mouseX >= nhan_vat_goi_y.x && mouseX <= nhan_vat_goi_y.x + hw &&
        mouseY >= nhan_vat_goi_y.y && mouseY <= nhan_vat_goi_y.y + hh) {
        
        let p = playersList[myId];
        if (p && p.man2_trang_thai === "DANG_CHO") {
            nhan_vat_goi_y.state = 'moving_to_player';
            nhan_vat_goi_y.targetX = p.x + (65 - hw) / 2; // Căn giữa theo người chơi
            nhan_vat_goi_y.targetY = p.y + 65 + 30; // Đứng cách một khoảng xa ở dưới người chơi
        }
    }
});

document.getElementById('nut_khong_goi_y').addEventListener('click', () => {
    document.getElementById('modal_xac_nhan_goi_y').style.display = 'none';
    nhan_vat_goi_y.state = 'moving_to_start';
});

document.getElementById('nut_co_goi_y').addEventListener('click', () => {
    document.getElementById('modal_xac_nhan_goi_y').style.display = 'none';
    
    da_dung_goi_y_buoc_nay = true;

    // Phát âm thanh khi mua gợi ý
    let am_thanh = am_thanh_mua_goi_y.cloneNode(true);
    am_thanh.volume = 0.8;
    am_thanh.play().catch(() => {});

    // Trừ 40 điểm
    let diem_hien_tai = playersList[myId].diem || 0;
    dbUpdate(dbRef(db, `rooms/${currentRoomId}/players/${myId}`), { diem: diem_hien_tai - 40 });
    
    let p = playersList[myId];
    if (p) {
        floatingTexts.push({
            text: "-40 ĐIỂM",
            x: p.x + (p.width || 65) / 2,
            y: p.y - 10,
            opacity: 1.0
        });
    }

    // Random 10 câu hỏi
    let shuffled = [...bo_cau_hoi].sort(() => 0.5 - Math.random());
    danh_sach_cau_hoi_random = shuffled.slice(0, 10);
    cau_hoi_hien_tai = 0;
    ket_qua_tra_loi = [];
    
    hien_thi_cau_hoi();
});

function hien_thi_cau_hoi() {
    if (cau_hoi_hien_tai >= 10) {
        document.getElementById('modal_cau_hoi_goi_y').style.display = 'none';
        hien_thi_ket_qua_goi_y();
        return;
    }
    
    document.getElementById('modal_cau_hoi_goi_y').style.display = 'flex';
    document.getElementById('tieu_de_cau_hoi').innerText = `Câu hỏi ${cau_hoi_hien_tai + 1}/10`;
    
    let q = danh_sach_cau_hoi_random[cau_hoi_hien_tai];
    document.getElementById('noi_dung_cau_hoi').innerText = q.q;
    
    let vung_dap_an = document.getElementById('vung_dap_an');
    vung_dap_an.innerHTML = '';
    
    q.a.forEach((ans, index) => {
        let btn = document.createElement('button');
        btn.innerText = ans;
        btn.style.padding = '10px 20px';
        btn.style.fontFamily = 'PixelKVN';
        btn.style.cursor = 'pointer';
        btn.onclick = () => xu_ly_tra_loi(index, q.c);
        vung_dap_an.appendChild(btn);
    });

    thoi_gian_con_lai = 30;
    document.getElementById('thoi_gian_tra_loi').innerText = `Thời gian: ${thoi_gian_con_lai}s`;
    clearInterval(timer_tra_loi);
    timer_tra_loi = setInterval(() => {
        thoi_gian_con_lai--;
        document.getElementById('thoi_gian_tra_loi').innerText = `Thời gian: ${thoi_gian_con_lai}s`;
        if (thoi_gian_con_lai <= 0) {
            clearInterval(timer_tra_loi);
            xu_ly_tra_loi(-1, q.c); // Hết giờ bị tính là sai
        }
    }, 1000);
}

function xu_ly_tra_loi(index_chon, index_dung) {
    clearInterval(timer_tra_loi);
    if (index_chon === index_dung) {
        ket_qua_tra_loi.push(true);
    } else {
        ket_qua_tra_loi.push(false);
    }
    cau_hoi_hien_tai++;
    hien_thi_cau_hoi();
}

function hien_thi_ket_qua_goi_y() {
    let seq = roomData.glass_sequence || [];
    let ket_qua_str = [];
    for (let i = 0; i < 10; i++) {
        if (ket_qua_tra_loi[i]) {
            ket_qua_str.push(seq[i]);
        } else {
            ket_qua_str.push("?");
        }
    }
    
    document.getElementById('chuoi_ket_qua_goi_y').innerText = ket_qua_str.join(" - ");
    document.getElementById('modal_ket_qua_goi_y').style.display = 'flex';

    let thoi_gian_hien_goi_y = 5;
    let nut_dong = document.getElementById('nut_dong_ket_qua');
    nut_dong.innerText = `ĐÃ HIỂU (${thoi_gian_hien_goi_y}s)`;
    nut_dong.disabled = true;

    clearInterval(timer_ket_qua);
    timer_ket_qua = setInterval(() => {
        thoi_gian_hien_goi_y--;
        if (thoi_gian_hien_goi_y > 0) {
            nut_dong.innerText = `ĐÃ HIỂU (${thoi_gian_hien_goi_y}s)`;
        } else {
            clearInterval(timer_ket_qua);
            nut_dong.innerText = `ĐÃ HIỂU`;
            nut_dong.disabled = false;
            dong_modal_ket_qua(); // Tự động đóng gợi ý khi hết 5 giây
        }
    }, 1000);
}

function dong_modal_ket_qua() {
    clearInterval(timer_ket_qua);
    document.getElementById('modal_ket_qua_goi_y').style.display = 'none';
    nhan_vat_goi_y.targetX = nhan_vat_goi_y.startX;
    nhan_vat_goi_y.targetY = nhan_vat_goi_y.startY;
    nhan_vat_goi_y.state = 'moving_to_start';
}

document.getElementById('nut_dong_ket_qua').addEventListener('click', dong_modal_ket_qua);

function xu_ly_nhay(rowChoice) {
    let p = playersList[myId];
    if (!p || p.man2_trang_thai !== "DANG_CHO") return;
    
    let nextStep = (p.current_step !== undefined ? p.current_step : -1) + 1;
    if (nextStep >= 10) return;
    
    let isSafe = (roomData.glass_sequence && roomData.glass_sequence[nextStep] === rowChoice);
    let targetX = startGlassX + nextStep * stepWidth;
    let targetY = (rowChoice === 1) ? topRowY : bottomRowY;
    
    if (isSafe) {
        da_dung_goi_y_buoc_nay = false;

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
    
    // Xử lý và vẽ nhân vật gợi ý
    if (anh_goi_y.complete && anh_goi_y.width > 0) {
        let fw = anh_goi_y.width / 5;
        let fh = anh_goi_y.height;
        
        if (nhan_vat_goi_y.state === 'moving_to_player' || nhan_vat_goi_y.state === 'moving_to_start') {
            let dx = nhan_vat_goi_y.targetX - nhan_vat_goi_y.x;
            let dy = nhan_vat_goi_y.targetY - nhan_vat_goi_y.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > nhan_vat_goi_y.speed) {
                nhan_vat_goi_y.x += (dx / dist) * nhan_vat_goi_y.speed;
                nhan_vat_goi_y.y += (dy / dist) * nhan_vat_goi_y.speed;
                
                // Animation loop
                if (Date.now() - nhan_vat_goi_y.lastFrameTime > 80) {
                    nhan_vat_goi_y.frame = (nhan_vat_goi_y.frame + 1) % 5;
                    nhan_vat_goi_y.lastFrameTime = Date.now();
                }
            } else {
                nhan_vat_goi_y.x = nhan_vat_goi_y.targetX;
                nhan_vat_goi_y.y = nhan_vat_goi_y.targetY;
                nhan_vat_goi_y.frame = 0; // Đứng im
                
                if (nhan_vat_goi_y.state === 'moving_to_player') {
                    nhan_vat_goi_y.state = 'waiting_action';
                    document.getElementById('modal_xac_nhan_goi_y').style.display = 'flex';
                } else if (nhan_vat_goi_y.state === 'moving_to_start') {
                    nhan_vat_goi_y.state = 'idle';
                }
            }
        } else {
            nhan_vat_goi_y.frame = 0; // Đứng im khi idle hoặc waiting
        }
        
        ctx.drawImage(anh_goi_y, nhan_vat_goi_y.frame * fw, 0, fw, fh, nhan_vat_goi_y.x, nhan_vat_goi_y.y, nhan_vat_goi_y.width, nhan_vat_goi_y.height);
    }
    
    // Xử lý và vẽ hiệu ứng điểm số bay lên
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i];
        ft.y -= 1; // Di chuyển chữ lên trên
        ft.opacity -= 0.015; // Mờ dần
        
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.opacity);
        ctx.font = 'bold 22px PixelKVN, Arial';
        ctx.fillStyle = '#ff3333';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
        
        if (ft.opacity <= 0) {
            floatingTexts.splice(i, 1);
        }
    }

    requestAnimationFrame(vong_lap_game);
}