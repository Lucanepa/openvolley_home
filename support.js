// openvolley.app/support (the pages come from support/build.mjs): the
// question search, "Ask about this", the language switch, the video
// posters, and the contact form, which posts to the backend's /api/contact
// (escoresheet/backend/lib/contact.js in the openvolley repository). No
// dependencies; the page works without it except for the search and the form
// (its Send button stays disabled and the form has no action: nothing is posted).

(() => {
  'use strict';

  const configEl = document.getElementById('support-config');
  if (!configEl) return;
  const config = JSON.parse(configEl.textContent);
  const text = config.text;
  const fmt = (s, values) => s.replace(/\{(\w+)\}/g, (all, key) => (key in values ? String(values[key]) : all));
  const $ = (id) => document.getElementById(id);

  // ---------- Language switch: keep the section, remember the choice ----------

  for (const a of document.querySelectorAll('.lang-switch a')) {
    a.addEventListener('click', () => {
      try {
        localStorage.setItem('ov-support-lang', a.lang);
      } catch {
        // storage off: the root page then follows the browser's language
      }
      if (location.hash) a.href = a.getAttribute('href').split('#')[0] + location.hash;
    });
  }

  // ---------- Videos: posters when near, one playing at a time ----------

  const setPoster = (video) => {
    video.poster = video.dataset.poster;
    video.removeAttribute('data-poster');
  };
  const lazy = document.querySelectorAll('video[data-poster]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        setPoster(e.target);
        io.unobserve(e.target);
      }
    }, { rootMargin: '600px 0px' });
    lazy.forEach((v) => io.observe(v));
  } else {
    lazy.forEach(setPoster);
  }
  document.addEventListener('play', (e) => {
    for (const v of document.querySelectorAll('video')) if (v !== e.target) v.pause();
  }, true);

  // A link to one question (#q-<section>-<id>) opens it
  const openFromHash = () => {
    let id = '';
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS') el.open = true;
  };
  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  // ---------- Search: every word in the question, its answer or the section title ----------

  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[“”„«»"‘’']/g, ' ');
  const content = document.querySelector('.support-content');
  const status = $('search-status');
  const searchInput = $('faq-search');
  const sections = [...document.querySelectorAll('[data-help-section]')].map((el) => {
    const title = norm(el.querySelector('h2').textContent);
    return { el, items: [...el.querySelectorAll('.faq-item')].map((d) => ({ el: d, text: `${title} ${norm(d.textContent)}` })) };
  });
  let openedBySearch = [];

  function search() {
    const words = norm(searchInput.value).split(/\s+/).filter(Boolean);
    openedBySearch.forEach((d) => { d.open = false; });
    openedBySearch = [];
    content.classList.toggle('is-searching', words.length > 0);
    status.textContent = '';
    let count = 0;
    const hits = [];
    for (const s of sections) {
      let n = 0;
      for (const item of s.items) {
        const hit = words.every((w) => item.text.includes(w));
        item.el.hidden = !hit;
        if (hit) {
          n++;
          hits.push(item.el);
        }
      }
      s.el.hidden = n === 0;
      count += n;
    }
    if (!words.length) return;
    // A few hits: show their answers at once
    if (count <= 3) {
      for (const d of hits) {
        if (d.open) continue;
        d.open = true;
        openedBySearch.push(d);
      }
    }
    if (count) {
      status.textContent = fmt(text.found[count === 1 ? 0 : 1], { n: count });
    } else {
      const a = document.createElement('a');
      a.href = '#contact';
      a.textContent = text.noneLink;
      status.append(`${text.none} `, a);
    }
  }
  if (searchInput && status && content) {
    searchInput.addEventListener('input', search);
    if (searchInput.value) search();
  }

  // ---------- Contact form ----------

  const form = $('contact-form');
  if (!form) return;
  const type = $('cf-type');
  const supportTypes = $('cf-support-type');
  const severityField = $('cf-severity-field');
  const severity = $('cf-severity');
  const matchField = $('cf-match-field');
  const matchRunning = $('cf-match');
  const area = $('cf-area');
  const email = $('cf-email');
  const message = $('cf-message');
  const fileInput = $('cf-files');
  const fileList = $('cf-file-list');
  const alertBox = $('cf-alert');
  const send = $('cf-send');
  const sendLabel = send.querySelector('span');
  const sendText = sendLabel.textContent;
  const doneBox = $('cf-done');
  // Disabled in the page, so that without this script the form cannot be posted
  send.disabled = false;

  // The backend's checks (lib/contact.js): the address, the kinds of file
  const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
  const FILE_EXT = /\.(png|jpe?g|gif|webp|heic|heif|avif|pdf|txt|log|csv|json|ndjson)$/i;
  const FILE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/avif', 'application/pdf', 'text/plain', 'text/csv', 'application/json'];
  const allowedFile = (f) => (/\.[^./\\]+$/.test(f.name) ? FILE_EXT.test(f.name) : FILE_TYPES.includes(f.type));
  const maxBytes = config.maxFilesMb * 1024 * 1024;
  let files = [];
  let sending = false;

  function setError(field, msg) {
    const err = $(`${field.id}-error`);
    if (msg) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
    if (err) {
      err.textContent = msg;
      err.hidden = !msg;
    }
  }

  // Support: its type; a bug report: its severity too (required). "A match is running":
  // for every type once one is chosen, as in the app's dialog
  const supportType = () => form.querySelector('input[name="supportType"]:checked')?.value || '';
  const matchTicked = () => !matchField.hidden && matchRunning.checked;
  const syncType = () => {
    const support = type.value === 'support';
    supportTypes.hidden = !support;
    matchField.hidden = !type.value;
    severityField.hidden = !(support && supportType() === 'bug');
    if (severityField.hidden) setError(severity, '');
  };
  type.addEventListener('change', () => {
    syncType();
    if (type.value) setError(type, '');
  });
  supportTypes.addEventListener('change', syncType);
  severity.addEventListener('change', () => {
    if (severity.value) setError(severity, '');
  });
  syncType();
  email.addEventListener('input', () => {
    if (email.hasAttribute('aria-invalid') && EMAIL.test(email.value.trim())) setError(email, '');
  });
  message.addEventListener('input', () => {
    if (message.value.trim()) setError(message, '');
  });

  function formatSize(bytes) {
    const [kb, mb] = config.lang === 'fr' ? ['Ko', 'Mo'] : ['KB', 'MB'];
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ${kb}`;
    return `${(bytes / (1024 * 1024)).toLocaleString(config.lang, { maximumFractionDigits: 1 })} ${mb}`;
  }

  function checkFiles() {
    const bad = files.find((f) => !allowedFile(f));
    let msg = '';
    if (bad) msg = fmt(text.fileType, { name: bad.name });
    else if (files.length > config.maxFiles) msg = fmt(text.tooManyFiles, { max: config.maxFiles });
    else if (files.reduce((n, f) => n + f.size, 0) > maxBytes) msg = fmt(text.filesTooLarge, { mb: config.maxFilesMb });
    setError(fileInput, msg);
    return !msg;
  }

  function renderFiles() {
    fileList.textContent = '';
    files.forEach((f, i) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = f.name;
      const size = document.createElement('span');
      size.className = 'file-size';
      size.textContent = formatSize(f.size);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'file-remove';
      remove.setAttribute('aria-label', fmt(text.remove, { name: f.name }));
      remove.innerHTML = config.icons.x;
      remove.addEventListener('click', () => {
        files.splice(i, 1);
        renderFiles();
        checkFiles();
        fileInput.focus();
      });
      li.append(name, size, remove);
      fileList.append(li);
    });
    fileList.hidden = files.length === 0;
  }

  // Each pick adds to the list (people often pick one file at a time)
  fileInput.addEventListener('change', () => {
    for (const f of fileInput.files) {
      if (!files.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) files.push(f);
    }
    fileInput.value = '';
    renderFiles();
    checkFiles();
  });

  function validate() {
    const value = email.value.trim();
    const checks = [
      [type, type.value ? '' : text.typeMissing],
      [severity, severityField.hidden || severity.value ? '' : text.severityMissing],
      [email, value.length <= 254 && EMAIL.test(value) ? '' : text.emailInvalid],
      [message, message.value.trim() ? '' : text.messageMissing],
    ];
    checks.forEach(([field, msg]) => setError(field, msg));
    const filesOk = checkFiles();
    const first = checks.find(([, msg]) => msg);
    if (first) {
      first[0].focus();
      return false;
    }
    if (!filesOk) {
      fileInput.focus();
      return false;
    }
    return true;
  }

  function hideAlert() {
    alertBox.hidden = true;
    alertBox.textContent = '';
  }

  /** The same message as an email, when the form cannot send it. */
  function mailtoHref(v) {
    const typeText = type.selectedIndex > 0 ? type.options[type.selectedIndex].text : '';
    const areaText = area.selectedIndex > 0 ? area.options[area.selectedIndex].text : '';
    const subject = [matchTicked() ? '[OpenVolley – match running]' : '[OpenVolley]', typeText, areaText].filter(Boolean).join(' ');
    return `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(v.comments.slice(0, 1500))}`;
  }

  function showAlert(msg, v) {
    const p = document.createElement('p');
    p.textContent = msg;
    const link = document.createElement('p');
    const a = document.createElement('a');
    a.href = mailtoHref(v);
    a.textContent = text.sendByEmail;
    link.append(a);
    alertBox.replaceChildren(p, link);
    alertBox.hidden = false;
  }

  function setSending(on) {
    sending = on;
    send.disabled = on;
    sendLabel.textContent = on ? text.sending : sendText;
    form.setAttribute('aria-busy', String(on));
  }

  function showDone(v) {
    form.hidden = true;
    $('cf-done-title').textContent = text.sent;
    $('cf-done-text').textContent = text.thankYou[v.contactType] || text.thankYou.support;
    $('cf-done-reply').textContent = fmt(text.replyTo, { email: v.email });
    $('cf-again').textContent = text.another;
    doneBox.hidden = false;
    doneBox.focus();
  }

  /** Back to an empty form; the address stays for the next message. */
  function showForm() {
    if (!form.hidden) return;
    const keep = email.value;
    form.reset();
    email.value = keep;
    files = [];
    renderFiles();
    [type, severity, email, message, fileInput].forEach((f) => setError(f, ''));
    syncType();
    hideAlert();
    doneBox.hidden = true;
    form.hidden = false;
  }

  $('cf-again').addEventListener('click', () => {
    showForm();
    type.focus();
  });

  // "Ask about this": the form with the section as its area
  for (const a of document.querySelectorAll('[data-area]')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showForm();
      area.value = a.dataset.area;
      if (!type.value) {
        type.value = 'support';
        syncType();
        setError(type, '');
      }
      if (!supportType()) form.querySelector('input[name="supportType"][value="help"]').checked = true;
      syncType();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      $('contact').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      history.pushState(null, '', '#contact');
      (email.value.trim() ? message : email).focus({ preventScroll: true });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    hideAlert();
    if (!validate()) return;

    const support = type.value === 'support';
    const v = {
      contactType: type.value,
      area: area.value || 'other',
      supportType: support ? supportType() : '',
      severity: severityField.hidden ? '' : severity.value,
      email: email.value.trim(),
      comments: message.value.trim(),
    };
    const body = new FormData();
    for (const [k, value] of Object.entries(v)) body.append(k, value);
    // The backend makes the ticket P1
    if (matchTicked()) body.append('matchRunning', '1');
    body.append('source', 'website');
    body.append('language', config.lang);
    body.append('platform', 'web');
    body.append('url', location.href);
    body.append('userAgent', navigator.userAgent);
    body.append('timestamp', new Date().toISOString());
    body.append('website', form.elements.website.value);
    for (const f of files) body.append('files', f, f.name);

    setSending(true);
    // A phone on hall Wi-Fi with 10 MB of attachments: give it the backend's 2 minutes
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120 * 1000);
    let res = null;
    let answer = {};
    try {
      res = await fetch(config.api, { method: 'POST', body, signal: ctrl.signal });
      answer = await res.json().catch(() => ({}));
    } catch {
      res = null;
    } finally {
      clearTimeout(timer);
      setSending(false);
    }
    if (res && res.ok && answer.success) {
      showDone(v);
      return;
    }

    // A field the backend refused: say so at the field
    const code = answer.code;
    const fieldError = {
      invalid_type: [type, text.typeMissing],
      invalid_email: [email, text.emailInvalid],
      missing_comments: [message, text.messageMissing],
      too_many_files: [fileInput, fmt(text.tooManyFiles, { max: config.maxFiles })],
      files_too_large: [fileInput, fmt(text.filesTooLarge, { mb: config.maxFilesMb })],
      file_type: [fileInput, fmt(text.fileType, { name: answer.file || '' })],
    }[code];
    if (fieldError) {
      setError(...fieldError);
      fieldError[0].focus();
      return;
    }
    const busy = res && (res.status === 429 || code === 'busy');
    showAlert(busy ? text.busy : text.sendError, v);
  });
})();
