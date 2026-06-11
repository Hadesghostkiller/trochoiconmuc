import { db } from './firebase-config.js';
import { ref as dbRef, set as dbSet, update as dbUpdate, onValue as dbOnValue, remove as dbRemove, get as dbGet } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const canvas = document.getElementById('man_hinh_game');
const ctx = canvas.getContext('2d');

const anh_nen = new Image(); anh_nen.src = 'res/anh/redlight_greenlight_bg.png';
const spritesheet_den = new Image(); spritesheet_den.src = 'res/anh/denxanhdendo.png';
const anh_bup_be = new Image(); anh_bup_be.src = 'res/anh/younghee_1.png';
const anh_nguoi_choi = new Image(); anh_nguoi_choi.src = 'res/anh/nhaiu.png';

// Tải tài nguyên hình ảnh mới phục vụ tính năng Kỹ năng và Hoạt ảnh ngã
const anh_nga = new Image(); anh_nga.src = 'res/anh/nhaiu_nga.png';
const anh_pha = new Image(); anh_pha.src = 'res/anh/pha.png';
const anh_muctieu = new Image(); anh_muctieu.src = 'res/anh/muctieu.png';
const anh_choi = new Image(); anh_choi.src = 'res/anh/choi.png';

const am_thanh_den_xanh = new Audio('res/sound/redlight.mp3');
const am_thanh_sung = new Audio('res/sound/gun.mp3'); 
// Khai báo thêm file hiệu ứng âm thanh kỹ năng mới
const am_thanh_boong = new Audio('res/sound/boong.mp3');
const am_thanh_slap = new Audio('res/sound/slap.mp3');

let myId = localStorage.getItem("player_id") || "p_" + Math.random().toString(36).substring(2, 9);
let myName = localStorage.getItem("player_name") || "";
localStorage.setItem("player_id", myId);

let currentRoomId = null;
let isHost = false;
let roomData = {};
let playersList = {};
let localEndTimerStarted = false;
let amThanhDangPhat = false;

let localBoDemDen = 0;
let localThoiGianDoiDen = 3000;
let localBoDemGiay = 0;
let thoi_gian_truoc_do = performance.now();
const vach_dich_x = 1040;
const bup_be = { x: 1158, y: 280, width: 130, height: 210 };

// Các biến quản lý trạng thái Kỹ năng (Skill) & Hoạt ảnh cục bộ
let skillCooldown = 30000; 
const MAX_COOLDOWN = 30000;
let skillWindowOpen = false;
let day_bo_dem = 0; 
let shakeTimer = 0;

let targetList = [];
let cvSkill = null;
let ctxSkill = null;

const scrLogin = document.getElementById('man_hinh_dang_nhap');
const scrLobby = document.getElementById('man_hinh_phong_cho');
const scrRoomWait = document.getElementById('man_hinh_cho_doi_game');
const scrGame = document.getElementById('vung_chua_game');

function hien_thong_bao_tuy_chinh(chuoi_text) {
    document.getElementById('noi_dung_thong_bao').innerText = chuoi_text;
    document.getElementById('hop_thoai_thong_bao').style.display = 'flex';
}

document.getElementById('nut_dong_thong_bao').addEventListener('click', () => {
    document.getElementById('hop_thoai_thong_bao').style.display = 'none';
});

if (myName) {
    scrLogin.style.display = "none"; scrLobby.style.display = "block";
    document.getElementById('chao_mobi').innerText = `Xin chào, ${myName}!`;
    kiem_tra_link_tham_gia_nhanh();
}

document.getElementById('nut_vao_game').addEventListener('click', () => {
    let ten = document.getElementById('nhap_ten').value.trim();
    if (!ten) return hien_thong_bao_tuy_chinh("Vui lòng nhập tên của bạn trước khi tiếp tục!");
    myName = ten; localStorage.setItem("player_name", myName);
    scrLogin.style.display = "none"; scrLobby.style.display = "block";
    document.getElementById('chao_mobi').innerText = `Xin chào, ${myName}!`;
    kiem_tra_link_tham_gia_nhanh();
});

document.getElementById('nut_doi_ten').addEventListener('click', () => {
    scrLobby.style.display = "none";
    scrLogin.style.display = "block";
});

function kiem_tra_link_tham_gia_nhanh() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('phong');
    if (roomParam) tham_gia_phong(roomParam);
}

document.getElementById('nut_tao_phong').addEventListener('click', () => {
    let randomRoomId = Math.floor(Math.random() * 900 + 100).toString();
    isHost = true; currentRoomId = randomRoomId; localEndTimerStarted = false;

    dbSet(dbRef(db, 'rooms/' + randomRoomId), {
        id_phong: randomRoomId,
        chu_phong: myId,
        bat_dau: false,
        trang_thai_den: 'XANH',
        game_ket_thuc: false,
        thoi_gian_con_lai: 90,
        toc_do_nhac: 1.0
    }).then(() => {
        vao_phong_cho_doi(randomRoomId);
    });
});

document.getElementById('nut_tham_gia').addEventListener('click', () => {
    let ma = document.getElementById('nhap_ma_phong').value.trim();
    if (!ma) return hien_thong_bao_tuy_chinh("Hãy nhập mã phòng gồm 3 chữ số!");
    tham_gia_phong(ma);
});

function tham_gia_phong(roomId) {
    dbGet(dbRef(db, 'rooms/' + roomId)).then((snapshot) => {
        if (snapshot.exists()) {
            let data = snapshot.val();
            if (data.game_ket_thuc) {
                hien_thong_bao_tuy_chinh("Trận đấu ở phòng này đã kết thúc từ trước!");
                return;
            }
            isHost = (data.chu_phong === myId);
            currentRoomId = roomId; localEndTimerStarted = false;
            vao_phong_cho_doi(roomId);
        } else {
            document.getElementById('thong_bao_loi').innerText = "Phòng không tồn tại!";
        }
    });
}

function vao_phong_cho_doi(roomId) {
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?phong=' + roomId;
    window.history.pushState({ path: newUrl }, '', newUrl);

    scrLobby.style.display = "none";
    scrRoomWait.style.display = "block";
    document.getElementById('hien_ma_phong').innerText = `PHÒNG: ${roomId}`;

    dbSet(dbRef(db, `rooms/${roomId}/players/${myId}`), {
        id: myId, ten: myName, x: 30, y: 380, trang_thai: "SONG", goc_xoay_tu_vong: 0, do_mo: 1.0
    });

    khoi_tao_giao_dien_skill_dom();

    dbOnValue(dbRef(db, 'rooms/' + roomId), (snapshot) => {
        if (!snapshot.exists()) {
            if (!roomData.game_ket_thuc) {
                roi_phong_ve_sanh();
            }
            return;
        }
        let oldTrangThaiDen = roomData.trang_thai_den;
        let oldBatDau = roomData.bat_dau;
        let oldPlayersList = JSON.parse(JSON.stringify(playersList || {}));

        roomData = snapshot.val();
        playersList = roomData.players || {};

        if (roomData.bat_dau && !oldBatDau) {
            skillCooldown = MAX_COOLDOWN; 
            document.getElementById('nut_skill_container').style.display = 'block';
        }

        if (roomData.bat_dau && !roomData.game_ket_thuc) {
            Object.values(playersList).forEach(p => {
                let thong_tin_cu = oldPlayersList[p.id];
                
                // Kích hoạt khi phát hiện trạng thái đổi từ "SỐNG" sang "NGÃ"
                if (p.trang_thai === "NGA" && (!thong_tin_cu || thong_tin_cu.trang_thai !== "NGA")) {
                    p.thoi_gian_bat_dau_nga = performance.now();
                    
                    // Phát tiếng boong (ném trúng) và tiếng slap (bị ngã) đồng bộ trên mọi máy
                    let cloneBoong = am_thanh_boong.cloneNode(true);
                    cloneBoong.volume = 0.8;
                    cloneBoong.play().catch(() => {});

                    let cloneSlap = am_thanh_slap.cloneNode(true);
                    cloneSlap.volume = 0.85;
                    cloneSlap.play().catch(() => {});
                    
                    if (p.id === myId && skillWindowOpen) {
                        dong_cua_so_skill();
                        skillCooldown = MAX_COOLDOWN;
                    }
                } else if (thong_tin_cu && thong_tin_cu.trang_thai === "NGA") {
                    p.thoi_gian_bat_dau_nga = thong_tin_cu.thoi_gian_bat_dau_nga;
                }

                if (p.trang_thai === "CHET" && (!thong_tin_cu || thong_tin_cu.trang_thai === "SONG")) {
                    let soundClone = am_thanh_sung.cloneNode(true);
                    soundClone.volume = 0.8;
                    soundClone.play().catch(() => {});
                }
            });
        }

        let listHtml = "";
        Object.values(playersList).forEach(p => {
            let roleTxt = (p.id === roomData.chu_phong) ? " <span style='color:#ff007f;'>(Chủ phòng)</span>" : " (Người chơi)";
            listHtml += `<li>• ${p.ten}${roleTxt}</li>`;
        });
        document.getElementById('danh_sach_cho_u').innerHTML = listHtml;

        if (!roomData.bat_dau) {
            scrGame.style.display = "none";
            scrRoomWait.style.display = "block";
            if (isHost) {
                document.getElementById('nut_chu_phong_bat_dau').style.display = "block";
                document.getElementById('txt_khach_doi').style.display = "none";
            } else {
                document.getElementById('nut_chu_phong_bat_dau').style.display = "none";
                document.getElementById('txt_khach_doi').style.display = "block";
            }
        } else {
            scrRoomWait.style.display = "none";
            scrGame.style.display = "block";

            if (roomData.trang_thai_den !== oldTrangThaiDen || !amThanhDangPhat) {
                xu_ly_am_thanh_theo_den();
            }
        }
    });

    requestAnimationFrame(vong_loop_game_wrapper);
}

function xu_ly_am_thanh_theo_den() {
    if (!roomData.bat_dau || roomData.game_ket_thuc) {
        am_thanh_den_xanh.pause();
        amThanhDangPhat = false;
        return;
    }

    if (roomData.trang_thai_den === 'XANH') {
        let toc_do = roomData.toc_do_nhac || 1.0;
        am_thanh_den_xanh.playbackRate = toc_do;
        am_thanh_den_xanh.currentTime = 0;
        am_thanh_den_xanh.play().catch(()=>{});
        amThanhDangPhat = true;
    } else {
        am_thanh_den_xanh.pause();
        amThanhDangPhat = false;
    }
}

document.getElementById('nut_chu_phong_bat_dau').addEventListener('click', () => {
    if (!isHost) return;
    
    let keys = Object.keys(playersList);
    keys.forEach((id_p, index) => {
        let y_tieu_chuan = 200 + (index * 90);
        dbUpdate(dbRef(db, `rooms/${currentRoomId}/players/${id_p}`), { y: y_tieu_chuan, trang_thai: "SONG" });
    });

    dbUpdate(dbRef(db, 'rooms/' + currentRoomId), { bat_dau: true });
});

function roi_phong_ve_sanh() {
    am_thanh_den_xanh.pause();
    dong_cua_so_skill();
    const container = document.getElementById('nut_skill_container');
    if (container) container.style.display = 'none';

    currentRoomId = null; isHost = false; roomData = {}; playersList = {}; localEndTimerStarted = false; amThanhDangPhat = false;
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({ path: cleanUrl }, '', cleanUrl);
    scrGame.style.display = "none"; scrRoomWait.style.display = "none"; scrLobby.style.display = "block";
}

window.addEventListener('click', (e) => {
    if (!currentRoomId || !roomData.bat_dau || roomData.game_ket_thuc) return;
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('.khung_modal') || e.target.closest('#cua_so_skill')) return;

    let minh = playersList[myId];
    if (!minh) return;

    // Cơ chế nhấn liên tục 4 lần để đứng dậy khi đang bị NGÃ
    if (minh.trang_thai === "NGA") {
        if (roomData.trang_thai_den === 'DO') {
            dbUpdate(dbRef(db, `rooms/${currentRoomId}/players/${myId}`), { trang_thai: "CHET" });
            return;
        }
        day_bo_dem++;
        shakeTimer = 8; 
        if (day_bo_dem >= 4) {
            day_bo_dem = 0;
            dbUpdate(dbRef(db, `rooms/${currentRoomId}/players/${myId}`), { trang_thai: "SONG" });
        }
        return;
    }

    if (minh.trang_thai !== "SONG") return;

    if (roomData.trang_thai_den === 'DO') {
        dbUpdate(dbRef(db, `rooms/${currentRoomId}/players/${myId}`), { trang_thai: "CHET" });
        return;
    }

    // Khoảng cách di chuyển ngắn hơn (15px)
    let x_moi = minh.x + 15;
    
    // Mỗi bước di chuyển tiến lên sẽ giảm hồi chiêu đi 1/3 giây
    if (skillCooldown > 0) {
        skillCooldown = Math.max(0, skillCooldown - 333.33);
    }

    if (x_moi >= vach_dich_x) {
        let so_nguoi_da_thang = Object.values(playersList).filter(p => p.trang_thai === "THANG").length;
        let diem_tinh = 100 - (so_nguoi_da_thang * 10);
        if (diem_tinh < 0) diem_tinh = 0;

        dbUpdate(dbRef(db, `rooms/${currentRoomId}/players/${myId}`), { 
            x: x_moi, 
            trang_thai: "THANG",
            diem: diem_tinh
        });
    } else {
        dbUpdate(dbRef(db, `rooms/${currentRoomId}/players/${myId}`), { x: x_moi });
    }
});

function vong_loop_game_wrapper(thoi_gian_hien_tai) {
    vong_lap_game(thoi_gian_hien_tai);
}

function vong_lap_game(thoi_gian_hien_tai) {
    if (!currentRoomId) return;

    let delta_time = thoi_gian_hien_tai - thoi_gian_truoc_do;
    thoi_gian_truoc_do = thoi_gian_hien_tai;

    if (roomData.bat_dau && !roomData.game_ket_thuc) {
        // Quản lý đếm ngược cooldown kỹ năng
        if (skillCooldown > 0) {
            skillCooldown = Math.max(0, skillCooldown - delta_time);
            let ti_le_ro = 1 - (skillCooldown / MAX_COOLDOWN);
            const btnSkill = document.getElementById('nut_skill_pixel');
            if (btnSkill) btnSkill.style.opacity = Math.max(0.2, ti_le_ro);
        } else {
            const btnSkill = document.getElementById('nut_skill_pixel');
            if (btnSkill) btnSkill.style.opacity = 1.0;
        }

        // Đang mở kỹ năng mà búp bê quay đầu (Đèn Đỏ) -> Chết ngay
        if (skillWindowOpen && roomData.trang_thai_den === 'DO') {
            dong_cua_so_skill();
            dbUpdate(dbRef(db, `rooms/${currentRoomId}/players/${myId}`), { trang_thai: "CHET" });
        }

        if (skillWindowOpen) {
            xu_ly_vat_ly_va_ve_skill();
        }
    }

    if (isHost && roomData.bat_dau && !roomData.game_ket_thuc) {
        localBoDemDen += delta_time;
        localBoDemGiay += delta_time;
        let thong_tin_cap_nhat = {};

        if (roomData.trang_thai_den === 'XANH') {
            if (am_thanh_den_xanh.ended || localBoDemDen >= localThoiGianDoiDen) {
                thong_tin_cap_nhat.trang_thai_den = 'DO';
                localBoDemDen = 0;
                localThoiGianDoiDen = Math.random() * 2000 + 1500;
            }
        } else {
            if (localBoDemDen >= localThoiGianDoiDen) {
                thong_tin_cap_nhat.trang_thai_den = 'XANH';
                localBoDemDen = 0;
                
                let toc_do_ngau_nhien = Math.random() * 3.0 + 1.0;
                thong_tin_cap_nhat.toc_do_nhac = toc_do_ngau_nhien;
                
                let do_dai_goc = am_thanh_den_xanh.duration || 3.0;
                localThoiGianDoiDen = (do_dai_goc / toc_do_ngau_nhien) * 1000 + 200;
            }
        }

        if (localBoDemGiay >= 1000) {
            localBoDemGiay = 0;
            let thoi_gian_moi = (roomData.thoi_gian_con_lai || 90) - 1;
            if (thoi_gian_moi <= 0) {
                thoi_gian_moi = 0; thong_tin_cap_nhat.game_ket_thuc = true;
            }
            thong_tin_cap_nhat.thoi_gian_con_lai = thoi_gian_moi;
        }

        let mang_players = Object.values(playersList);
        if (mang_players.length > 0) {
            let so_nguoi_song = mang_players.filter(p => p.trang_thai === "SONG" || p.trang_thai === "NGA").length;
            if (so_nguoi_song === 0) thong_tin_cap_nhat.game_ket_thuc = true;
        }

        if (Object.keys(thong_tin_cap_nhat).length > 0) {
            dbUpdate(dbRef(db, 'rooms/' + currentRoomId), thong_tin_cap_nhat);
        }
    }

    if (roomData.game_ket_thuc && !localEndTimerStarted) {
        localEndTimerStarted = true;
        am_thanh_den_xanh.pause();
        
        let anyoneWon = Object.values(playersList).some(p => p.trang_thai === "THANG");
        
        if (anyoneWon) {
            if (isHost) {
                dbUpdate(dbRef(db, 'rooms/' + currentRoomId), { man_choi_hien_tai: 2 });
            }
            setTimeout(() => {
                window.location.href = '../glass_step/index.html?phong=' + currentRoomId;
            }, 3000);
        } else {
            let roomToClean = currentRoomId;
            setTimeout(() => {
                if (isHost && roomToClean) {
                    dbRemove(dbRef(db, 'rooms/' + roomToClean)).then(() => {
                        roi_phong_ve_sanh();
                    });
                } else {
                    roi_phong_ve_sanh();
                }
            }, 6000);
        }
    }

    if (roomData.bat_dau && scrGame.style.display === "block") {
        ve_giao_dien_multiplayer();
    }
    requestAnimationFrame(vong_loop_game_wrapper);
}

function ve_giao_dien_multiplayer() {
    if (!currentRoomId || !roomData.bat_dau) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let den_hien_tai = roomData.trang_thai_den || 'XANH';

    if (anh_nen.complete) ctx.drawImage(anh_nen, 0, 0, canvas.width, canvas.height);

    if (anh_bup_be.complete) {
        ctx.save();
        if (den_hien_tai === 'DO' && !roomData.game_ket_thuc) {
            ctx.translate(bup_be.x + bup_be.width, bup_be.y); ctx.scale(-1, 1);
            ctx.drawImage(anh_bup_be, 0, 0, bup_be.width, bup_be.height);
        } else {
            ctx.drawImage(anh_bup_be, bup_be.x, bup_be.y, bup_be.width, bup_be.height);
        }
        ctx.restore();
    }

    if (spritesheet_den.complete) {
        let do_rong_1_frame = spritesheet_den.width / 2;
        let vi_tri_cat_x = (den_hien_tai === 'XANH') ? 0 : do_rong_1_frame;
        ctx.drawImage(spritesheet_den, vi_tri_cat_x, 0, do_rong_1_frame, spritesheet_den.height, canvas.width / 2 - 40, -5, 80, 80);
    }

    Object.values(playersList).forEach((nguoi) => {
        ctx.save();
        let do_rong = nguoi.width || 65;
        let do_cao = nguoi.height || 65;

        if (nguoi.trang_thai === "NGA") {
            let frame_idx = 2; 
            if (nguoi.thoi_gian_bat_dau_nga) {
                let thoi_gian_troi_qua = performance.now() - nguoi.thoi_gian_bat_dau_nga;
                if (thoi_gian_troi_qua < 130) frame_idx = 0;
                else if (thoi_gian_troi_qua < 260) frame_idx = 1;
                else frame_idx = 2;
            }

            let x_lac = 0;
            if (nguoi.id === myId && day_bo_dem > 0 && shakeTimer > 0) {
                x_lac = (Math.random() - 0.5) * 6; 
                shakeTimer--;
            }

            if (anh_nga.complete) {
                let fw = anh_nga.width / 3;
                let fh = anh_nga.height;
                ctx.drawImage(anh_nga, frame_idx * fw, 0, fw, fh, nguoi.x + x_lac, nguoi.y, do_rong, do_cao);
            } else {
                ctx.fillStyle = '#ff5500'; ctx.fillRect(nguoi.x, nguoi.y, do_rong, do_cao);
            }

            ctx.font = '20px PixelKVN, Arial';
            ctx.fillStyle = (nguoi.id === myId) ? '#00ff00' : '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(nguoi.ten, nguoi.x + do_rong / 2 + x_lac, nguoi.y - 10);

        } else if (nguoi.trang_thai === "CHET") {
            if (nguoi.goc_xoay_tu_vong < 1.57) nguoi.goc_xoay_tu_vong += 0.1;
            if (nguoi.do_mo > 0.3) nguoi.do_mo -= 0.01;

            ctx.translate(nguoi.x + do_rong / 2, nguoi.y + do_cao); ctx.rotate(nguoi.goc_xoay_tu_vong);
            ctx.globalAlpha = nguoi.do_mo;
            ctx.drawImage(anh_nguoi_choi, -do_rong / 2, -do_cao, do_rong, do_cao);
            
            if (Math.floor(performance.now() / 100) % 2 === 0) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)'; ctx.fillRect(-do_rong / 2, -do_cao, do_rong, do_cao);
            }
        } else {
            if (nguoi.trang_thai === "THANG") ctx.globalAlpha = 0.5;
            ctx.drawImage(anh_nguoi_choi, nguoi.x, nguoi.y, do_rong, do_cao);

            ctx.font = '20px PixelKVN, Arial';
            ctx.fillStyle = (nguoi.id === myId) ? '#00ff00' : '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(nguoi.ten, nguoi.x + do_rong / 2, nguoi.y - 10);

            if (nguoi.trang_thai === "THANG" && nguoi.diem !== undefined) {
                ctx.font = 'bold 22px PixelKVN, Arial';
                ctx.fillStyle = '#ffd700';
                ctx.fillText(`+${nguoi.diem} ĐIỂM`, nguoi.x + do_rong / 2, nguoi.y - 35);
            }
        }
        ctx.restore();
    });

    ctx.font = '24px PixelKVN, sans-serif';
    ctx.fillStyle = '#ff007f';
    ctx.textAlign = 'left';
    let secs = roomData.thoi_gian_con_lai !== undefined ? roomData.thoi_gian_con_lai : 90;
    ctx.fillText(`TIME: ${secs.toString().padStart(2, '0')}`, 30, 45);

    if (roomData.game_ket_thuc) {
        ctx.font = '64px PixelKVN, sans-serif';
        ctx.textAlign = 'center';
        let minh = playersList[myId];
        if (minh && minh.trang_thai === "THANG") {
            ctx.fillStyle = '#00ff00'; ctx.fillText("BẠN ĐÃ THẮNG!", canvas.width / 2, canvas.height / 2);
        } else {
            ctx.fillStyle = 'red'; ctx.fillText("BẠN ĐÃ THUA!", canvas.width / 2, canvas.height / 2);
        }
    }
}

// Hàm khởi tạo cấu trúc DOM và Canvas phục vụ giao diện Cửa sổ Kỹ năng ném đá
function khoi_tao_giao_dien_skill_dom() {
    const vungGame = document.getElementById('vung_chua_game');
    if (!vungGame || document.getElementById('nut_skill_container')) return;

    vungGame.style.position = 'relative';

    // Tạo vùng chứa nút Kỹ năng nằm NGAY GIỮA CẠNH DƯỚI màn hình game
    const container = document.createElement('div');
    container.id = 'nut_skill_container';
    container.style.cssText = `position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 99; display: none;`;

    const btn = document.createElement('button');
    btn.id = 'nut_skill_pixel';
    btn.style.cssText = `
        width: 65px; height: 65px; background: url('res/anh/cucda.png') no-repeat center;
        background-size: contain; border: none; outline: none; cursor: pointer; opacity: 0.2;
    `;
    container.appendChild(btn);
    vungGame.appendChild(container);

    // Tạo Cửa sổ Modal Skill với viền phong cách Pixel Art đặc trưng
    const modal = document.createElement('div');
    modal.id = 'cua_so_skill';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.7); display: none; justify-content: center; align-items: center; z-index: 10005;
    `;

    const khungVien = document.createElement('div');
    khungVien.style.cssText = `
        background: #252525; border: 5px solid #ff007f; border-radius: 8px;
        box-shadow: 0 0 25px rgba(255, 0, 127, 0.6); overflow: hidden; image-rendering: pixelated;
    `;

    cvSkill = document.createElement('canvas');
    cvSkill.id = 'canvas_skill';
    cvSkill.width = 600;
    cvSkill.height = 400;
    cvSkill.style.display = 'block';

    khungVien.appendChild(cvSkill);
    modal.appendChild(khungVien);
    document.body.appendChild(modal);

    ctxSkill = cvSkill.getContext('2d');

    // Gắn sự kiện kích hoạt mở cửa sổ
    btn.addEventListener('click', mo_cua_so_skill);

    // Click thẳng vào màn hình, trúng mục tiêu là phạt ngã lập tức
    cvSkill.addEventListener('click', (e) => {
        if (!skillWindowOpen) return;
        const rect = cvSkill.getBoundingClientRect();
        let mx = e.clientX - rect.left;
        let my = e.clientY - rect.top;

        // Quét xem điểm nhấp chuột có nằm trong bounding box của mục tiêu nào không
        for (let i = 0; i < targetList.length; i++) {
            let t = targetList[i];
            if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) {
                // Đập trúng: Gửi cập nhật trạng thái NGÃ của đối thủ lên Firebase gán bẫy
                dbUpdate(dbRef(db, `rooms/${currentRoomId}/players/${t.id}`), { trang_thai: "NGA" });
                break;
            }
        }

        // Sau khi click (dù trúng mục tiêu hay hụt), lập tức đóng cửa sổ kỹ năng và tính hồi chiêu
        skillCooldown = MAX_COOLDOWN;
        dong_cua_so_skill();
    });
}

function mo_cua_so_skill() {
    if (skillCooldown > 0 || roomData.trang_thai_den === 'DO') return;
    let minh = playersList[myId];
    if (!minh || minh.trang_thai !== "SONG") return;

    skillWindowOpen = true;
    document.getElementById('cua_so_skill').style.display = 'flex';

    // Quét và chèn bấy nhiêu mục tiêu dựa vào số người chơi hợp lệ còn lại trên sân chơi
    targetList = [];
    Object.values(playersList).forEach(p => {
        if (p.id !== myId && p.trang_thai === "SONG") {
            targetList.push({
                id: p.id,
                ten: p.ten,
                x: Math.random() * 460 + 70, 
                y: Math.random() * 160 + 50, 
                w: 45, h: 45
            });
        }
    });
}

function dong_cua_so_skill() {
    skillWindowOpen = false;
    const modal = document.getElementById('cua_so_skill');
    if (modal) modal.style.display = 'none';
}

// Hàm xử lý vẽ giao diện cửa sổ kỹ năng rút gọn
function xu_ly_vat_ly_va_ve_skill() {
    ctxSkill.clearRect(0, 0, cvSkill.width, cvSkill.height);

    if (anh_pha.complete) {
        ctxSkill.drawImage(anh_pha, 0, 0, cvSkill.width, cvSkill.height);
    }

    targetList.forEach(t => {
        if (anh_muctieu.complete) {
            ctxSkill.drawImage(anh_muctieu, t.x, t.y, t.w, t.h);
        }
        ctxSkill.font = '12px PixelKVN, sans-serif';
        ctxSkill.fillStyle = '#00ff00';
        ctxSkill.textAlign = 'center';
        ctxSkill.fillText(t.ten, t.x + t.w / 2, t.y + t.h + 14);
    });

    // Vẽ hình viên đá choi.png cố định ở cạnh dưới chính giữa làm trang trí
    if (anh_choi.complete) {
        ctxSkill.drawImage(anh_choi, 300 - 18, 360 - 18, 36, 36);
    }
}