import type { TenantData } from '../types/system';

export function generateGoogleAppsScriptCode(orgId: string): string {
  return `/**
 * Google Apps Script Backend for TimeWindow SaaS (Multi-Tenant)
 * 1. Create a Google Sheet and open Extensions -> Apps Script
 * 2. Paste this code into Code.gs
 * 3. Create an HTML file named "index" and paste the exported Single-File HTML
 * 4. Deploy -> New deployment -> Web app -> Execute as: Me -> Who has access: Anyone
 */

const SHEET_STATE = 'TenantState';
const SHEET_LOGS = 'AuditLogs';
const SHEET_DROPS = 'FileDrops';
const SHEET_PROFILES = 'ProfileCards';

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('TimeWindow SaaS — ${orgId}')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateDriveFolder(orgId) {
  const folderName = 'TimeWindow_' + (orgId || 'ORG') + '_Files';
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function saveDataUrlToDrive(folder, fileName, fallbackMime, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return '';
  const mime = match[1] || fallbackMime || 'application/octet-stream';
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, mime, fileName || ('upload_' + Date.now()));
  const created = folder.createFile(blob);
  return created.getUrl();
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const orgId = data.orgId || '${orgId}';
    const action = data.action || '';

    if (action === 'ping') {
      getOrCreateSheet(SHEET_DROPS, ['OrgId', 'CreatedAt', 'Location', 'Topic', 'Sender', 'Message', 'FileNames', 'DriveLinks']);
      getOrCreateSheet(SHEET_PROFILES, ['OrgId', 'CreatedAt', 'Kind', 'FullName', 'RoleOrGroup', 'Contact', 'Email', 'Summary', 'Education', 'Experience', 'Skills', 'Availability', 'EmergencyContact', 'PhotoDriveUrl']);
      return jsonOut({ ok: true, message: 'Connected to Google Sheets & Drive' });
    }

    if (action === 'file_drop' && data.submission) {
      const sub = data.submission;
      const folder = getOrCreateDriveFolder(orgId);
      const driveUrls = {};
      const linkList = [];
      const nameList = [];
      const files = Array.isArray(sub.files) ? sub.files : [];

      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        nameList.push(f.name || ('file_' + i));
        if (f.dataUrl) {
          var url = saveDataUrlToDrive(folder, f.name, f.mimeType, f.dataUrl);
          if (url) {
            driveUrls[f.id || f.name] = url;
            linkList.push(url);
          }
        }
      }

      const sheet = getOrCreateSheet(SHEET_DROPS, [
        'OrgId', 'CreatedAt', 'Location', 'Topic', 'Sender', 'Message', 'FileNames', 'DriveLinks'
      ]);
      sheet.appendRow([
        orgId,
        sub.createdAt || new Date().toISOString(),
        sub.locationTitle || '',
        sub.topic || '',
        sub.senderName || '',
        sub.message || '',
        nameList.join(', '),
        linkList.join(' | ')
      ]);

      return jsonOut({ ok: true, driveUrls: driveUrls });
    }

    if (action === 'profile_drop' && data.profile) {
      const p = data.profile;
      var photoUrl = '';
      if (p.photoDataUrl) {
        var folderProfile = getOrCreateDriveFolder(orgId);
        var photoName = 'Profile_' + (p.fullName || 'Applicant').replace(/\\s+/g, '_') + '_' + Date.now() + '.jpg';
        photoUrl = saveDataUrlToDrive(folderProfile, photoName, 'image/jpeg', p.photoDataUrl);
      }

      const pSheet = getOrCreateSheet(SHEET_PROFILES, [
        'OrgId', 'CreatedAt', 'Kind', 'FullName', 'RoleOrGroup', 'Contact', 'Email',
        'Summary', 'Education', 'Experience', 'Skills', 'Availability', 'EmergencyContact', 'PhotoDriveUrl'
      ]);
      pSheet.appendRow([
        orgId,
        p.createdAt || new Date().toISOString(),
        p.kind || 'job_apply',
        p.fullName || '',
        p.targetRoleOrGroup || '',
        p.phoneOrContact || '',
        p.email || '',
        p.headlineOrSummary || '',
        p.educationOrAffiliation || '',
        p.experienceOrNote || '',
        Array.isArray(p.skills) ? p.skills.join(', ') : '',
        p.availability || '',
        p.emergencyContact || '',
        photoUrl
      ]);

      return jsonOut({ ok: true, driveUrl: photoUrl });
    }

    if ((action === 'checkin_photo' || action === 'audit_log') && data.logEntry) {
      var driveLink = '';
      if (data.photoDataUrl) {
        var folderCheckin = getOrCreateDriveFolder(orgId);
        var stampName = (data.logEntry.dateKey || 'checkin') + '_' + (data.logEntry.memberName || 'checkpoint') + '.jpg';
        driveLink = saveDataUrlToDrive(folderCheckin, stampName, 'image/jpeg', data.photoDataUrl);
      }
      var entry = Object.assign({}, data.logEntry);
      if (driveLink) {
        entry.note = (entry.note || '') + ' | Drive: ' + driveLink;
      }
      appendAuditLog(orgId, entry);
      return jsonOut({ ok: true, driveUrl: driveLink });
    }

    return jsonOut({ ok: false, message: 'Unknown action' });
  } catch (err) {
    return jsonOut({ ok: false, message: String(err) });
  }
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
    }
  }
  return sheet;
}

function loadTenantState(orgId) {
  const sheet = getOrCreateSheet(SHEET_STATE, ['OrgId', 'UpdatedAt', 'PayloadJSON']);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(orgId)) {
      return JSON.parse(rows[i][2]);
    }
  }
  return null;
}

function saveTenantState(orgId, payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getOrCreateSheet(SHEET_STATE, ['OrgId', 'UpdatedAt', 'PayloadJSON']);
    const rows = sheet.getDataRange().getValues();
    const json = JSON.stringify(payload);
    const now = new Date().toISOString();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(orgId)) {
        sheet.getRange(i + 1, 2, 1, 2).setValues([[now, json]]);
        return { ok: true, updatedAt: now };
      }
    }
    sheet.appendRow([orgId, now, json]);
    return { ok: true, updatedAt: now };
  } finally {
    lock.releaseLock();
  }
}

function appendAuditLog(orgId, logEntry) {
  const sheet = getOrCreateSheet(SHEET_LOGS, [
    'OrgId', 'DateKey', 'Timestamp', 'Type', 'Task', 'Member', 'Status', 'Method', 'Actor', 'Note'
  ]);
  sheet.appendRow([
    orgId,
    logEntry.dateKey || '',
    logEntry.timestamp || '',
    logEntry.type || '',
    logEntry.taskTitle || '',
    logEntry.memberName || '',
    logEntry.status || '',
    logEntry.unlockMethod || '',
    logEntry.actorName || '',
    logEntry.note || ''
  ]);
  return { ok: true };
}
`;
}

export function generateSingleFileHtmlBundle(tenant: TenantData): string {
  const safeDataJson = JSON.stringify(tenant).replace(/<\/script>/gi, '<\\/script>');
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${tenant.orgNameTh} — TimeWindow SaaS (Single-File GAS Edition)</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #ffffff; --fg: #111111; --muted: #6b7280; --border: #e5e7eb; --subtle: #f9fafb;
      --accent: #111111; --accent-fg: #ffffff; --radius: 10px;
    }
    [data-theme="dark"] {
      --bg: #0d0d0d; --fg: #ffffff; --muted: #a1a1aa; --border: #27272a; --subtle: #18181b;
      --accent: #ffffff; --accent-fg: #0d0d0d;
    }
    [data-theme="pastel"] {
      --bg: #faf8f5; --fg: #253330; --muted: #70827e; --border: #e6dfd5; --subtle: #f3efe9;
      --accent: #5fa898; --accent-fg: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: 'Noto Sans Thai', 'Inter', sans-serif;
      background: var(--bg); color: var(--fg); line-height: 1.5;
    }
    .container { max-width: 1120px; margin: 0 auto; padding: 20px; }
    .topbar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px; border-bottom: 1px solid var(--border);
    }
    .grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; margin-top: 24px; }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
    .card { border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; background: var(--bg); }
    .task-row {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 10px;
    }
    .task-row.active { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); cursor: pointer; }
    .task-row.locked { opacity: 0.55; background: var(--subtle); }
    button {
      font-family: inherit; cursor: pointer; padding: 8px 14px;
      border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--fg);
    }
    button.primary { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
    button:disabled { opacity: 0.35; cursor: not-allowed; }
    input {
      width: 100%; padding: 9px 12px; border: 1px solid var(--border);
      border-radius: 8px; background: var(--bg); color: var(--fg); font-family: inherit;
    }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: none; align-items: center; justify-content: center; padding: 16px; z-index: 50;
    }
    .modal-backdrop.open { display: flex; }
    .modal {
      width: 100%; max-width: 680px; max-height: 85vh; overflow: auto;
      background: var(--bg); color: var(--fg); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 24px;
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div><strong>${tenant.orgId} · ${tenant.orgNameTh}</strong></div>
    <div style="display:flex; gap:8px; align-items:center;">
      <span id="clock" style="font-variant-numeric:tabular-nums;"></span>
      <select id="themeSel" onchange="document.documentElement.setAttribute('data-theme', this.value)">
        <option value="light">ขาว-ดำ</option>
        <option value="pastel">ครีม-มินต์</option>
      </select>
    </div>
  </header>
  <main class="container">
    <div class="grid">
      <section class="card">
        <h2 style="margin-top:0;">คำสั่งควบคุมตามช่วงเวลา (Time-Window Tasks)</h2>
        <div id="taskList"></div>
      </section>
      <aside class="card">
        <h3 style="margin-top:0;">เข้าสู่ระบบหลังบ้าน</h3>
        <input id="pinInput" type="password" placeholder="กรอกรหัส PIN พี่เลี้ยง/ผู้บริหาร" style="margin-bottom:10px;" />
        <button class="primary" style="width:100%;" onclick="staffLogin()">เข้าสู่ระบบ</button>
        <p id="loginMsg" style="font-size:12px; color:var(--muted); margin-top:10px;">เชื่อมต่อ Google Apps Script & LocalStorage</p>
      </aside>
    </div>
  </main>

  <div id="rosterModal" class="modal-backdrop">
    <div class="modal">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 id="modalTitle" style="margin:0;">เช็คชื่อ</h3>
        <button onclick="closeModal()">ปิด</button>
      </div>
      <div id="modalBody"></div>
    </div>
  </div>

  <script>
    const STORAGE_KEY = 'tw_gas_state_${tenant.orgId}';
    let STATE = ${safeDataJson};
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) STATE = JSON.parse(saved);
    } catch (e) {}

    function persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
      if (window.google && google.script && google.script.run) {
        google.script.run.saveTenantState(STATE.orgId, STATE);
      }
    }

    function toMins(hhmm) {
      const p = String(hhmm || '').split(':');
      return Number(p[0]) * 60 + Number(p[1]);
    }

    function isWindowActive(t, now) {
      if (!t.enabled || t.approvalStatus !== 'approved') return false;
      const m = now.getHours() * 60 + now.getMinutes();
      const s = toMins(t.startTime), e = toMins(t.endTime);
      return s <= e ? (m >= s && m <= e) : (m >= s || m <= e);
    }

    function render() {
      const now = new Date();
      document.getElementById('clock').textContent = now.toTimeString().slice(0, 5);
      const list = document.getElementById('taskList');
      list.innerHTML = '';
      STATE.tasks.forEach(t => {
        const active = isWindowActive(t, now);
        const row = document.createElement('div');
        row.className = 'task-row ' + (active ? 'active' : 'locked');
        row.innerHTML = '<div><strong>' + t.titleTh + '</strong><div style="font-size:12px; opacity:0.85;">' + t.startTime + '–' + t.endTime + '</div></div>' +
          '<div>' + (active ? '<button onclick="openTask(\\'' + t.id + '\\')">เปิดเช็คชื่อ</button>' : '<span>ล็อค / นอกเวลา</span>') + '</div>';
        list.appendChild(row);
      });
    }

    function openTask(taskId) {
      const task = STATE.tasks.find(t => t.id === taskId);
      if (!task) return;
      const code = prompt('กรอกรหัส PIN พนักงาน หรือรหัสฉุกเฉิน 8888:');
      const staff = STATE.staff.find(s => s.pin === code);
      if (!staff && code !== STATE.emergencyCode) {
        alert('รหัสไม่ถูกต้อง');
        return;
      }
      document.getElementById('modalTitle').textContent = task.titleTh + ' (' + (code === STATE.emergencyCode ? 'ปลดล็อค 8888' : staff.name) + ')';
      const body = document.getElementById('modalBody');
      const now = new Date();
      const curM = now.getHours() * 60 + now.getMinutes();
      body.innerHTML = STATE.members.map(m => {
        const pAllowed = !task.buttonCutoffs.present || curM <= toMins(task.buttonCutoffs.present);
        const lAllowed = !task.buttonCutoffs.late || curM <= toMins(task.buttonCutoffs.late);
        return '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">' +
          '<span>' + m.name + ' (' + m.group + ')</span>' +
          '<div style="display:flex; gap:6px;">' +
            '<button ' + (pAllowed ? '' : 'disabled') + ' onclick="mark(\\'' + task.id + '\\',\\'' + m.id + '\\',\\'present\\')">มา</button>' +
            '<button ' + (lAllowed ? '' : 'disabled') + ' onclick="mark(\\'' + task.id + '\\',\\'' + m.id + '\\',\\'late\\')">สาย</button>' +
            '<button onclick="mark(\\'' + task.id + '\\',\\'' + m.id + '\\',\\'leave\\')">ลา</button>' +
            '<button onclick="mark(\\'' + task.id + '\\',\\'' + m.id + '\\',\\'absent\\')">ขาด</button>' +
          '</div></div>';
      }).join('');
      document.getElementById('rosterModal').classList.add('open');
    }

    function mark(taskId, memberId, status) {
      STATE.logs.unshift({
        id: 'log-' + Date.now(),
        dateKey: new Date().toISOString().slice(0, 10),
        timestamp: new Date().toTimeString().slice(0, 5),
        type: 'attendance',
        taskId, memberId, status,
        actorName: 'GAS WebApp',
        note: status
      });
      persist();
      alert('บันทึกสถานะ ' + status + ' เรียบร้อย');
    }

    function closeModal() { document.getElementById('rosterModal').classList.remove('open'); }
    function staffLogin() {
      const pin = document.getElementById('pinInput').value.trim();
      const u = STATE.staff.find(s => s.pin === pin);
      document.getElementById('loginMsg').textContent = u ? ('เข้าสู่ระบบสำเร็จ: ' + u.name + ' (' + u.role + ')') : 'PIN ไม่ถูกต้อง';
    }

    render();
    setInterval(render, 15000);
  </script>
</body>
</html>`;
}
