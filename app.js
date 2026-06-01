let appData = JSON.parse(localStorage.getItem('naai_60_40_data')) || {
    dailyGovUsed: 0,
    monthlyGovUsed: 0,
    monthlyUserPaid: 0,
    historyLogs: []
};

let currentMode = 'normal';
let html5QrCode = null; // เก็บ Instance ของตัวสแกนเนอร์

function checkAndResetDailyLimit() {
    const now = new Date();
    let budgetDate = new Date(now);
    if (now.getHours() < 6) budgetDate.setDate(budgetDate.getDate() - 1);
    
    const budgetDateStr = budgetDate.toDateString();
    const lastSavedDate = localStorage.getItem('naai_60_40_date_tracker');

    if (lastSavedDate !== budgetDateStr) {
        appData.dailyGovUsed = 0; 
        localStorage.setItem('naai_60_40_date_tracker', budgetDateStr);
        saveData();
    }
}

function updateCountdown() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if (document.getElementById('current-date')) {
        document.getElementById('current-date').innerText = now.toLocaleDateString('th-TH', options);
    }

    let targetReset = new Date(now);
    targetReset.setHours(6, 0, 0, 0);
    if (now.getHours() >= 6) targetReset.setDate(targetReset.getDate() + 1);

    const diffMs = targetReset - now;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    if (document.getElementById('countdown-timer')) {
        document.getElementById('countdown-timer').innerText = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}

checkAndResetDailyLimit();
setInterval(updateCountdown, 1000);
updateCountdown();

function saveData() {
    localStorage.setItem('naai_60_40_data', JSON.stringify(appData));
    updateUI();
}

function setCalcMode(mode) {
    currentMode = mode;
    stopScanner(); // ปิดกล้องทันทีหากสลับโหมด
    
    if (document.getElementById('calc-result-wrapper')) document.getElementById('calc-result-wrapper').style.display = 'none';
    if (document.getElementById('price')) document.getElementById('price').value = '';
    if (document.getElementById('note')) document.getElementById('note').value = '';
    if (document.getElementById('rev-product-price')) document.getElementById('rev-product-price').value = '';
    
    if (document.getElementById('rt-user-deposit')) document.getElementById('rt-user-deposit').innerText = '0.00';
    if (document.getElementById('rt-gov-share')) document.getElementById('rt-gov-share').innerText = '0.00';
    if (document.getElementById('rt-warning-box')) document.getElementById('rt-warning-box').style.display = 'none';

    if (mode === 'normal') {
        document.getElementById('tab-normal').classList.add('active');
        document.getElementById('tab-reverse').classList.remove('active');
        document.getElementById('wrapper-normal-input').style.display = 'block';
        document.getElementById('wrapper-reverse-input').style.display = 'none';
    } else {
        document.getElementById('tab-normal').classList.remove('active');
        document.getElementById('tab-reverse').classList.add('active');
        document.getElementById('wrapper-normal-input').style.display = 'none';
        document.getElementById('wrapper-reverse-input').style.display = 'block';
    }
}

function switchPage(pageId) {
    stopScanner(); // ปรับหน้าย้ายไปหน้าอื่น ให้ดับกล้องเสมอเพื่อความปลอดภัย
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    if (document.getElementById(pageId)) document.getElementById(pageId).classList.add('active');
    if (pageId === 'calc-page') setCalcMode('normal');
    updateUI();
}

// 📸 🌟 ฟีเจอร์ที่ 2: ระบบเปิดกล้องสแกนบาร์โค้ดสินค้า
function startScanner() {
    const container = document.getElementById('scanner-container');
    container.style.display = 'block';

    // ล้าง Instance เก่าถ้าตกค้างอยู่
    if (html5QrCode) {
        html5QrCode.clear();
    }

    html5QrCode = new Html5Qrcode("interactive-reader");
    
    // ตั้งค่ากล้องหลังมือถือ (environment) และขนาดกล่องตรวจจับสแกน
    const config = { 
        fps: 15, 
        qrbox: { width: 260, height: 130 }, // สัดส่วนสี่เหลี่ยมผืนผ้าสำหรับตรวจจับบาร์โค้ดแนวนอน
        aspectRatio: 1.777778
    };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
            // เมื่อสแกนเจอข้อความ/บาร์โค้ดสำเร็จ! 🎉
            stopScanner(); // ดับกล้องทันที
            
            // ใช้ regex ดึงราคาสินค้า (กรณีคิวอาร์บาร์โค้ดป้ายราคามีจำนวนเงินติดมา) 
            // หรือถ้าบาร์โค้ดมีแต่รหัสเฉยๆ จะนำเลขท้ายของบาร์โค้ดมาลองแปลงเพื่อเป็นราคาตั้งต้นให้
            let targetPrice = parseFloat(decodedText);
            
            if (isNaN(targetPrice) || targetPrice <= 0) {
                // หากรหัสยาวเกินไปดึงราคาไม่ได้ ให้แจ้งเตือนเผื่อกรอกมือ
                alert(`🔍 ตรวจพบรหัสบาร์โค้ด: ${decodedText}\nแต่วิเคราะห์ราคาไม่พบ กรุณากรอกตัวเลขราคาเต็มด้วยตัวเองครับผมคราบ`);
                document.getElementById('price').focus();
            } else {
                // ถอดรหัสเป็นตัวเลขราคาสินค้าได้สำเร็จ เด้งใส่กล่องราคาให้ทันที!
                document.getElementById('price').value = targetPrice.toFixed(2);
                alert(`✨ สแกนสำเร็จ! ดึงราคาเต็มสินค้า: ${targetPrice.toFixed(2)} บาท`);
            }
        },
        (errorMessage) => {
            // ปล่อยข้ามในลูปสแกนขณะที่กำลังค้นหาจุดโฟกัสบาร์โค้ด
        }
    ).catch(err => {
        alert("ไม่สามารถเปิดกล้องได้: กรุณาอนุญาตสิทธิ์การเข้าถึงกล้องถ่ายรูปในเครื่องก่อนคราบผม");
        container.style.display = 'none';
    });
}

// 🚫 ปิดระบบกล้องสแกนเนอร์
function stopScanner() {
    const container = document.getElementById('scanner-container');
    if (container) container.style.display = 'none';
    
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null;
        }).catch(err => {
            html5QrCode = null;
        });
    }
}

// ⚡ บันทึกและคำนวณบิลโหมดปกติ
function processCalculation() {
    let remainingDailyGov = 200 - appData.dailyGovUsed;
    let remainingMonthlyGov = 1000 - appData.monthlyGovUsed;
    let availableGovAllowance = Math.max(0, Math.min(remainingDailyGov, remainingMonthlyGov));

    if (availableGovAllowance <= 0) {
        alert('คุณใช้สิทธิ์ของวันนี้หมดแล้วครับ! ไม่สามารถบันทึกยอดเพิ่มได้');
        return;
    }

    const inputPrice = document.getElementById('price');
    const inputNote = document.getElementById('note');
    const price = inputPrice ? parseFloat(inputPrice.value) || 0 : 0;
    const noteVal = inputNote ? inputNote.value.trim() : '';

    if (price <= 0) { 
        alert('กรุณากรอกหรือสแกนราคาสินค้าก่อนครับผม'); 
        return; 
    }
    
    let rawGovShare = price * 0.60;

    if (rawGovShare > availableGovAllowance) {
        alert(`❌ ไม่สามารถบันทึกได้!\nเนื่องจากบิลนี้ต้องใช้สิทธิ์รัฐจำนวน ${rawGovShare.toFixed(2)} บาท\nแต่สิทธิ์รวมคงเหลือของคุณใช้ได้อีกเพียง ${availableGovAllowance.toFixed(2)} บาทเท่านั้นคราบผม`);
        return; 
    }

    let actualGovShare = rawGovShare;
    let actualUserShare = price * 0.40;

    appData.dailyGovUsed += actualGovShare;
    appData.monthlyGovUsed += actualGovShare;
    appData.monthlyUserPaid += actualUserShare;

    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    
    const logItem = {
        id: Date.now(),
        date: dateStr,
        time: timeStr,
        totalPrice: price.toFixed(2),
        govPaid: actualGovShare.toFixed(2),
        userPaid: actualUserShare.toFixed(2),
        note: noteVal
    };

    if (!appData.historyLogs) appData.historyLogs = [];
    appData.historyLogs.unshift(logItem);

    if (document.getElementById('res-gov')) document.getElementById('res-gov').innerText = actualGovShare.toFixed(2);
    if (document.getElementById('res-user')) document.getElementById('res-user').innerText = actualUserShare.toFixed(2);
    if (document.getElementById('calc-result-wrapper')) document.getElementById('calc-result-wrapper').style.display = 'block';

    if (inputPrice) inputPrice.value = '';
    if (inputNote) inputNote.value = '';

    saveData();
}

function deleteLogItem(id) {
    if (!confirm('ต้องการลบประวัติรายการนี้ใช่ไหมครับ? (ยอดเงินจะถูกหักคืนให้ทันที)')) return;
    if (!appData.historyLogs) return;
    
    const itemIndex = appData.historyLogs.findIndex(log => log.id === id);
    if (itemIndex > -1) {
        const item = appData.historyLogs[itemIndex];
        const govPaid = parseFloat(item.govPaid) || 0;
        const userPaid = parseFloat(item.userPaid) || 0;

        appData.dailyGovUsed = Math.max(0, appData.dailyGovUsed - govPaid);
        appData.monthlyGovUsed = Math.max(0, appData.monthlyGovUsed - govPaid);
        appData.monthlyUserPaid = Math.max(0, appData.monthlyUserPaid - userPaid);

        appData.historyLogs.splice(itemIndex, 1);
        saveData();
    }
}

function processReverseCalculation() {
    const inputRev = document.getElementById('rev-product-price');
    const productPrice = inputRev ? parseFloat(inputRev.value) || 0 : 0;
    
    const rtUser = document.getElementById('rt-user-deposit');
    const rtGov = document.getElementById('rt-gov-share');
    const warningBox = document.getElementById('rt-warning-box');
    const warnGovLeft = document.getElementById('warn-gov-left');

    if (productPrice <= 0) {
        if (rtUser) rtUser.innerText = '0.00';
        if (rtGov) rtGov.innerText = '0.00';
        if (warningBox) warningBox.style.display = 'none';
        return;
    }

    let remainingDailyGov = 200 - appData.dailyGovUsed;
    let remainingMonthlyGov = 1000 - appData.monthlyGovUsed;
    let availableGovAllowance = Math.max(0, Math.min(remainingDailyGov, remainingMonthlyGov));

    let rawGovShare = productPrice * 0.60;
    let usedGovShare = 0;
    let totalUserMustPayCash = 0;

    if (rawGovShare <= availableGovAllowance) {
        usedGovShare = rawGovShare;
        totalUserMustPayCash = productPrice * 0.40;
        if (warningBox) warningBox.style.display = 'none';
    } else {
        usedGovShare = availableGovAllowance;
        totalUserMustPayCash = productPrice - usedGovShare;
        if (warnGovLeft) warnGovLeft.innerText = availableGovAllowance.toFixed(2);
        if (warningBox) warningBox.style.display = 'block';
    }

    if (rtUser) rtUser.innerText = totalUserMustPayCash.toFixed(2);
    if (rtGov) rtGov.innerText = usedGovShare.toFixed(2);
}

function updateUI() {
    const globalDailyLeftEl = document.getElementById('global-daily-left');
    let currentDailyLeft = Math.max(0, 200 - appData.dailyGovUsed);
    let currentMonthlyLeft = Math.max(0, 1000 - appData.monthlyGovUsed);
    let actualDailyAllowanceLeft = Math.min(currentDailyLeft, currentMonthlyLeft); 
    
    if (globalDailyLeftEl) globalDailyLeftEl.innerText = actualDailyAllowanceLeft.toFixed(2);

    if (document.getElementById('daily-used')) {
        document.getElementById('daily-used').innerHTML = `${appData.dailyGovUsed.toFixed(2)} <span class="max-val">/ 200 บาท</span>`;
    }
    if (document.getElementById('daily-progress')) {
        document.getElementById('daily-progress').style.width = `${Math.min((appData.dailyGovUsed / 200) * 100, 100)}%`;
    }
    if (document.getElementById('daily-allowance')) {
        document.getElementById('daily-allowance').innerHTML = `${(actualDailyAllowanceLeft / 0.60).toFixed(2)} <span>บาท</span>`;
    }

    if (document.getElementById('monthly-gov-used')) document.getElementById('monthly-gov-used').innerText = appData.monthlyGovUsed.toFixed(2);
    if (document.getElementById('monthly-gov-remain')) document.getElementById('monthly-gov-remain').innerText = (1000 - appData.monthlyGovUsed).toFixed(2);
    if (document.getElementById('monthly-user-total')) {
        document.getElementById('monthly-user-total').innerHTML = `${appData.monthlyUserPaid.toFixed(2)} <span class="max-val">บาท</span>`;
    }

    const historyListEl = document.getElementById('history-list');
    if (historyListEl) {
        if (!appData.historyLogs || appData.historyLogs.length === 0) {
            historyListEl.innerHTML = '<div class="no-history">ยังไม่มีประวัติการบันทึกคราบผม</div>';
        } else {
            const groups = {};
            appData.historyLogs.forEach(log => {
                const dateKey = log.date || "ไม่ระบุวันที่";
                if (!groups[dateKey]) groups[dateKey] = [];
                groups[dateKey].push(log);
            });

            let finalHtml = '';
            for (const date in groups) {
                finalHtml += `<div class="history-day-group"><div class="history-day-title">📅 ${date}</div>`;
                groups[date].forEach(log => {
                    const noteBadgeHtml = log.note ? `<span class="history-note-badge">${log.note}</span>` : '';
                    finalHtml += `
                        <div class="history-item">
                            <div class="history-item-left">
                                <div class="history-time-row"><span>🕒 ${log.time} น.</span>${noteBadgeHtml}</div>
                                <div class="history-details">ซื้อ <span>${log.totalPrice} บ.</span> (รัฐ <span class="green">${log.govPaid}</span> / เรา <span class="blue">${log.userPaid}</span>)</div>
                            </div>
                            <button class="history-delete-btn" onclick="deleteLogItem(${log.id})">🗑️</button>
                        </div>`;
                });
                finalHtml += `</div>`;
            }
            historyListEl.innerHTML = finalHtml;
        }
    }
}

function clearData() {
    if (confirm('คุณต้องการรีเซ็ตประวัติเงินทั้งหมดจริงไหมครับ?')) {
        appData = { dailyGovUsed: 0, monthlyGovUsed: 0, monthlyUserPaid: 0, historyLogs: [] };
        localStorage.removeItem('naai_60_40_date_tracker');
        saveData();
        switchPage('main-menu');
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    let newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('naai_60_40_theme', newTheme);
    if (document.getElementById('theme-icon')) document.getElementById('theme-icon').innerText = newTheme === 'dark' ? '☀️' : '🌙';
}

const savedTheme = localStorage.getItem('naai_60_40_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('theme-icon')) document.getElementById('theme-icon').innerText = savedTheme === 'dark' ? '☀️' : '🌙';
});

let calcExpression = '';
function toggleMiniCalculator() {
    const modal = document.getElementById('mini-calculator-modal');
    if (modal) {
        modal.classList.toggle('active');
        if(!modal.classList.contains('active')) {
            calcExpression = '';
            if (document.getElementById('calc-display')) document.getElementById('calc-display').value = '0';
        }
    }
}

function pressCalcKey(key) {
    const display = document.getElementById('calc-display');
    if (!display) return;

    if (key === 'C') {
        calcExpression = '';
        display.value = '0';
    } else if (key === '=') {
        try {
            if(calcExpression !== '') {
                let result = eval(calcExpression);
                display.value = Number(result.toFixed(2));
                calcExpression = String(result);
            }
        } catch (e) {
            display.value = 'Error';
            calcExpression = '';
        }
    } else {
        if(calcExpression === '' && ['+','-','*','/'].includes(key)) return;
        calcExpression += key;
        display.value = calcExpression.replace(/\*/g, '×').replace(/\//g, '÷');
    }
}

updateUI();
