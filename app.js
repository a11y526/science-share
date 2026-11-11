// 과학 1 자료실 — catalog.json 하나로 그리는 정적 사이트(서버 없음). catalog.json은 관리 앱(share.py)이 만든다.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const SITE = new URL('./', location.href).href;
const DAY = 86400;

let CAT, UNITS = [], LESSONS = [], FILES = [], BY_ID = new Map(), KIND = {};

// ---------- 글자 도우미 ----------
function ago(t) {
  const s = Date.now() / 1000 - t;
  if (s < 3600) return '방금';
  if (s < DAY) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 30 * DAY) return `${Math.floor(s / DAY)}일 전`;
  if (s < 365 * DAY) return `${Math.floor(s / (30 * DAY))}개월 전`;
  return `${Math.floor(s / (365 * DAY))}년 전`;
}
const size = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`;
const date = (t) => new Date(t * 1000).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const EXT = { pptx: 'PPT', ppt: 'PPT', key: 'KEY', docx: 'DOCX', hwp: 'HWP', hwpx: 'HWP', xlsx: 'XLSX', pdf: 'PDF', jpg: 'JPG', png: 'PNG', mp4: 'MP4', html: 'HTML' };
function badge(f) {
  if (f.kind === 'lesson' && f.slides) return `${f.slides}쪽`;
  if (f.kind === 'sim') return '시뮬레이션';
  return EXT[f.ext] || f.ext.toUpperCase();
}
const primary = (l) => l.files.find((f) => f.kind === 'lesson') || l.files.find((f) => f.kind === 'sim') || l.files.find((f) => f.thumb) || l.files[0];
const lessonThumb = (l) => (l.files.find((f) => f.kind === 'lesson' && f.thumb) || l.files.find((f) => f.kind === 'sim' && f.thumb) || l.files.find((f) => f.thumb) || {}).thumb;
const unitThumb = (u) => u.lessons.map(lessonThumb).find(Boolean);
const count = (files) => {
  const n = {};
  files.forEach((f) => { n[f.kind] = (n[f.kind] || 0) + 1; });
  return CAT.kinds.filter((k) => n[k.id]).map((k) => `${k.name} ${n[k.id]}`).join(' · ');
};
const portalFiles = (l) => l.files.filter((f) => f.portal);

function toast(t) {
  const el = $('toast');
  el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 1800);
}
async function copy(t) {
  try { await navigator.clipboard.writeText(t); toast('복사했어요'); }
  catch { prompt('아래 글을 복사하세요', t); }
}

// ---------- 조각 ----------
function ava(u, cls = '') {
  return `<span class="ava ${cls}" aria-hidden="true">${esc(u.roman)}</span>`;
}
function thumb(f, b = badge(f)) {
  const doc = f.thumb && !['html', 'jpg', 'png', 'mp4'].includes(f.ext);
  return `<div class="thumb${doc ? ' doc' : ''}">${f.thumb ? `<img src="${enc(f.thumb)}" alt="" loading="lazy">` : `<span class="ext">${esc(EXT[f.ext] || f.ext.toUpperCase())}</span>`}
    ${b ? `<span class="badge">${esc(b)}</span>` : ''}</div>`;
}
function lessonCard(l, withAva = true) {
  const p = primary(l), u = l.unit;
  const f = { ...p, thumb: lessonThumb(l) || p.thumb };
  return `<a class="card" href="#/w/${p.id}">${thumb(f, `자료 ${l.files.length}`)}
    <div class="meta">${withAva ? `<span onclick="event.preventDefault();location.hash='#/u/${u.no}'">${ava(u)}</span>` : ''}<div class="txt">
      <h3>${esc(l.code)} ${esc(l.title)}</h3>
      <p>${u.no}단원 ${esc(u.name)}</p>
      <p>${esc(count(l.files).split(' · ').slice(0, 2).join(' · '))} · ${ago(l.updated)}</p>
      ${Date.now() / 1000 - l.updated < 7 * DAY ? '<span class="tag">새 자료</span>' : ''}
    </div></div></a>`;
}
function fileCard(f, withAva = true) {
  const l = f.lesson, u = l.unit;
  return `<a class="card" href="#/w/${f.id}">${thumb(f)}
    <div class="meta">${withAva ? ava(u) : ''}<div class="txt">
      <h3>${esc(f.title)}</h3>
      <p>${esc(l.code)} ${esc(l.title)}</p>
      <p>${esc(KIND[f.kind])} · ${size(f.size)} · ${ago(f.mtime)}</p>
    </div></div></a>`;
}
function miniCard(f, n, on) {
  return `<a class="mini-card${on ? ' on' : ''}" href="#/w/${f.id}">${n != null ? `<span class="n">${on ? '▶' : n}</span>` : ''}${thumb(f)}
    <div class="txt"><h4>${esc(f.title)}</h4><p>${esc(KIND[f.kind])} · ${size(f.size)}</p></div></a>`;
}
function chips(items, on) {
  return `<div class="chips">${items.map(([href, name]) => `<a class="chip${href === on ? ' on' : ''}" href="${href}">${esc(name)}</a>`).join('')}</div>`;
}
function shelf(title, href, cards) {
  return `<section class="shelf"><div class="shelf-h"><h2>${title}</h2>${href ? `<a href="${href}">모두 보기</a>` : ''}</div>
    <div class="row-wrap"><div class="row">${cards}</div>
    <button class="arrow r" aria-label="다음"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button></div></section>`;
}
function wireShelves() {
  document.querySelectorAll('.row-wrap').forEach((w) => {
    const row = w.querySelector('.row'), b = w.querySelector('.arrow');
    const upd = () => { b.hidden = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4; };
    b.onclick = () => row.scrollBy({ left: row.clientWidth * 0.8, behavior: 'smooth' });
    row.addEventListener('scroll', upd, { passive: true }); upd();
  });
}

// ---------- 화면 ----------
function home(kind) {
  const ks = CAT.kinds.filter((k) => FILES.some((f) => f.kind === k.id));
  const top = chips([['#/', '전체'], ...ks.map((k) => [`#/k/${k.id}`, k.name]), ['#/recent', '최근에 올라온 자료']], kind ? `#/k/${kind}` : '#/');
  if (!kind) {
    const ls = [...LESSONS].sort((a, b) => b.updated - a.updated);
    return top + `<div class="grid">${ls.map((l) => lessonCard(l)).join('')}</div>`;
  }
  const fs = FILES.filter((f) => f.kind === kind).sort((a, b) => b.mtime - a.mtime);
  return top + `<div class="grid">${fs.map((f) => fileCard(f)).join('')}</div>`;
}
function recent() {
  const fs = [...FILES].sort((a, b) => b.mtime - a.mtime).slice(0, 60);
  const ks = CAT.kinds.filter((k) => FILES.some((f) => f.kind === k.id));
  return chips([['#/', '전체'], ...ks.map((k) => [`#/k/${k.id}`, k.name]), ['#/recent', '최근에 올라온 자료']], '#/recent')
    + `<div class="grid">${fs.map((f) => fileCard(f)).join('')}</div>`;
}
function unit(no, tab) {
  const u = UNITS.find((x) => String(x.no) === no);
  if (!u) return '<div class="empty">없는 단원이에요</div>';
  const files = u.lessons.flatMap((l) => l.files);
  const ks = CAT.kinds.filter((k) => files.some((f) => f.kind === k.id));
  const thumbs = u.lessons.map(lessonThumb).filter(Boolean).slice(0, 5);
  let body;
  if (!tab) {
    body = u.lessons.map((l) => shelf(`${esc(l.code)} ${esc(l.title)}`, null, l.files.map((f) => fileCard(f, false)).join(''))).join('');
  } else {
    body = `<div class="grid">${files.filter((f) => f.kind === tab).map((f) => fileCard(f, false)).join('')}</div>`;
  }
  const first = u.lessons.find((l) => portalFiles(l).length);
  return `<div class="banner"><div class="mosaic">${thumbs.map((t) => `<img src="${enc(t)}" alt="">`).join('')}</div>
      <div><small>${esc(u.roman)} 단원</small><h1>${esc(u.name)}</h1></div></div>
    <div class="chan">
      <div class="chan-info">${ava(u, 'big')}<div>
        <h2>${u.no}단원 ${esc(u.name)}</h2>
        <p class="sub"><b>차시 ${u.lessons.length}개</b> · 자료 ${files.length}개 · ${ago(u.updated)} 갱신</p>
        <p class="desc">${esc(count(files))}</p>
        <div class="btns">${first ? `<button class="pill dark" data-import="${esc(u.lessons.filter((l) => portalFiles(l).length).map((l) => l.code).join(' '))}">이 단원 내 포털에 넣기</button>` : ''}
          <a class="pill" href="#/w/${primary(u.lessons[0]).id}">첫 차시부터 보기</a></div>
      </div></div>
      <nav class="tabs"><a href="#/u/${u.no}" class="${tab ? '' : 'on'}">홈</a>${ks.map((k) => `<a href="#/u/${u.no}/${k.id}" class="${tab === k.id ? 'on' : ''}">${k.name}</a>`).join('')}</nav>
      ${body}
    </div>`;
}
function player(f) {
  const src = enc(f.path);
  if (f.ext === 'html') return `<div class="player"><iframe src="${src}" title="${esc(f.title)}" allow="fullscreen" loading="lazy"></iframe></div>`;
  if (f.ext === 'pdf') return `<div class="player tall"><iframe src="${src}#view=FitH" title="${esc(f.title)}"></iframe></div>`;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(f.ext)) return `<div class="player"><div class="still"><img src="${src}" alt="${esc(f.title)}" style="max-height:100%"></div></div>`;
  if (f.ext === 'mp4') return `<div class="player"><video src="${src}" controls style="position:absolute;inset:0;width:100%;height:100%;background:#000"></video></div>`;
  return `<div class="player"><div class="still">${f.thumb ? `<img src="${enc(f.thumb)}" alt="">` : `<span class="ext">${esc(EXT[f.ext] || f.ext.toUpperCase())}</span>`}
    <a class="pill dark" href="${src}" download="${esc(f.name)}">내려받기 · ${size(f.size)}</a></div></div>`;
}
function watch(id) {
  const f = BY_ID.get(id);
  if (!f) return '<div class="empty">없는 자료예요. 이름이 바뀌었을 수 있어요 — 홈에서 다시 찾아 주세요</div>';
  const l = f.lesson, u = l.unit, i = l.files.indexOf(f);
  const others = u.lessons.filter((x) => x !== l);
  const pf = portalFiles(l);
  return `<div class="watch"><div>
      ${player(f)}
      <h1 class="w-title">${esc(f.title)}</h1>
      <div class="w-bar">
        <a class="w-owner" href="#/u/${u.no}">${ava(u)}<span><b>${u.no}단원 ${esc(u.name)}</b><small>${esc(l.code)} ${esc(l.title)}</small></span></a>
        <div class="w-acts">
          ${['html', 'pdf'].includes(f.ext) ? `<a class="pill" href="${enc(f.path)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>새 창</a>` : ''}
          <a class="pill" href="${enc(f.path)}" download="${esc(f.name)}"><svg viewBox="0 0 24 24"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>내려받기</a>
          ${pf.length ? `<button class="pill dark" data-import="${esc(l.code)}">내 포털에 넣기</button>` : ''}
        </div>
      </div>
      <div class="desc-box">
        <span class="k">${esc(KIND[f.kind])} · ${size(f.size)} · ${date(f.mtime)} 올림</span>${f.portal ? ` · 포털 자리 <code class="code">${esc(f.portal)}</code>` : ''}
        <div>${esc(l.code)} ${esc(l.title)} — ${esc(count(l.files))}</div>
        ${f.kind === 'lesson' ? '<div class="note">←/→ 쪽 넘기기 · F 전체 화면 · A 답 보기 (화면을 한 번 누른 뒤)</div>' : ''}
        ${f.kind === 'sheet' ? '<div class="note">학생이 포털에서 쓰는 웹 학습지와 정답 파일은 정답이 들어 있어 공개하지 않아요</div>' : ''}
      </div>
    </div>
    <aside>
      <div class="list-box"><div class="lh"><b>${esc(l.code)} ${esc(l.title)}</b><small>${u.no}단원 ${esc(u.name)} · ${i + 1} / ${l.files.length}</small></div>
        <div class="items">${l.files.map((x, j) => miniCard(x, j + 1, x === f)).join('')}</div></div>
      <div class="side-list"><h3>같은 단원 다른 차시</h3>${others.map((x) => {
        const p = primary(x);
        return `<a class="mini-card" href="#/w/${p.id}">${thumb({ ...p, thumb: lessonThumb(x) || p.thumb }, `자료 ${x.files.length}`)}
          <div class="txt"><h4>${esc(x.code)} ${esc(x.title)}</h4><p>${esc(count(x.files).split(' · ').slice(0, 2).join(' · '))}</p></div></a>`;
      }).join('')}</div>
    </aside></div>`;
}
function search(q) {
  const t = q.trim().toLowerCase();
  const fs = FILES.filter((f) => `${f.lesson.code} ${f.lesson.title} ${f.title} ${f.name} ${KIND[f.kind]} ${f.lesson.unit.name}`.toLowerCase().includes(t));
  return `<div class="shelf-h" style="margin:12px 0 20px"><h2>“${esc(q)}” 자료 ${fs.length}개</h2></div>`
    + (fs.length ? `<div class="grid">${fs.map((f) => fileCard(f)).join('')}</div>` : '<div class="empty">찾는 자료가 없어요. 차시 번호(예: 721)나 짧은 낱말로 찾아 보세요</div>');
}

// ---------- 내 포털에 넣기 ----------
const REPO_KEY = 'share-my-repo';
const myRepo = () => localStorage.getItem(REPO_KEY) || '';
function repoParts(r) {
  const m = String(r).trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$|\/$/g, '').match(/^([\w.-]+)\/([\w.-]+)/);
  if (m) return { owner: m[1], name: m[2] };
  const p = String(r).trim().match(/^https?:\/\/([\w-]+)\.github\.io\/([\w.-]+)/); // 사이트 주소로 넣어도
  return p ? { owner: p[1], name: p[2] } : null;
}
let WORKFLOW = '';
async function workflowText() {
  if (!WORKFLOW) WORKFLOW = await (await fetch('tools/share-import.yml', { cache: 'no-cache' })).text();
  return WORKFLOW;
}
function claudePrompt(codes) {
  return `공유 자료실의 ${codes.join(', ')} 차시 수업자료·시뮬레이션을 내 포털 저장소(science-portal 복사본)에 넣고 올려 줘.\n방법: ${SITE}tools/claude.md`;
}
function importModal(codes) {
  const ls = LESSONS.filter((l) => codes.includes(l.code));
  const pf = ls.flatMap(portalFiles);
  const rest = ls.flatMap((l) => l.files.filter((f) => !f.portal));
  let tab = 'auto';
  const draw = () => {
    const r = repoParts(myRepo());
    const repoField = `<div class="field"><input id="my-repo" placeholder="내 저장소 — 예: kim/science-portal 또는 https://kim.github.io/science-portal/" value="${esc(myRepo())}"><button class="pill dark" id="repo-save">저장</button></div>`;
    const gh = r ? `https://github.com/${r.owner}/${r.name}` : '';
    const lessonUrl = r ? `https://${r.owner}.github.io/${r.name}/lessons/` : '';
    let body = '';
    if (tab === 'auto') {
      body = `<div class="g-box"><p class="eyebrow">버튼 두 번 · 처음 한 번만 ①</p>
        ${repoField}
        <ol>
          <li><b>처음 한 번</b> — ${r ? `<a class="pill white" id="wf-add" href="#">가져오기 기능 넣기</a>` : '먼저 내 저장소를 저장하세요'}<br><span class="note">GitHub 새 파일 화면이 열리면 오른쪽 위 <b>[Commit changes…]</b> → <b>[Commit changes]</b></span></li>
          <li>${r ? `<a class="pill white" href="${gh}/actions/workflows/share-import.yml" target="_blank" rel="noopener">가져오기 화면 열기</a>` : '가져오기 화면 열기'} → 오른쪽 <b>[Run workflow]</b> → 차시 칸에 <code>${esc(codes.join(' '))}</code> <button class="pill" data-copy="${esc(codes.join(' '))}" style="min-height:30px;padding:0 10px;font-size:12.5px">복사</button> → 초록 <b>[Run workflow]</b></li>
          <li>2~5분 뒤 내 포털 관리 화면 → 차시 → 수업자료 주소에 ${r ? `<code>${esc(lessonUrl)}${esc(codes[0])}.html</code>` : '<code>https://(계정).github.io/(저장소)/lessons/(차시).html</code>'}</li>
        </ol></div>`;
    } else if (tab === 'claude') {
      const p = claudePrompt(codes);
      body = `<div class="g-box"><p class="eyebrow">Claude Code에서 내 포털 폴더를 열고 붙여 넣기</p>
        <div class="code-block"><pre>${esc(p)}</pre><button class="pill" data-copy="${esc(p)}">복사</button></div>
        <p class="note">Claude가 파일을 받아 lessons·sims에 넣고, 같은 이름의 파일을 고친 적이 있으면 덮어쓰기 전에 물어봐요.</p></div>`;
    } else {
      body = `<div class="g-box"><p class="eyebrow">파일을 받아 GitHub에 직접 올리기</p>
        ${repoField}
        <ol>
          <li>아래 파일을 받기(이름이 포털 자리 이름으로 바뀌어 받아져요)
            <ul class="files-mini">${pf.map((f) => `<li><a href="${enc(f.path)}" download="${esc(f.portal.split('/').pop())}"><code>${esc(f.portal)}</code></a><span>${size(f.size)}</span></li>`).join('')}</ul></li>
          <li>${r ? `<a class="pill white" href="${gh}/upload/main/lessons" target="_blank" rel="noopener">lessons 폴더에 올리기</a>` : '내 저장소 → lessons 폴더 → [Add file] → [Upload files]'} — <code>lessons/</code> 파일을 끌어 놓고 [Commit changes]</li>
          ${pf.some((f) => f.portal.startsWith('sims/')) ? `<li>${r ? `<a class="pill white" href="${gh}/upload/main/sims" target="_blank" rel="noopener">sims 폴더에 올리기</a>` : 'sims 폴더 → [Add file] → [Upload files]'} — <code>sims/</code> 파일을 끌어 놓고 [Commit changes]</li>` : ''}
          <li>2~5분 뒤 관리 화면 → 차시 → 수업자료 주소 넣기</li>
        </ol><p class="note"><a href="#/guide" style="text-decoration:underline">자세한 안내 보기</a></p></div>`;
    }
    $('m-body').innerHTML = `<h2 id="m-title">${esc(codes.length > 1 ? `${ls[0]?.unit.no}단원 ${codes.length}개 차시` : `${codes[0]} ${ls[0]?.title || ''}`)} · 내 포털에 넣기</h2>
      <p class="sub">수업자료·시뮬레이션 ${pf.length}개가 내 포털 <code class="code">lessons/</code>·<code class="code">sims/</code>에 들어가요.${rest.length ? ` 학습지 PDF·PPT 등 ${rest.length}개는 내려받아 쓰세요.` : ''}</p>
      <div class="seg">${[['auto', '버튼으로'], ['claude', 'Claude에게'], ['hand', '손으로']].map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>${body}`;
    $('m-body').querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; draw(); });
    $('m-body').querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => copy(b.dataset.copy));
    const save = $('repo-save');
    if (save) save.onclick = () => {
      const v = $('my-repo').value;
      if (!repoParts(v)) { toast('계정/저장소 모양으로 넣어 주세요'); return; }
      const p = repoParts(v); localStorage.setItem(REPO_KEY, `${p.owner}/${p.name}`); draw(); toast('저장했어요');
    };
    const add = $('wf-add');
    if (add) add.onclick = async (e) => {
      e.preventDefault();
      const w = window.open('', '_blank');
      const text = await workflowText();
      w.location = `${gh}/new/main?filename=${encodeURIComponent('.github/workflows/share-import.yml')}&value=${encodeURIComponent(text)}`;
    };
  };
  draw();
  $('modal').hidden = false;
}
$('m-close').onclick = () => { $('modal').hidden = true; };
$('modal').onclick = (e) => { if (e.target === $('modal')) $('modal').hidden = true; };
addEventListener('keydown', (e) => { if (e.key === 'Escape') $('modal').hidden = true; });

function guide() {
  const r = repoParts(myRepo());
  return `<div class="guide">
    <h1>내 포털에 넣는 법</h1>
    <p class="lead">과학 포털을 복사해 쓰는 선생님(내 <code class="code">science-portal</code> 저장소가 있는 선생님)이 이 자료실의 수업자료·시뮬레이션을 내 포털로 가져오는 방법이에요. 학습지 PDF·PPT·퀴즈는 [내려받기]로 바로 쓰면 돼요.</p>

    <div class="g-box"><h2><span class="no">1</span>버튼으로 (가장 쉬움)</h2>
      <p class="eyebrow">처음 한 번 준비하면, 다음부터는 차시 번호만 넣으면 돼요</p>
      <ol>
        <li>자료를 열고 <b>[내 포털에 넣기]</b> → <b>[버튼으로]</b></li>
        <li>내 저장소(예: <code>kim/science-portal</code>)를 넣고 <b>[저장]</b> — 이 컴퓨터가 기억해요</li>
        <li><b>처음 한 번</b>: <b>[가져오기 기능 넣기]</b> → GitHub 새 파일 화면 오른쪽 위 <b>[Commit changes…]</b> → <b>[Commit changes]</b><br>
          <span class="note">GitHub에 로그인돼 있어야 해요. 안 열리면 아래 '손으로 기능 넣기'를 보세요.</span></li>
        <li><b>[가져오기 화면 열기]</b> → 오른쪽 <b>[Run workflow]</b> → '가져올 차시' 칸에 <code>721</code>(여러 개는 <code>721 722</code>) → 초록 <b>[Run workflow]</b></li>
        <li>1~2분 뒤 목록에 초록 체크가 뜨면 끝. 사이트에는 2~5분 뒤 보여요</li>
        <li>내 포털 관리 화면 → 차시 → 수업자료 주소에 <code>https://(계정).github.io/(저장소)/lessons/721.html</code></li>
      </ol>
      <p class="note">손으로 기능 넣기: 내 저장소 → [Add file] → [Create new file] → 이름 칸에 <code>.github/workflows/share-import.yml</code> → <a href="tools/share-import.yml" target="_blank" style="text-decoration:underline">이 내용</a>을 통째로 붙여 넣기 → [Commit changes]</p>
    </div>

    <div class="g-box"><h2><span class="no">2</span>Claude에게 맡기기</h2>
      <p class="eyebrow">Claude Code를 쓰는 선생님</p>
      <ol>
        <li>Claude Code에서 내 포털 폴더(<code>science-portal</code>)를 열기</li>
        <li>자료의 <b>[내 포털에 넣기]</b> → <b>[Claude에게]</b> → <b>[복사]</b> → Claude에 붙여 넣기</li>
        <li>Claude가 받아 넣고 올리면, 관리 화면에서 수업자료 주소만 넣기</li>
      </ol>
    </div>

    <div class="g-box"><h2><span class="no">3</span>손으로 넣기</h2>
      <p class="eyebrow">버튼이 막혔을 때</p>
      <ol>
        <li>자료의 <b>[내 포털에 넣기]</b> → <b>[손으로]</b>에서 파일을 하나씩 받기. 받은 이름이 포털에서 쓰는 이름이에요
          (수업자료 <code>lesson_721.html</code> → <code>721.html</code>, 시뮬레이션은 이름 그대로)</li>
        <li>GitHub 내 저장소 → <code>lessons</code> 폴더 → <b>[Add file]</b> → <b>[Upload files]</b> → 수업자료 파일을 끌어 놓기 → <b>[Commit changes]</b>${r ? ` (<a href="https://github.com/${esc(r.owner)}/${esc(r.name)}/upload/main/lessons" target="_blank" rel="noopener" style="text-decoration:underline">바로 가기</a>)` : ''}</li>
        <li>같은 방법으로 <code>sims</code> 폴더에 시뮬레이션 파일들${r ? ` (<a href="https://github.com/${esc(r.owner)}/${esc(r.name)}/upload/main/sims" target="_blank" rel="noopener" style="text-decoration:underline">바로 가기</a>)` : ''}</li>
        <li>2~5분 뒤 사이트에서 <code>https://(계정).github.io/(저장소)/lessons/721.html</code>가 열리면 관리 화면 → 차시 → 수업자료 주소에 넣기</li>
      </ol>
      <p class="note">같은 이름 파일이 이미 있으면 새 파일로 바뀌어요(예전 것은 GitHub 기록에 남아요). 이름에 한글이 든 5단원 시뮬레이션은 포털 자리가 없어 [내려받기]로만 써요.</p>
    </div>

    <div class="g-box"><h2><span class="no">4</span>학습지는</h2>
      <ol>
        <li>인쇄용 학습지 PDF는 [내려받기]로 받아 인쇄해요</li>
        <li>학생이 포털에서 쓰는 웹 학습지(칸·정답 포함)는 정답이 있어 여기 올리지 않아요. 과학 포털을 복사해 쓰면 매일 새벽 내 서버로 들어와요</li>
      </ol>
    </div>
  </div>`;
}

// ---------- 길 ----------
function setNav(key) {
  document.querySelectorAll('.side a').forEach((a) => a.classList.toggle('on', a.dataset.nav === key));
}
function route() {
  const h = decodeURIComponent(location.hash.slice(1) || '/');
  const [, a, b, c] = h.split('/');
  let html, nav = 'home';
  document.body.classList.toggle('watching', a === 'w');
  if (a === 'w') { html = watch(b); nav = ''; }
  else if (a === 'u') { html = unit(b, c); nav = `u${b}`; }
  else if (a === 'k') html = home(b);
  else if (a === 'recent') { html = recent(); nav = 'recent'; }
  else if (a === 's') { html = search(h.slice(3)); nav = ''; $('q').value = h.slice(3); }
  else if (a === 'guide') { html = guide(); nav = 'guide'; }
  else html = home();
  $('main').innerHTML = html;
  setNav(nav);
  wireShelves();
  $('main').querySelectorAll('[data-import]').forEach((x) => x.onclick = () => importModal(x.dataset.import.split(' ')));
  document.body.classList.remove('open');
  scrollTo(0, 0);
  const f = a === 'w' && BY_ID.get(b);
  document.title = f ? `${f.title} · 과학 1 자료실` : '과학 1 자료실';
}

function sideUnits() {
  $('units').innerHTML = UNITS.map((u) => `<a href="#/u/${u.no}" data-nav="u${u.no}">${ava(u)}<span>${u.no}단원 ${esc(u.name)}</span>
    ${Date.now() / 1000 - u.updated < 7 * DAY ? '<i class="new" title="최근 7일 새 자료"></i>' : ''}</a>`).join('');
}

$('menu').onclick = () => {
  if (matchMedia('(max-width:1100px)').matches || document.body.classList.contains('watching')) document.body.classList.toggle('open');
  else document.body.classList.toggle('mini');
};
$('shade').onclick = () => document.body.classList.remove('open');
$('search').onsubmit = (e) => { e.preventDefault(); const q = $('q').value.trim(); if (q) location.hash = `#/s/${encodeURIComponent(q)}`; };

(async () => {
  try {
    CAT = await (await fetch('catalog.json', { cache: 'no-cache' })).json();
  } catch {
    $('main').innerHTML = '<div class="empty">자료 목록을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요</div>';
    return;
  }
  CAT.kinds.forEach((k) => { KIND[k.id] = k.name; });
  UNITS = CAT.units;
  for (const u of UNITS) for (const l of u.lessons) {
    l.unit = u; LESSONS.push(l);
    for (const f of l.files) { f.lesson = l; FILES.push(f); BY_ID.set(f.id, f); }
  }
  sideUnits();
  addEventListener('hashchange', route);
  route();
})();
