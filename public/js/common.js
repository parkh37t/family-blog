/* 공용 유틸리티 */

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: opts.body && !(opts.body instanceof FormData)
      ? { 'Content-Type': 'application/json', ...(opts.headers || {}) }
      : opts.headers || {},
    ...opts,
    body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data;
}

let meCache;
export async function me() {
  if (meCache !== undefined) return meCache;
  try {
    const data = await api('/api/auth/me');
    meCache = data.user;
    return meCache;
  } catch {
    meCache = null;
    return null;
  }
}

export function formatDate(iso) {
  const d = new Date(iso.includes('Z') ? iso : iso + 'Z');
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffH < 24) return `${diffH}시간 전`;
  if (diffD < 7) return `${diffD}일 전`;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateTime(iso) {
  const d = new Date(iso.includes('Z') ? iso : iso + 'Z');
  return d.toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(msg, type = 'ok') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'err' ? ' err' : '');
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 2400);
  setTimeout(() => t.remove(), 2800);
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `
      <div class="modal" style="max-width:360px">
        <div class="modal-head"><h2>확인</h2></div>
        <p style="margin:0 0 4px;color:var(--ink-soft)">${escapeHtml(message)}</p>
        <div class="modal-foot">
          <button class="btn btn-ghost" data-no>취소</button>
          <button class="btn btn-primary" data-yes>확인</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    const close = (ok) => { back.remove(); resolve(ok); };
    back.addEventListener('click', (e) => { if (e.target === back) close(false); });
    back.querySelector('[data-no]').onclick = () => close(false);
    back.querySelector('[data-yes]').onclick = () => close(true);
  });
}

export function initialOf(name) {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

export function renderNav(active, user) {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const authSide = user
    ? `
      <a href="/write" class="btn btn-accent btn-sm">글쓰기</a>
      <a href="/me" class="avatar" title="${escapeHtml(user.display_name)}" style="text-decoration:none">
        ${user.avatar ? `<img src="${escapeHtml(user.avatar)}" alt="">` : escapeHtml(initialOf(user.display_name))}
      </a>`
    : `<a href="/login" class="btn btn-sm">로그인</a>`;

  nav.innerHTML = `
    <div class="nav-inner">
      <a href="/" class="brand">
        <span class="brand-mark">家</span>
        <span>우리 가족</span>
      </a>
      <nav class="nav-menu">
        <a href="/" ${active === 'home' ? 'class="active"' : ''}>홈</a>
        <a href="/gallery" ${active === 'gallery' ? 'class="active"' : ''}>사진</a>
        <a href="/members" ${active === 'members' ? 'class="active"' : ''}>구성원</a>
        ${user?.role === 'admin' ? `<a href="/admin" ${active === 'admin' ? 'class="active"' : ''}>관리자</a>` : ''}
      </nav>
      <div class="nav-actions">
        ${authSide}
        <button class="burger" aria-label="메뉴"><span></span></button>
      </div>
    </div>
  `;
  const burger = nav.querySelector('.burger');
  const menu = nav.querySelector('.nav-menu');
  burger.addEventListener('click', () => menu.classList.toggle('mobile-open'));
}

export function renderFooter() {
  let foot = document.querySelector('footer.foot');
  if (!foot) {
    foot = document.createElement('footer');
    foot.className = 'foot';
    document.body.appendChild(foot);
  }
  foot.innerHTML = `
    <div class="serif">추억은 순간이지만, 사랑은 영원하다</div>
    <div style="margin-top:8px">© ${new Date().getFullYear()} 우리 가족 블로그</div>
  `;
}

export function lightbox(src) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = `<img src="${escapeHtml(src)}" alt="">`;
  box.addEventListener('click', () => box.remove());
  document.body.appendChild(box);
}
