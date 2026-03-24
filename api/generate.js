<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Voiro — Release Notes</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #f5f5f7; color: #1a1a2e; min-height: 100vh; }

  /* Header */
  .header { background: #fff; border-bottom: 1px solid #e5e5ea; padding: 0 32px; height: 56px; display: flex; align-items: center; justify-content: space-between; }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo svg { width: 24px; height: 24px; }
  .logo-text { font-size: 15px; font-weight: 600; color: #1a1a2e; }
  .user-pill { display: none; align-items: center; gap: 6px; background: #f5f5f7; border: 1px solid #e5e5ea; border-radius: 20px; padding: 4px 12px 4px 8px; font-size: 12px; color: #4f46e5; font-weight: 500; }
  .user-pill.visible { display: flex; }
  .user-avatar { width: 20px; height: 20px; background: #4f46e5; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 600; }

  /* Login */
  .login-screen { display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 56px); padding: 24px; }
  .login-card { background: #fff; border: 1px solid #e5e5ea; border-radius: 16px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
  .login-title { font-size: 20px; font-weight: 600; margin-bottom: 6px; }
  .login-subtitle { font-size: 13px; color: #8e8ea0; margin-bottom: 28px; line-height: 1.5; }
  .login-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 13px; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; display: none; line-height: 1.5; }
  .login-error.visible { display: block; }

  /* App */
  .app-screen { display: none; max-width: 1000px; margin: 0 auto; padding: 32px 24px; gap: 24px; }
  .app-screen.visible { display: flex; flex-direction: column; }
  .form-card { background: #fff; border: 1px solid #e5e5ea; border-radius: 12px; padding: 24px; }
  .form-card-title { font-size: 13px; font-weight: 600; color: #8e8ea0; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 20px; }
  .form-row { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 16px; align-items: start; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-size: 13px; font-weight: 500; color: #3a3a52; }
  .field input { font-family: 'Inter', sans-serif; font-size: 14px; background: #fff; border: 1px solid #d1d1db; border-radius: 8px; color: #1a1a2e; padding: 9px 12px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; width: 100%; }
  .field input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
  .field input::placeholder { color: #b0b0c0; }
  .field-hint { font-size: 11px; color: #8e8ea0; margin-top: 3px; }

  /* Multiselect */
  .ms-wrap { position: relative; }
  .ms-trigger { font-family: 'Inter', sans-serif; font-size: 14px; background: #fff; border: 1px solid #d1d1db; border-radius: 8px; color: #1a1a2e; padding: 6px 32px 6px 8px; outline: none; cursor: pointer; width: 100%; text-align: left; transition: border-color 0.15s, box-shadow 0.15s; display: flex; align-items: flex-start; justify-content: space-between; min-height: 40px; flex-wrap: wrap; gap: 4px; }
  .ms-trigger:focus, .ms-trigger.open { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
  .ms-trigger.disabled { background: #f5f5f7; color: #8e8ea0; cursor: not-allowed; }
  .ms-arrow { font-size: 10px; color: #8e8ea0; flex-shrink: 0; margin-left: 4px; padding-top: 3px; }
  .ms-placeholder { color: #b0b0c0; font-size: 14px; padding: 2px 4px; }
  .ms-tag { background: #eef2ff; border: 1px solid #c7d2fe; color: #4f46e5; border-radius: 4px; padding: 1px 6px; font-size: 12px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .ms-tag-remove { cursor: pointer; opacity: 0.6; font-size: 11px; }
  .ms-tag-remove:hover { opacity: 1; }
  .ms-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border: 1px solid #d1d1db; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); z-index: 100; max-height: 220px; overflow-y: auto; display: none; }
  .ms-dropdown.open { display: block; }
  .ms-option { display: flex; align-items: center; gap: 10px; padding: 9px 12px; font-size: 14px; cursor: pointer; transition: background 0.1s; }
  .ms-option:hover { background: #f5f5f7; }
  .ms-option.selected { background: #eef2ff; }
  .ms-checkbox { width: 15px; height: 15px; border: 1.5px solid #d1d1db; border-radius: 3px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 10px; }
  .ms-option.selected .ms-checkbox { background: #4f46e5; border-color: #4f46e5; color: #fff; }
  .ms-select-all { border-bottom: 1px solid #e5e5ea; font-weight: 600; color: #4f46e5; }

  /* Buttons */
  .btn-primary { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; background: #4f46e5; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: background 0.15s; white-space: nowrap; }
  .btn-primary:hover { background: #4338ca; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; background: #fff; color: #3a3a52; border: 1px solid #d1d1db; border-radius: 8px; padding: 8px 16px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; }
  .btn-secondary:hover { border-color: #4f46e5; color: #4f46e5; }

  /* Steps */
  .steps-box { background: #f9f9fb; border: 1px solid #e5e5ea; border-radius: 10px; padding: 16px 20px; display: none; }
  .steps-box.visible { display: block; }
  .step-item { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #8e8ea0; padding: 4px 0; }
  .step-item.done { color: #1a1a2e; }
  .step-item.active { color: #4f46e5; }
  .step-dot { width: 6px; height: 6px; border-radius: 50%; background: #d1d1db; flex-shrink: 0; }
  .step-item.done .step-dot { background: #22c55e; }
  .step-item.active .step-dot { background: #4f46e5; }

  /* Output */
  .output-area { display: none; flex-direction: column; gap: 16px; }
  .output-area.visible { display: flex; }
  .output-topbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .output-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .chip { font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 20px; border: 1px solid #e5e5ea; color: #3a3a52; background: #fff; }
  .chip.client { background: #eef2ff; border-color: #c7d2fe; color: #4f46e5; }
  .output-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  /* Category */
  .category-section { display: flex; flex-direction: column; gap: 12px; }
  .category-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #8e8ea0; padding-bottom: 8px; border-bottom: 1px solid #e5e5ea; }

  /* Note card */
  .note-card { background: #fff; border: 1px solid #e5e5ea; border-radius: 10px; padding: 20px; animation: fadeUp 0.25s ease both; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  .note-card-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .note-client-tag { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #4f46e5; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 4px; padding: 2px 8px; }
  .note-pp-link { font-size: 11px; color: #8e8ea0; text-decoration: none; font-family: monospace; }
  .note-pp-link:hover { color: #4f46e5; text-decoration: underline; }
  .note-title { font-size: 15px; font-weight: 600; color: #1a1a2e; margin-bottom: 8px; line-height: 1.4; }
  .note-summary { font-size: 14px; line-height: 1.65; color: #52526e; margin-bottom: 12px; }
  .note-bullets { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .note-bullets li { font-size: 13px; color: #52526e; line-height: 1.5; display: flex; gap: 8px; align-items: flex-start; }
  .note-bullets li::before { content: '→'; color: #4f46e5; font-weight: 600; flex-shrink: 0; margin-top: 1px; }

  /* Flag card */
  .flag-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px 18px; }
  .flag-label { font-size: 11px; font-weight: 600; color: #d97706; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .flag-reason { font-size: 13px; color: #92400e; }
  .empty-msg { background: #fff; border: 1px solid #e5e5ea; border-radius: 10px; padding: 40px; text-align: center; color: #8e8ea0; font-size: 14px; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
  .spinner-sm { width: 11px; height: 11px; border: 2px solid #d1d1db; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; margin-right: 4px; }
  @media (max-width: 640px) { .form-row { grid-template-columns: 1fr; } .header { padding: 0 16px; } .app-screen { padding: 16px; } }
</style>
</head>
<body>

<div class="header">
  <div class="logo">
    <svg width="28" height="28" xmlns="http://www.w3.org/2000/svg"><g fill="none"><path d="M27.695 13.29L4.891 3.548l.541-.442A13.621 13.621 0 0114.087 0c7.087 0 13.042 5.532 13.565 12.594l.043.697zM6.527 3.324l20.197 8.624C25.91 5.668 20.484.852 14.081.852c-2.72 0-5.376.872-7.554 2.47" fill="#474647"/><path d="M3.87 23.147l-.193-.2A12.872 12.872 0 010 13.914a12.88 12.88 0 013.752-9.116l.193-.193 21.896 9.309-21.97 9.234z" fill="#3BB6BB"/><path d="M13.844 27.757a13.87 13.87 0 01-8.798-3.154l-.547-.455 23.196-9.874-.056.71c-.541 7.16-6.602 12.773-13.795 12.773M6.166 24.38a13.017 13.017 0 007.678 2.513c6.496 0 12.01-4.89 12.862-11.256L6.166 24.38z" fill="#CE5450"/></g></svg>
    <span class="logo-text">Voiro Release Notes</span>
  </div>
  <div class="user-pill" id="userPill">
    <div class="user-avatar" id="userAvatar"></div>
    <span id="userEmail"></span>
  </div>
</div>

<!-- LOGIN -->
<div class="login-screen" id="loginScreen">
  <div class="login-card">
    <div id="stepEmail">
      <div class="login-title">Sign in</div>
      <div class="login-subtitle">Enter your Voiro email address to receive a login code.</div>
      <div class="login-error" id="emailError"></div>
      <div class="field" style="margin-bottom:16px;">
        <label>Email address</label>
        <input type="email" id="loginEmail" placeholder="you@voiro.com" onkeydown="if(event.key==='Enter')sendOTP()" />
      </div>
      <button class="btn-primary" style="width:100%;justify-content:center;" id="sendOTPBtn" onclick="sendOTP()">Send Login Code →</button>
    </div>
    <div id="stepOTP" style="display:none;">
      <div class="login-title">Check your email</div>
      <div class="login-subtitle" id="otpSubtitle">We sent a 6-digit code. It expires in 10 minutes.</div>
      <div class="login-error" id="otpError"></div>
      <div class="field" style="margin-bottom:16px;">
        <label>Login code</label>
        <input type="text" id="otpInput" placeholder="000000" maxlength="6" style="letter-spacing:8px;font-size:20px;text-align:center;" onkeydown="if(event.key==='Enter')verifyOTP()" />
      </div>
      <button class="btn-primary" style="width:100%;justify-content:center;" id="verifyOTPBtn" onclick="verifyOTP()">Verify →</button>
      <div style="text-align:center;margin-top:12px;">
        <button onclick="resendOTP()" style="background:none;border:none;font-size:13px;color:#8e8ea0;cursor:pointer;font-family:Inter,sans-serif;">Resend code</button>
      </div>
    </div>
  </div>
</div>

<!-- APP -->
<div class="app-screen" id="appScreen">
  <div class="form-card">
    <div class="form-card-title">Generate Release Notes</div>
    <div class="form-row">
      <div class="field">
        <label>DEVOPS Ticket</label>
        <input type="text" id="devopsTicket" placeholder="DEVOPS-458 or paste full URL" />
        <span class="field-hint">Accepts ticket ID or Jira URL</span>
      </div>
      <div class="field">
        <label>Client</label>
        <div class="ms-wrap" id="clientWrap">
          <div class="ms-trigger disabled" id="clientTrigger" onclick="toggleDropdown('client')">
            <span class="ms-placeholder" id="clientPlaceholder"><span class="spinner-sm"></span>Loading...</span>
            <span class="ms-arrow">▼</span>
          </div>
          <div class="ms-dropdown" id="clientDropdown"></div>
        </div>
      </div>
      <div class="field">
        <label>Include Ticket Statuses</label>
        <div class="ms-wrap" id="statusWrap">
          <div class="ms-trigger" id="statusTrigger" onclick="toggleDropdown('status')">
            <span class="ms-placeholder" id="statusPlaceholder">Select statuses...</span>
            <span class="ms-arrow">▼</span>
          </div>
          <div class="ms-dropdown" id="statusDropdown"></div>
        </div>
      </div>
    </div>
    <div style="margin-top:16px;display:flex;gap:10px;align-items:center;">
      <button class="btn-primary" id="generateBtn" onclick="generate()">
        <span id="btnText">Generate</span>
        <span id="btnSpinner" class="spinner" style="display:none"></span>
      </button>
      <div id="errorMsg" style="font-size:13px;color:#dc2626;display:none;"></div>
    </div>
  </div>

  <div class="steps-box" id="stepsBox"></div>
  <div class="output-area" id="outputArea"></div>
</div>

<script>
  const { jsPDF } = window.jspdf;
  let currentUser = null, currentNotes = null, currentMeta = null;

  const CLIENT_NAME_MAP = { 'carrefourr': 'Carrefour', 'carrefour': 'Carrefour' };
  function normalizeClientName(name) { return CLIENT_NAME_MAP[(name||'').toLowerCase()] || name; }

  const ALL_STATUSES = ['To Do','Dev To Do (Github)','In Progress','QA In Progress','Testing Completed','Pending Verification','TO BE REVIEWED','REVIEWED','Done'];
  const FALLBACK_CLIENTS = ['Carrefour','DSTV','Flipkart','Myntra','Paytm','SonyLiv','Zee5'];
  const msState = { client: [], status: [] };

  document.addEventListener('click', e => {
    if (!e.target.closest('#clientWrap')) closeDropdown('client');
    if (!e.target.closest('#statusWrap')) closeDropdown('status');
  });

  function toggleDropdown(name) {
    const trigger = document.getElementById(name+'Trigger');
    if (trigger.classList.contains('disabled')) return;
    const dropdown = document.getElementById(name+'Dropdown');
    const isOpen = dropdown.classList.contains('open');
    closeDropdown('client'); closeDropdown('status');
    if (!isOpen) { dropdown.classList.add('open'); trigger.classList.add('open'); }
  }
  function closeDropdown(name) {
    document.getElementById(name+'Dropdown').classList.remove('open');
    document.getElementById(name+'Trigger').classList.remove('open');
  }
  function buildDropdown(name, options, includeAll=false) {
    const dropdown = document.getElementById(name+'Dropdown');
    dropdown.innerHTML = '';
    if (includeAll) {
      const el = document.createElement('div');
      el.className = 'ms-option ms-select-all' + (msState[name].length===options.length?' selected':'');
      el.innerHTML = `<div class="ms-checkbox">${msState[name].length===options.length?'✓':''}</div><span>All Clients</span>`;
      el.onclick = () => toggleAll(name, options);
      dropdown.appendChild(el);
    }
    options.forEach(opt => {
      const el = document.createElement('div');
      const sel = msState[name].includes(opt);
      el.className = 'ms-option'+(sel?' selected':'');
      el.innerHTML = `<div class="ms-checkbox">${sel?'✓':''}</div><span>${opt}</span>`;
      el.onclick = () => toggleOption(name, opt, options);
      dropdown.appendChild(el);
    });
  }
  function toggleAll(name, options) {
    msState[name] = msState[name].length===options.length ? [] : [...options];
    buildDropdown(name, options, name==='client');
    updateTrigger(name);
  }
  function toggleOption(name, opt, options) {
    const idx = msState[name].indexOf(opt);
    if (idx===-1) msState[name].push(opt); else msState[name].splice(idx,1);
    buildDropdown(name, options, name==='client');
    updateTrigger(name);
  }
  function updateTrigger(name) {
    const trigger = document.getElementById(name+'Trigger');
    const placeholder = document.getElementById(name+'Placeholder');
    const selected = msState[name];
    Array.from(trigger.querySelectorAll('.ms-tag')).forEach(t=>t.remove());
    const arrow = trigger.querySelector('.ms-arrow');
    if (selected.length===0) {
      placeholder.style.display=''; placeholder.textContent=name==='client'?'Select clients...':'Select statuses...';
    } else {
      placeholder.style.display='none';
      selected.forEach(s => {
        const tag = document.createElement('span');
        tag.className='ms-tag';
        tag.innerHTML=`${s} <span class="ms-tag-remove" onclick="event.stopPropagation();removeOption('${name}','${s}')">✕</span>`;
        trigger.insertBefore(tag, arrow);
      });
    }
  }
  function removeOption(name, opt) {
    const idx = msState[name].indexOf(opt);
    if (idx!==-1) msState[name].splice(idx,1);
    const options = name==='client' ? (window._clientOptions||FALLBACK_CLIENTS) : ALL_STATUSES;
    buildDropdown(name, options, name==='client');
    updateTrigger(name);
  }
  function initStatusDropdown() {
    msState.status = [...ALL_STATUSES];
    buildDropdown('status', ALL_STATUSES, false);
    updateTrigger('status');
  }

  // OTP Auth
  async function sendOTP() {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const errEl = document.getElementById('emailError');
    errEl.classList.remove('visible');
    if (!email) { errEl.textContent='Please enter your email address.'; errEl.classList.add('visible'); return; }
    const btn = document.getElementById('sendOTPBtn');
    btn.disabled=true; btn.textContent='Sending...';
    try {
      const res = await fetch('/api/otp', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'send',email}) });
      let data;
      try { data = await res.json(); } catch { data = { error: 'Server error — please check with deven@voiro.com' }; }
      if (!res.ok) { errEl.textContent=data.error||'Something went wrong. Please contact deven@voiro.com.'; errEl.classList.add('visible'); return; }
      currentUser = email;
      document.getElementById('stepEmail').style.display='none';
      document.getElementById('stepOTP').style.display='block';
      document.getElementById('otpSubtitle').textContent=`We sent a 6-digit code to ${email}. It expires in 10 minutes.`;
      setTimeout(()=>document.getElementById('otpInput').focus(),100);
    } catch { errEl.textContent='Network error. Please try again.'; errEl.classList.add('visible'); }
    finally { btn.disabled=false; btn.textContent='Send Login Code →'; }
  }
  async function resendOTP() {
    document.getElementById('stepOTP').style.display='none';
    document.getElementById('stepEmail').style.display='block';
    document.getElementById('otpInput').value='';
    document.getElementById('otpError').classList.remove('visible');
  }
  async function verifyOTP() {
    const otp = document.getElementById('otpInput').value.trim();
    const errEl = document.getElementById('otpError');
    errEl.classList.remove('visible');
    if (!otp||otp.length<6) { errEl.textContent='Please enter the 6-digit code.'; errEl.classList.add('visible'); return; }
    const btn = document.getElementById('verifyOTPBtn');
    btn.disabled=true; btn.textContent='Verifying...';
    try {
      const res = await fetch('/api/otp', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'verify',email:currentUser,otp}) });
      let data;
      try { data = await res.json(); } catch { data = { error: 'Server error — please contact deven@voiro.com' }; }
      if (!res.ok) { errEl.textContent=data.error||'Verification failed.'; errEl.classList.add('visible'); return; }
      document.getElementById('loginScreen').style.display='none';
      document.getElementById('appScreen').classList.add('visible');
      document.getElementById('userEmail').textContent=currentUser;
      document.getElementById('userAvatar').textContent=currentUser[0].toUpperCase();
      document.getElementById('userPill').classList.add('visible');
      initStatusDropdown();
      await loadClientLabels();
    } catch { errEl.textContent='Network error. Please try again.'; errEl.classList.add('visible'); }
    finally { btn.disabled=false; btn.textContent='Verify →'; }
  }

  async function loadClientLabels() {
    const trigger = document.getElementById('clientTrigger');
    try {
      const res = await fetch('/api/labels', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:currentUser}) });
      const data = await res.json();
      const labels = (data.labels&&data.labels.length>0) ? data.labels : FALLBACK_CLIENTS;
      window._clientOptions = labels;
      msState.client = [...labels];
      buildDropdown('client', labels, true);
      trigger.classList.remove('disabled');
      updateTrigger('client');
    } catch {
      window._clientOptions = FALLBACK_CLIENTS;
      msState.client = [...FALLBACK_CLIENTS];
      buildDropdown('client', FALLBACK_CLIENTS, true);
      trigger.classList.remove('disabled');
      updateTrigger('client');
    }
  }

  function extractTicketId(input) {
    const s = (input||'').trim();
    // Try to extract from URL
    const urlMatch = s.match(/browse\/([A-Z]+-\d+)/i) || s.match(/([A-Z]+-\d+)/i);
    return urlMatch ? urlMatch[1].toUpperCase() : s.toUpperCase();
  }

  function showError(msg) { const el=document.getElementById('errorMsg'); el.textContent=msg; el.style.display='block'; }
  function hideError() { document.getElementById('errorMsg').style.display='none'; }
  function setLoading(on) {
    document.getElementById('generateBtn').disabled=on;
    document.getElementById('btnText').textContent=on?'Generating...':'Generate';
    document.getElementById('btnSpinner').style.display=on?'inline-block':'none';
  }
  function renderSteps(steps, activeIndex) {
    const box=document.getElementById('stepsBox');
    box.classList.add('visible');
    box.innerHTML=steps.map((s,i)=>`<div class="step-item ${i<activeIndex?'done':i===activeIndex?'active':''}"><div class="step-dot"></div><span>${s}</span></div>`).join('');
  }

  async function generate() {
    const rawInput = document.getElementById('devopsTicket').value.trim();
    const devopsTicket = extractTicketId(rawInput);
    const clientFilter = msState.client;
    const statusFilter = msState.status;
    hideError();
    if (!devopsTicket||!devopsTicket.startsWith('DEVOPS')) { showError('Please enter a valid DEVOPS ticket ID or URL.'); return; }
    if (clientFilter.length===0) { showError('Please select at least one client.'); return; }
    if (statusFilter.length===0) { showError('Please select at least one status.'); return; }
    setLoading(true);
    closeDropdown('client'); closeDropdown('status');
    document.getElementById('outputArea').classList.remove('visible');
    document.getElementById('outputArea').innerHTML='';
    const progressSteps = ['Connecting to Jira...','Fetching linked tickets...','Resolving ticket hierarchy...','Filtering by client & status...','Generating release notes...'];
    let stepIndex=0; renderSteps(progressSteps,stepIndex);
    const stepTimer=setInterval(()=>{ stepIndex=Math.min(stepIndex+1,progressSteps.length-1); renderSteps(progressSteps,stepIndex); },1800);
    try {
      const res = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:currentUser,devopsTicket,clientFilter,statusFilter,allClientOptions:window._clientOptions||[]}) });
      clearInterval(stepTimer); renderSteps(progressSteps,progressSteps.length);
      const data = await res.json();
      if (!res.ok) { showError(data.error||'Something went wrong.'); return; }
      if (data.empty||!data.notes?.length) {
        document.getElementById('outputArea').innerHTML=`<div class="empty-msg">No tickets found matching your filters on ${devopsTicket}.</div>`;
        document.getElementById('outputArea').classList.add('visible'); return;
      }
      currentNotes=data.notes;
      const clientLabel=clientFilter.length===(window._clientOptions||[]).length?'All Clients':clientFilter.join(', ');
      currentMeta={client:clientLabel,devopsId:devopsTicket};
      renderOutput(data.notes,currentMeta);
    } catch(err) { clearInterval(stepTimer); showError('Network error: '+err.message); }
    finally { setLoading(false); }
  }

  function renderOutput(notes, meta) {
    const area=document.getElementById('outputArea');
    area.innerHTML='';
    const flags=notes.filter(n=>n.flag), valid=notes.filter(n=>!n.flag);
    const topbar=document.createElement('div'); topbar.className='output-topbar';
    topbar.innerHTML=`
      <div class="output-meta">
        <span class="chip client">${meta.client}</span>
        <span class="chip">${meta.devopsId}</span>
        <span class="chip">${valid.length} update${valid.length!==1?'s':''}</span>
      </div>
      <div class="output-actions">
        <button class="btn-secondary" id="copyBtn" onclick="copyNotes()">⎘ Copy</button>
        <button class="btn-secondary" id="copyEmailBtn" onclick="copyForEmail()">✉ Copy for Email</button>
        <button class="btn-secondary" onclick="downloadPDF()">⬇ Download PDF</button>
      </div>`;
    area.appendChild(topbar);

    ['New Features','Improvements','Bug Fixes','Platform & Performance'].forEach(cat => {
      const items=valid.filter(n=>n.category===cat);
      if (!items.length) return;
      const section=document.createElement('div'); section.className='category-section';
      section.innerHTML=`<div class="category-label">${cat}</div>`;
      items.forEach((note,i) => {
        const card=document.createElement('div'); card.className='note-card'; card.style.animationDelay=`${i*0.05}s`;
        const clientTag=note.client&&note.client!=='All'?`<span class="note-client-tag">${normalizeClientName(note.client)}</span>`:'';
        const ppLink=note.ppKey?`<a href="https://voirothinktank.atlassian.net/browse/${note.ppKey}" target="_blank" class="note-pp-link">${note.ppKey} ↗</a>`:'';
        const bullets=(note.bullets||[]).map(b=>`<li>${b}</li>`).join('');
        card.innerHTML=`
          <div class="note-card-meta">${clientTag}${ppLink}</div>
          <div class="note-title">${note.title}</div>
          <div class="note-summary">${note.summary||note.description||''}</div>
          ${bullets?`<ul class="note-bullets">${bullets}</ul>`:''}`;
        section.appendChild(card);
      });
      area.appendChild(section);
    });

    if (flags.length) {
      const fs=document.createElement('div'); fs.className='category-section';
      fs.innerHTML=`<div class="category-label" style="color:#d97706;">⚠ Needs Review</div>`;
      flags.forEach(f=>{ const c=document.createElement('div'); c.className='flag-card'; c.innerHTML=`<div class="flag-label">Flagged — ${f.key}</div><div class="flag-reason">${f.reason}</div>`; fs.appendChild(c); });
      area.appendChild(fs);
    }
    area.classList.add('visible');
  }

  // PDF Generation
  function downloadPDF() {
    if (!currentNotes||!currentMeta) return;
    const doc = new jsPDF({ unit:'pt', format:'a4' });
    const W=595, margin=48, contentW=W-margin*2;
    let y=margin;
    const colors = { purple:[79,70,229], dark:[26,26,46], mid:[82,82,110], light:[142,142,160], border:[229,229,234], bg:[245,245,247], teal:[59,182,187], red:[206,84,80] };

    // Header bar
    doc.setFillColor(...colors.dark); doc.rect(0,0,W,56,'F');

    // Voiro logo (simplified geometric)
    doc.setFillColor(...colors.teal); doc.circle(28,28,10,'F');
    doc.setFillColor(...colors.red); doc.circle(38,28,6,'F');

    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(16);
    doc.text('Voiro Release Notes',52,34);
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(200,200,210);
    doc.text(`${currentMeta.devopsId}  ·  Generated ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}`, 52, 46);

    y = 80;

    // Client chip
    doc.setFillColor(...colors.purple); doc.roundedRect(margin,y,contentW,32,6,6,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(12);
    doc.text(currentMeta.client, margin+16, y+21);
    y += 52;

    const valid = currentNotes.filter(n=>!n.flag);
    const categories = ['New Features','Improvements','Bug Fixes','Platform & Performance'];

    categories.forEach(cat => {
      const items = valid.filter(n=>n.category===cat);
      if (!items.length) return;

      // Category header
      if (y > 750) { doc.addPage(); y=margin; }
      doc.setFillColor(...colors.bg); doc.roundedRect(margin,y,contentW,24,4,4,'F');
      doc.setTextColor(...colors.light); doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text(cat.toUpperCase(), margin+12, y+16);
      y += 36;

      items.forEach(note => {
        // Estimate height needed
        const titleLines = doc.splitTextToSize(note.title||'', contentW-24);
        const summaryLines = doc.splitTextToSize(note.summary||note.description||'', contentW-24);
        const bulletLines = (note.bullets||[]).map(b=>doc.splitTextToSize(`→  ${b}`, contentW-36));
        const bulletTotal = bulletLines.reduce((a,b)=>a+b.length,0);
        const estH = 20 + titleLines.length*20 + 8 + summaryLines.length*16 + (bulletTotal>0?8+bulletTotal*15:0) + 20;

        if (y+estH > 800) { doc.addPage(); y=margin; }

        // Card background
        doc.setFillColor(255,255,255); doc.setDrawColor(...colors.border); doc.setLineWidth(0.5);
        doc.roundedRect(margin,y,contentW,estH,6,6,'FD');

        let cardY=y+16;

        // Client tag
        if (note.client&&note.client!=='All') {
          const tag=normalizeClientName(note.client);
          const tagW=doc.getTextWidth(tag)+16;
          doc.setFillColor(238,242,255); doc.roundedRect(margin+12,cardY-10,tagW,16,3,3,'F');
          doc.setTextColor(...colors.purple); doc.setFont('helvetica','bold'); doc.setFontSize(8);
          doc.text(tag.toUpperCase(),margin+20,cardY);
          cardY+=14;
        }

        // Title
        doc.setTextColor(...colors.dark); doc.setFont('helvetica','bold'); doc.setFontSize(12);
        doc.text(titleLines, margin+12, cardY);
        cardY+=titleLines.length*20+8;

        // Summary
        doc.setTextColor(...colors.mid); doc.setFont('helvetica','normal'); doc.setFontSize(10);
        doc.text(summaryLines, margin+12, cardY);
        cardY+=summaryLines.length*16;

        // Bullets
        if ((note.bullets||[]).length>0) {
          cardY+=8;
          note.bullets.forEach(b => {
            const bLines=doc.splitTextToSize(`→  ${b}`,contentW-36);
            doc.setTextColor(...colors.purple); doc.setFont('helvetica','bold'); doc.setFontSize(9);
            doc.text('→',margin+12,cardY);
            doc.setTextColor(...colors.mid); doc.setFont('helvetica','normal');
            doc.text(doc.splitTextToSize(b,contentW-48),margin+24,cardY);
            cardY+=bLines.length*15;
          });
        }

        y+=estH+12;
      });
      y+=8;
    });

    // Footer
    const pageCount=doc.internal.getNumberOfPages();
    for(let i=1;i<=pageCount;i++){
      doc.setPage(i);
      doc.setDrawColor(...colors.border); doc.setLineWidth(0.5); doc.line(margin,820,W-margin,820);
      doc.setTextColor(...colors.light); doc.setFont('helvetica','normal'); doc.setFontSize(8);
      doc.text('Confidential — Voiro Technologies',margin,832);
      doc.text(`Page ${i} of ${pageCount}`,W-margin,832,{align:'right'});
    }

    doc.save(`Voiro_Release_Notes_${currentMeta.devopsId}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function buildPlainText() {
    if (!currentNotes||!currentMeta) return '';
    const valid=currentNotes.filter(n=>!n.flag);
    let text=`Release Notes — ${currentMeta.client}\n${'─'.repeat(40)}\n\n`;
    ['New Features','Improvements','Bug Fixes','Platform & Performance'].forEach(cat=>{
      const items=valid.filter(n=>n.category===cat);
      if (!items.length) return;
      text+=`${cat.toUpperCase()}\n\n`;
      items.forEach(n=>{
        text+=`${n.title}\n${n.summary||n.description||''}\n`;
        if ((n.bullets||[]).length>0) n.bullets.forEach(b=>{ text+=`  • ${b}\n`; });
        text+='\n';
      });
    });
    return text.trim();
  }

  function buildEmailSummary() {
    if (!currentNotes||!currentMeta) return '';
    const valid=currentNotes.filter(n=>!n.flag);
    const today=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
    const counts={};
    ['New Features','Improvements','Bug Fixes','Platform & Performance'].forEach(cat=>{
      const n=valid.filter(x=>x.category===cat).length;
      if (n>0) counts[cat]=n;
    });
    const summary=Object.entries(counts).map(([k,v])=>`${v} ${k}`).join(', ');
    return `Subject: Voiro Platform Release Notes — ${today}\n\nHi,\n\nPlease find attached the latest release notes for ${currentMeta.client}.\n\nThis release includes ${summary}. Please refer to the attached PDF for the full details of each update.\n\nFor any questions, please reach out to your Voiro account manager.\n\nBest regards,\nVoiro Team`;
  }

  function copyNotes() {
    navigator.clipboard.writeText(buildPlainText()).then(()=>{
      const btn=document.getElementById('copyBtn'); btn.textContent='✓ Copied';
      setTimeout(()=>{ btn.innerHTML='⎘ Copy'; },2000);
    });
  }
  function copyForEmail() {
    navigator.clipboard.writeText(buildEmailSummary()).then(()=>{
      const btn=document.getElementById('copyEmailBtn'); btn.textContent='✓ Copied';
      setTimeout(()=>{ btn.innerHTML='✉ Copy for Email'; },2000);
    });
  }
</script>
</body>
</html>
