// 과학 자료실 — catalog.json 하나로 그리는 정적 사이트(서버 없음). catalog.json은 관리 앱(share.py)이 만든다.
// 화면 부품은 Astryx(React, 빌드 없이 CDN). JSX 대신 h(...)로 쓴다.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Badge, TextInput, TabList, Tab, Dialog } from '@astryxdesign/core';
const h = React.createElement;
const F = React.Fragment;

// ---------- 글자 도우미 ----------
const DAY = 86400;
const SITE = new URL('./', location.href).href;
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const ago = (t) => { const s = Date.now() / 1000 - t; if (s < 3600) return '방금'; if (s < DAY) return `${Math.floor(s / 3600)}시간 전`; if (s < 30 * DAY) return `${Math.floor(s / DAY)}일 전`; if (s < 365 * DAY) return `${Math.floor(s / (30 * DAY))}개월 전`; return `${Math.floor(s / (365 * DAY))}년 전`; };
const size = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`;
const date = (t) => new Date(t * 1000).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const EXT = { pptx: 'PPT', ppt: 'PPT', key: 'KEY', docx: 'DOCX', hwp: 'HWP', hwpx: 'HWP', xlsx: 'XLSX', pdf: 'PDF', jpg: 'JPG', png: 'PNG', mp4: 'MP4', html: 'HTML' };
const extName = (f) => EXT[f.ext] || f.ext.toUpperCase();
const badgeOf = (f) => f.kind === 'lesson' && f.slides ? `${f.slides}쪽` : f.kind === 'sim' ? '시뮬레이션' : extName(f);
const primary = (l) => l.files.find((f) => f.kind === 'lesson') || l.files.find((f) => f.kind === 'sim') || l.files.find((f) => f.thumb) || l.files[0];
const lessonThumb = (l) => (l.files.find((f) => f.kind === 'lesson' && f.thumb) || l.files.find((f) => f.kind === 'sim' && f.thumb) || l.files.find((f) => f.thumb) || {}).thumb;
const portalFiles = (l) => l.files.filter((f) => f.portal);
const isNew = (t) => Date.now() / 1000 - t < 7 * DAY;
const go = (path) => { location.hash = '#' + path; };
function download(f) { const a = document.createElement('a'); a.href = enc(f.path); a.download = f.name; a.click(); }

let toastSet = () => {};
const toast = (t) => toastSet(t);
async function copy(t) {
  try { await navigator.clipboard.writeText(t); toast('복사했어요'); }
  catch { prompt('아래 글을 복사하세요', t); }
}
let importOpen = () => {};

// ---------- 아이콘 (선 아이콘) ----------
const svg = (d) => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': true }, d.map((x, i) => typeof x === 'string' ? h('path', { key: i, d: x }) : h(x[0], { key: i, ...x[1] })));
const ICON = {
  home: () => svg(['M4 11 12 4l8 7v9h-5v-6H9v6H4z']),
  recent: () => svg([['circle', { cx: 12, cy: 12, r: 8 }], 'M12 8v4l3 2']),
  guide: () => svg(['M5 4h10l4 4v12H5z', 'M9 12h6M9 16h6']),
  menu: () => svg(['M3 6h18M3 12h18M3 18h18']),
};

// ---------- 조각 ----------
const Ava = ({ u, big }) => h('span', { className: big ? 'ava big' : 'ava', 'aria-hidden': true }, u.roman);
function Thumb({ f, label }) {
  const doc = f.thumb && !['html', 'jpg', 'png', 'mp4'].includes(f.ext);
  return h('div', { className: doc ? 'thumb doc' : 'thumb' },
    f.thumb ? h('img', { src: enc(f.thumb), alt: '', loading: 'lazy' }) : h('span', { className: 'ext' }, extName(f)),
    label && h(Badge, { label }));
}
function LessonCard({ l, C }) {
  const p = primary(l), u = l.unit;
  return h('a', { className: 'card', href: `#/w/${p.id}` },
    h(Thumb, { f: { ...p, thumb: lessonThumb(l) || p.thumb }, label: `자료 ${l.files.length}` }),
    h('div', { className: 'meta' }, h(Ava, { u }),
      h('div', null,
        h('h3', null, `${l.code} ${l.title}`),
        h('p', null, `${u.no}단원 ${u.name}`),
        h('p', null, `${C.count(l.files).split(' · ').slice(0, 2).join(' · ')} · ${ago(l.updated)}`),
        isNew(l.updated) && h('div', { style: { marginTop: 6 } }, h(Badge, { variant: 'neutral', label: '새 자료' })))));
}
function FileCard({ f, C, ava = true }) {
  const l = f.lesson;
  return h('a', { className: 'card', href: `#/w/${f.id}` },
    h(Thumb, { f, label: badgeOf(f) }),
    h('div', { className: 'meta' }, ava && h(Ava, { u: l.unit }),
      h('div', null,
        h('h3', null, f.title),
        h('p', null, `${l.code} ${l.title}`),
        h('p', null, `${C.KIND[f.kind]} · ${size(f.size)} · ${ago(f.mtime)}`))));
}
function Chips({ C, on }) {
  const ks = C.cat.kinds.filter((k) => C.files.some((f) => f.kind === k.id));
  const items = [['/', '전체'], ...ks.map((k) => [`/k/${k.id}`, k.name]), ['/recent', '최근에 올라온 자료']];
  return h('div', { className: 'chips', role: 'toolbar', 'aria-label': '종류' },
    items.map(([path, name]) => h(Button, { key: path, label: name, 'aria-pressed': path === on, onClick: () => go(path) })));
}

// ---------- 화면 ----------
function Home({ C, kind }) {
  if (!kind) {
    const ls = [...C.lessons].sort((a, b) => b.updated - a.updated);
    return h(F, null, h(Chips, { C, on: '/' }), h('div', { className: 'grid' }, ls.map((l) => h(LessonCard, { key: l.code, l, C }))));
  }
  const fs = C.files.filter((f) => f.kind === kind).sort((a, b) => b.mtime - a.mtime);
  return h(F, null, h(Chips, { C, on: `/k/${kind}` }), h('div', { className: 'grid' }, fs.map((f) => h(FileCard, { key: f.id, f, C }))));
}
function Recent({ C }) {
  const fs = [...C.files].sort((a, b) => b.mtime - a.mtime).slice(0, 60);
  return h(F, null, h(Chips, { C, on: '/recent' }), h('div', { className: 'grid' }, fs.map((f) => h(FileCard, { key: f.id, f, C }))));
}
function Unit({ C, no, tab }) {
  const u = C.units.find((x) => String(x.no) === no);
  if (!u) return h('div', { className: 'empty' }, '없는 단원이에요');
  const files = u.lessons.flatMap((l) => l.files);
  const ks = C.cat.kinds.filter((k) => files.some((f) => f.kind === k.id));
  const codes = u.lessons.filter((l) => portalFiles(l).length).map((l) => l.code);
  return h(F, null,
    h('div', { className: 'banner' }, h('small', null, `${u.roman} 단원`), h('h1', null, u.name)),
    h('div', { className: 'chan' }, h(Ava, { u, big: true }),
      h('div', null,
        h('h2', null, `${u.no}단원 ${u.name}`),
        h('p', null, h('b', null, `차시 ${u.lessons.length}개`), ` · 자료 ${files.length}개 · ${ago(u.updated)} 갱신`),
        h('p', null, C.count(files)),
        h('div', { className: 'btns' },
          codes.length > 0 && h(Button, { label: '이 단원 내 포털에 넣기', variant: 'primary', onClick: () => importOpen(codes) }),
          h(Button, { label: '첫 차시부터 보기', onClick: () => go(`/w/${primary(u.lessons[0]).id}`) })))),
    h('div', { className: 'tabs' },
      h(TabList, { value: tab || 'home', onChange: (v) => go(v === 'home' ? `/u/${u.no}` : `/u/${u.no}/${v}`), hasDivider: true },
        h(Tab, { value: 'home', label: '홈' }),
        ks.map((k) => h(Tab, { key: k.id, value: k.id, label: k.name })))),
    !tab
      ? u.lessons.map((l) => h('section', { key: l.code, className: 'shelf' },
          h('h2', null, `${l.code} ${l.title}`),
          h('div', { className: 'row' }, l.files.map((f) => h(FileCard, { key: f.id, f, C, ava: false })))))
      : h('div', { className: 'grid' }, files.filter((f) => f.kind === tab).map((f) => h(FileCard, { key: f.id, f, C, ava: false }))));
}
function Player({ f }) {
  const src = enc(f.path);
  if (f.ext === 'html') return h('div', { className: 'player' }, h('iframe', { src, title: f.title, allow: 'fullscreen', loading: 'lazy' }));
  if (f.ext === 'pdf') return h('div', { className: 'player tall' }, h('iframe', { src: `${src}#view=FitH`, title: f.title }));
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(f.ext)) return h('div', { className: 'player' }, h('div', { className: 'still' }, h('img', { src, alt: f.title })));
  if (f.ext === 'mp4') return h('div', { className: 'player' }, h('video', { src, controls: true }));
  return h('div', { className: 'player' }, h('div', { className: 'still' },
    f.thumb ? h('img', { src: enc(f.thumb), alt: '' }) : h('span', { className: 'ext' }, extName(f)),
    h(Button, { label: `내려받기 · ${size(f.size)}`, variant: 'primary', onClick: () => download(f) })));
}
function Watch({ C, id }) {
  const f = C.byId.get(id);
  useEffect(() => { document.title = f ? `${f.title} · 과학 자료실` : '과학 자료실'; return () => { document.title = '과학 자료실'; }; }, [f]);
  if (!f) return h('div', { className: 'empty' }, '없는 자료예요. 이름이 바뀌었을 수 있어요 — 홈에서 다시 찾아 주세요');
  const l = f.lesson, u = l.unit, i = l.files.indexOf(f);
  const others = u.lessons.filter((x) => x !== l);
  return h('div', { className: 'watch' },
    h('div', null,
      h(Player, { f }),
      h('h1', { className: 'w-title' }, f.title),
      h('div', { className: 'w-bar' },
        h('a', { className: 'w-owner', href: `#/u/${u.no}` }, h(Ava, { u }), h('span', null, h('b', null, `${u.no}단원 ${u.name}`), h('small', null, `${l.code} ${l.title}`))),
        h('div', { className: 'btns', style: { marginTop: 0 } },
          ['html', 'pdf'].includes(f.ext) && h(Button, { label: '새 창', onClick: () => open(enc(f.path), '_blank', 'noopener') }),
          h(Button, { label: '내려받기', onClick: () => download(f) }),
          portalFiles(l).length > 0 && h(Button, { label: '내 포털에 넣기', variant: 'primary', onClick: () => importOpen([l.code]) }))),
      h('div', { className: 'desc-box' },
        h('span', { className: 'k' }, `${C.KIND[f.kind]} · ${size(f.size)} · ${date(f.mtime)} 올림`),
        f.portal && h(F, null, ' · 포털 자리 ', h('code', null, f.portal)),
        h('div', null, `${l.code} ${l.title} — ${C.count(l.files)}`),
        f.kind === 'lesson' && h('div', { className: 'note' }, '←/→ 쪽 넘기기 · F 전체 화면 · A 답 보기 (화면을 한 번 누른 뒤)'),
        f.kind === 'sheet' && h('div', { className: 'note' }, '학생이 포털에서 쓰는 웹 학습지와 정답 파일은 정답이 들어 있어 공개하지 않아요'))),
    h('aside', null,
      h('div', { className: 'list-box' },
        h('div', { className: 'lh' }, h('b', null, `${l.code} ${l.title}`), h('small', null, `${u.no}단원 ${u.name} · ${i + 1} / ${l.files.length}`)),
        l.files.map((x, j) => h('a', { key: x.id, className: x === f ? 'mini on' : 'mini', href: `#/w/${x.id}`, 'aria-current': x === f ? 'page' : undefined },
          h('span', { className: 'n' }, x === f ? '▶' : j + 1), h(Thumb, { f: x, label: badgeOf(x) }),
          h('div', null, h('h4', null, x.title), h('p', null, `${C.KIND[x.kind]} · ${size(x.size)}`))))),
      h('div', { className: 'side-list' }, h('h3', null, '같은 단원 다른 차시'),
        others.map((x) => { const p = primary(x);
          return h('a', { key: x.code, className: 'mini no-n', href: `#/w/${p.id}` },
            h(Thumb, { f: { ...p, thumb: lessonThumb(x) || p.thumb }, label: `자료 ${x.files.length}` }),
            h('div', null, h('h4', null, `${x.code} ${x.title}`), h('p', null, C.count(x.files).split(' · ').slice(0, 2).join(' · ')))); }))));
}
function Search({ C, q }) {
  const t = q.trim().toLowerCase();
  const fs = C.files.filter((f) => `${f.lesson.code} ${f.lesson.title} ${f.title} ${f.name} ${C.KIND[f.kind]} ${f.lesson.unit.name}`.toLowerCase().includes(t));
  return h(F, null, h('h2', { className: 'result-h' }, `“${q}” 자료 ${fs.length}개`),
    fs.length ? h('div', { className: 'grid' }, fs.map((f) => h(FileCard, { key: f.id, f, C })))
              : h('div', { className: 'empty' }, '찾는 자료가 없어요. 차시 번호(예: 721)나 짧은 낱말로 찾아 보세요'));
}

// ---------- 내 포털에 넣는 법 ----------
const REPO_KEY = 'share-my-repo';
function repoParts(r) {
  const m = String(r).trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$|\/$/g, '').match(/^([\w.-]+)\/([\w.-]+)/);
  if (m) return { owner: m[1], name: m[2] };
  const p = String(r).trim().match(/^https?:\/\/([\w-]+)\.github\.io\/([\w.-]+)/);
  return p ? { owner: p[1], name: p[2] } : null;
}
function Guide() {
  const r = repoParts(localStorage.getItem(REPO_KEY) || '');
  const up = (dir) => r && h(F, null, ' (', h('a', { href: `https://github.com/${r.owner}/${r.name}/upload/main/${dir}`, target: '_blank', rel: 'noopener' }, '바로 가기'), ')');
  return h('div', { className: 'guide' },
    h('h1', null, '내 포털에 넣는 법'),
    h('p', { className: 'lead' }, '과학 포털을 복사해 쓰는 선생님(내 ', h('code', null, 'science-portal'), ' 저장소가 있는 선생님)이 이 자료실의 수업자료·시뮬레이션을 내 포털로 가져오는 방법이에요. 학습지 PDF·PPT·퀴즈는 [내려받기]로 바로 쓰면 돼요.'),
    h('div', { className: 'g-box' }, h('h2', null, h('span', { className: 'no' }, '1'), 'GitHub로 로그인해서 넣기 (가장 쉬움)'),
      h('ol', null,
        h('li', null, '넣고 싶은 자료나 단원에서 ', h('b', null, '[내 포털에 넣기]')),
        h('li', null, h('b', null, '[GitHub로 로그인하고 넣기]'), ' → GitHub 화면에서 초록 ', h('b', null, '[Authorize]')),
        h('li', null, '자료실로 돌아오면 내 포털을 찾아 저절로 넣어요(1분쯤). 포털이 여러 개면 고르기만 하면 돼요'),
        h('li', null, '3분쯤 뒤 내 포털 ', h('b', null, '관리 화면 → 차시'), '에서 수업자료 주소 칸에 보여 준 주소를 붙여 넣기')),
      h('p', { className: 'note' }, '로그인은 이 창을 닫으면 사라져요. 자료실은 내 포털의 수업자료·시뮬레이션 파일만 넣고 다른 것은 건드리지 않아요.')),
    h('div', { className: 'g-box' }, h('h2', null, h('span', { className: 'no' }, '2'), 'Claude에게 맡기기'),
      h('p', { className: 'eyebrow' }, 'Claude Code를 쓰는 선생님'),
      h('ol', null,
        h('li', null, 'Claude Code에서 내 포털 폴더(', h('code', null, 'science-portal'), ')를 열기'),
        h('li', null, '자료의 ', h('b', null, '[내 포털에 넣기]'), ' → ', h('b', null, '[Claude Code로 넣기]'), ' → ', h('b', null, '[복사]'), ' → Claude에 붙여 넣기'),
        h('li', null, 'Claude가 받아 넣고 올리면, 관리 화면에서 수업자료 주소만 넣기'))),
    h('div', { className: 'g-box' }, h('h2', null, h('span', { className: 'no' }, '3'), '손으로 넣기'),
      h('p', { className: 'eyebrow' }, '버튼이 막혔을 때'),
      h('ol', null,
        h('li', null, '자료의 ', h('b', null, '[내 포털에 넣기]'), ' → ', h('b', null, '[파일 받아서 직접 넣기]'), '에서 파일을 하나씩 받기. 받은 이름이 포털에서 쓰는 이름이에요 (수업자료 ', h('code', null, 'lesson_721.html'), ' → ', h('code', null, '721.html'), ', 시뮬레이션은 이름 그대로)'),
        h('li', null, 'GitHub 내 저장소 → ', h('code', null, 'lessons'), ' 폴더 → ', h('b', null, '[Add file]'), ' → ', h('b', null, '[Upload files]'), ' → 수업자료 파일을 끌어 놓기 → ', h('b', null, '[Commit changes]'), up('lessons')),
        h('li', null, '같은 방법으로 ', h('code', null, 'sims'), ' 폴더에 시뮬레이션 파일들', up('sims')),
        h('li', null, '2~5분 뒤 사이트에서 ', h('code', null, 'https://(계정).github.io/(저장소)/lessons/721.html'), '가 열리면 관리 화면 → 차시 → 수업자료 주소에 넣기')),
      h('p', { className: 'note' }, '같은 이름 파일이 이미 있으면 새 파일로 바뀌어요(예전 것은 GitHub 기록에 남아요). 이름에 한글이 든 5단원 시뮬레이션은 포털 자리가 없어 [내려받기]로만 써요.')),
    h('div', { className: 'g-box' }, h('h2', null, h('span', { className: 'no' }, '4'), '학습지는'),
      h('ol', null,
        h('li', null, '인쇄용 학습지 PDF는 [내려받기]로 받아 인쇄해요'),
        h('li', null, '학생이 포털에서 쓰는 웹 학습지(칸·정답 포함)는 정답이 있어 여기 올리지 않아요. 과학 포털을 복사해 쓰면 매일 새벽 내 서버로 들어와요'))));
}

// ---------- 내 포털에 넣기 (GitHub 로그인) ----------
// 로그인 앱·중계는 과학 포털 설치 화면과 같은 것(비밀값은 중계 함수에만 있음)
const GH_CLIENT = 'Ov23liVMJkX5tXQpuj0Y';
const RELAY = 'https://sxejmhkevefwnpwldczt.supabase.co/functions/v1/setup-relay';
const HERE = location.origin + location.pathname.replace(/index\.html$/, '');  // GitHub에 등록한 주소와 글자까지 같게: https://a11y526.github.io/science-share/
const LIVE_HOST = 'a11y526.github.io';
const tokenGet = () => sessionStorage.getItem('gh-token');
const claudePrompt = (codes) => `공유 자료실의 ${codes.join(', ')} 차시 수업자료·시뮬레이션을 내 포털 저장소(science-portal 복사본)에 넣고 올려 줘.\n방법: ${SITE}tools/claude.md`;
async function gh(method, path, body) {
  const r = await fetch('https://api.github.com' + path, {
    method, headers: { authorization: `Bearer ${tokenGet()}`, accept: 'application/vnd.github+json', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.message || `GitHub ${r.status}`); e.status = r.status; throw e; }
  return d;
}
function b64(buf) {
  const u = new Uint8Array(buf); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function login(codes) {
  if (location.host !== LIVE_HOST) { toast('로그인은 실제 자료실(a11y526.github.io/science-share)에서만 돼요'); return; }  // 미리보기에서는 GitHub가 돌려보내 주지 않음
  const state = 'sh-' + crypto.getRandomValues(new Uint32Array(2)).join('');
  sessionStorage.setItem('gh-state', state);
  sessionStorage.setItem('gh-codes', codes.join(' '));
  sessionStorage.setItem('gh-back', location.hash);
  const u = new URL('https://github.com/login/oauth/authorize');
  u.search = new URLSearchParams({ client_id: GH_CLIENT, redirect_uri: HERE, scope: 'public_repo', state, allow_signup: 'false' });
  location.href = u.toString();
}
async function comeBack() {
  const q = new URLSearchParams(location.search);
  if (!q.get('code') && !q.get('error')) return null;
  const back = sessionStorage.getItem('gh-back') || '#/';
  history.replaceState(null, '', HERE + back);
  const codes = (sessionStorage.getItem('gh-codes') || '').split(' ').filter(Boolean);
  const ok = q.get('state') && q.get('state') === sessionStorage.getItem('gh-state');
  sessionStorage.removeItem('gh-state');
  if (q.get('error') || !ok || !codes.length) return { codes, err: '로그인을 취소했어요. 다시 눌러 주세요.' };
  try {
    const r = await fetch(RELAY + '/gh-token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: q.get('code') }) });
    const d = await r.json();
    if (!d.token) throw new Error();
    sessionStorage.setItem('gh-token', d.token);
    return { codes, go: true };
  } catch { return { codes, err: 'GitHub 연결이 안 됐어요. 다시 눌러 주세요.' }; }
}
// 내 포털 저장소 찾기: 내 저장소 중 assets/js/site.js가 있는 것
async function findPortals() {
  const repos = await gh('GET', '/user/repos?per_page=100&affiliation=owner&sort=pushed');
  const cand = repos.filter((x) => !x.archived && (x.fork || /portal|science|과학/i.test(x.name)));
  const out = [];
  for (const x of cand.slice(0, 15)) {
    try { await gh('GET', `/repos/${x.full_name}/contents/assets/js/site.js`); out.push(x); } catch {}
  }
  return out;
}
async function putFiles(repo, files, msg, progress) {
  const br = repo.default_branch;
  const ref = await gh('GET', `/repos/${repo.full_name}/git/ref/heads/${br}`);
  const base = await gh('GET', `/repos/${repo.full_name}/git/commits/${ref.object.sha}`);
  const tree = [];
  for (const [i, f] of files.entries()) {
    progress(i, files.length);
    const buf = await (await fetch(enc(f.path), { cache: 'no-cache' })).arrayBuffer();
    const blob = await gh('POST', `/repos/${repo.full_name}/git/blobs`, { content: b64(buf), encoding: 'base64' });
    tree.push({ path: f.portal, mode: '100644', type: 'blob', sha: blob.sha });
  }
  progress(files.length, files.length);
  const t = await gh('POST', `/repos/${repo.full_name}/git/trees`, { base_tree: base.tree.sha, tree });
  if (t.sha === base.tree.sha) return { same: true };
  const c = await gh('POST', `/repos/${repo.full_name}/git/commits`, { message: msg, tree: t.sha, parents: [ref.object.sha] });
  await gh('PATCH', `/repos/${repo.full_name}/git/refs/heads/${br}`, { sha: c.sha });
  try { await gh('POST', `/repos/${repo.full_name}/pages/builds`); } catch {}
  return { sha: c.sha };
}

function ImportBody({ C, codes, start }) {
  const ls = C.lessons.filter((l) => codes.includes(l.code));
  const pf = ls.flatMap(portalFiles);
  const lessonFiles = pf.filter((f) => f.portal.startsWith('lessons/'));
  const nSim = pf.length - lessonFiles.length;
  const rest = ls.flatMap((l) => l.files.filter((f) => !f.portal));
  const what = [lessonFiles.length && `수업자료 ${lessonFiles.length}개`, nSim && `시뮬레이션 ${nSim}개`].filter(Boolean).join('와 ');
  const title = codes.length > 1 ? `${ls[0]?.unit.no}단원 수업자료` : `${codes[0]} ${ls[0]?.title || ''}`;
  const [st, setSt] = useState({ phase: 'start', err: start?.err || '' });
  const [more, setMore] = useState('');

  const fail = (e) => {
    if (e.status === 401) sessionStorage.removeItem('gh-token');
    setSt({ phase: 'start', err: e.status === 401 ? '로그인이 끝났어요. 다시 눌러 주세요.' : e.status === 403 || e.status === 404 ? '이 포털에 넣을 권한이 없어요. 내 계정의 포털인지 확인해 주세요.' : `잘 안 됐어요: ${e.message}` });
  };
  const put = async (repo) => {
    setSt({ phase: 'busy', msg: '파일을 넣는 중…', n: 0, total: pf.length });
    try {
      const r = await putFiles(repo, pf, `공유 자료 가져오기: ${codes.join(' ')}`, (n, total) => setSt({ phase: 'busy', n, total, msg: n < total ? '파일을 넣는 중…' : '마무리하는 중…' }));
      setSt({ phase: 'done', repo, same: !!r.same });
    } catch (e) { fail(e); }
  };
  const run = async () => {
    setSt({ phase: 'busy', msg: '내 포털을 찾는 중…' });
    try {
      const repos = await findPortals();
      if (!repos.length) { setSt({ phase: 'start', err: '내 GitHub 계정에서 과학 포털을 찾지 못했어요. 아래 다른 방법으로 넣어 주세요.' }); return; }
      if (repos.length > 1) { setSt({ phase: 'pick', repos }); return; }
      put(repos[0]);
    } catch (e) { fail(e); }
  };
  useEffect(() => { if (start?.go) run(); }, []);

  let main = null;
  if (st.phase === 'start') {
    main = h('div', { className: 'big-go' },
      h(Button, { label: tokenGet() ? '내 포털에 넣기' : 'GitHub로 로그인하고 넣기', variant: 'primary', size: 'lg', onClick: () => (tokenGet() ? run() : login(codes)) }),
      h('p', { className: 'note' }, 'GitHub 화면이 열리면 초록 ', h('b', null, '[Authorize]'), '만 누르세요. 나머지는 자동으로 해요.'),
      st.err && h('p', { className: 'err' }, st.err));
  } else if (st.phase === 'pick') {
    main = h(F, null, h('p', { className: 'note' }, '어느 포털에 넣을까요?'),
      h('div', { className: 'pick' }, st.repos.map((r) => h(Button, { key: r.full_name, label: r.full_name, onClick: () => put(r) }))));
  } else if (st.phase === 'busy') {
    const pct = st.total ? Math.round(st.n / st.total * 100) : 0;
    main = h('div', { className: 'big-go' }, h('p', { className: 'busy-t' }, st.msg), h('div', { className: 'bar' }, h('i', { style: { width: `${pct}%` } })),
      h('p', { className: 'note' }, `${st.total ? `${st.n} / ${st.total} ` : ''}창을 닫지 말고 기다려 주세요`));
  } else if (st.phase === 'done') {
    const site = `https://${st.repo.owner.login}.github.io/${st.repo.name}/`;
    main = h(F, null,
      h('div', { className: 'done-box2' }, h(Badge, { variant: 'success', label: st.same ? '이미 들어 있어요' : '넣었어요' }),
        h('p', { style: { margin: '8px 0 0' } }, h('b', null, st.repo.full_name), `에 ${what}${st.same ? '가 이미 같은 내용으로 있어요.' : '를 넣었어요.'}`)),
      h('ol', { className: 'mini-steps' },
        h('li', null, `${st.same ? '' : '3분쯤 뒤 '}내 포털 `, h('b', null, '관리 화면 → 차시'), '를 열기'),
        h('li', null, '수업자료 주소 칸에 아래 주소를 붙여 넣고 저장')),
      h('ul', { className: 'files-mini' }, lessonFiles.map((f) => h('li', { key: f.id }, h('code', null, site + f.portal), h(Button, { label: '복사', size: 'sm', onClick: () => copy(site + f.portal) })))));
  }
  let extra = null;
  if (more === 'claude') {
    const p = claudePrompt(codes);
    extra = h('div', { className: 'g-box' }, h('p', { className: 'note', style: { margin: 0 } }, 'Claude Code에서 내 포털 폴더를 열고 아래 글을 붙여 넣으세요.'),
      h('div', { className: 'code-block' }, h('pre', null, p), h(Button, { label: '복사', size: 'sm', onClick: () => copy(p) })));
  } else if (more === 'hand') {
    extra = h('div', { className: 'g-box' }, h('p', { className: 'note', style: { margin: '0 0 6px' } }, '파일을 받아 GitHub에 직접 올려요. 순서는 ', h('a', { href: '#/guide' }, '안내 화면'), '에 있어요.'),
      h('ul', { className: 'files-mini' }, pf.map((f) => h('li', { key: f.id }, h('a', { href: enc(f.path), download: f.portal.split('/').pop() }, f.title), h('span', null, size(f.size))))));
  }
  const toggle = (k) => setMore(more === k ? '' : k);
  return h('div', { className: 'im' },
    h('h2', null, title, h('br'), '내 포털에 넣기'),
    h('p', { className: 'sub' }, `${what}를 내 포털로 바로 넣어요.${rest.length ? ' 학습지 PDF·PPT는 자료 화면의 [내려받기]로 받으세요.' : ''}`),
    main,
    st.phase !== 'busy' && h(F, null,
      h('div', { className: 'other' }, '로그인이 안 되면 ',
        h('button', { className: more === 'claude' ? 'link on' : 'link', onClick: () => toggle('claude') }, 'Claude Code로 넣기'), ' · ',
        h('button', { className: more === 'hand' ? 'link on' : 'link', onClick: () => toggle('hand') }, '파일 받아서 직접 넣기')),
      extra));
}

// ---------- 틀 ----------
function useHash() {
  const [hash, set] = useState(location.hash);
  useEffect(() => { const on = () => { set(location.hash); scrollTo(0, 0); }; addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return decodeURIComponent(hash.slice(1) || '/');
}
function useNarrow() {
  const mq = matchMedia('(max-width:1100px)');
  const [n, set] = useState(mq.matches);
  useEffect(() => { const on = () => set(mq.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);
  return n;
}
function Side({ C, nav }) {
  const item = (href, key, icon, label, end) => h('a', { href, className: nav === key ? 'on' : undefined, 'aria-current': nav === key ? 'page' : undefined }, icon, h('span', null, label), end);
  return h('aside', { className: 'side', id: 'side' },
    h('nav', null,
      item('#/', 'home', ICON.home(), '홈'),
      item('#/recent', 'recent', ICON.recent(), '최근 올라온 자료')),
    h('hr'),
    h('div', { className: 'side-h' }, '단원'),
    h('nav', null, C.units.map((u) => h(F, { key: u.no },
      item(`#/u/${u.no}`, `u${u.no}`, h(Ava, { u }), `${u.no}단원 ${u.name}`, isNew(u.updated) ? h('i', { className: 'dot', title: '최근 7일 새 자료' }) : null)))),
    h('hr'),
    h('div', { className: 'side-h' }, '안내'),
    h('nav', null, item('#/guide', 'guide', ICON.guide(), '내 포털에 넣는 법')),
    h('p', { className: 'side-foot' }, '교과서 그림은 수업 목적으로만 쓰세요.', h('br'), '정답이 든 파일은 올리지 않아요.'));
}
function App({ C, back }) {
  const path = useHash();
  const narrow = useNarrow();
  const [, a, b, c] = path.split('/');
  const [q, setQ] = useState(a === 's' ? path.slice(3) : '');
  const [open, setOpen] = useState(false);
  const [imp, setImp] = useState(back && back.codes.length ? { codes: back.codes, start: back, n: 1 } : null);
  const [msg, setMsg] = useState('');
  importOpen = (codes) => setImp({ codes, n: Date.now() });
  toastSet = (t) => { setMsg(t); clearTimeout(toastSet.t); toastSet.t = setTimeout(() => setMsg(''), 1800); };

  useEffect(() => { setOpen(false); if (a === 's') setQ(path.slice(3)); }, [path]);
  const drawer = narrow || a === 'w';  // 좁은 화면·자료 보기에서는 사이드바를 서랍으로
  useEffect(() => { document.body.classList.toggle('drawer', drawer); document.body.classList.toggle('open', drawer && open); }, [drawer, open]);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') setOpen(false); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);

  const nav = a === 'u' ? `u${b}` : a === 'recent' ? 'recent' : a === 'guide' ? 'guide' : a === 'w' || a === 's' ? '' : 'home';
  let body;
  if (a === 'w') body = h(Watch, { key: b, C, id: b });
  else if (a === 'u') body = h(Unit, { C, no: b, tab: c });
  else if (a === 'k') body = h(Home, { C, kind: b });
  else if (a === 'recent') body = h(Recent, { C });
  else if (a === 's') body = h(Search, { C, q: path.slice(3) });
  else if (a === 'guide') body = h(Guide);
  else body = h(Home, { C });

  return h(F, null,
    h('header', { className: 'top' },
      h('div', { className: 'top-l' },
        h('button', { className: 'menu-btn', 'aria-label': '메뉴', 'aria-expanded': open, 'aria-controls': 'side', onClick: () => setOpen(!open) }, ICON.menu()),
        h('a', { className: 'logo', href: '#/' }, '과학 자료실')),
      h('form', { className: 'search', role: 'search', onSubmit: (e) => { e.preventDefault(); if (q.trim()) go(`/s/${encodeURIComponent(q.trim())}`); } },
        h(TextInput, { label: '검색', isLabelHidden: true, value: q, onChange: setQ, placeholder: '차시·자료 이름 검색' })),
      h('div', { className: 'portal-btn' }, h(Button, { label: '내 포털에 넣기', variant: 'primary', onClick: () => go('/guide') }))),
    h('div', { className: 'shade', onClick: () => setOpen(false) }),
    h('div', { className: 'shell' },
      h(Side, { C, nav }),
      h('main', { className: 'main' }, body)),
    h(Dialog, { isOpen: !!imp, onOpenChange: (o) => { if (!o) setImp(null); }, width: 520, purpose: 'form' },
      imp && h('div', { style: { padding: 24 } }, h(ImportBody, { key: imp.n, C, codes: imp.codes, start: imp.start }),
        h('div', { style: { marginTop: 16, textAlign: 'right' } }, h(Button, { label: '닫기', onClick: () => setImp(null) })))),
    msg && h('div', { className: 'toast', role: 'status' }, msg));
}

(async () => {
  const root = createRoot(document.getElementById('root'));
  let cat;
  try { cat = await (await fetch('catalog.json', { cache: 'no-cache' })).json(); }
  catch { root.render(h('div', { className: 'empty', style: { margin: 40 } }, '자료 목록을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요')); return; }
  const KIND = {}; cat.kinds.forEach((k) => { KIND[k.id] = k.name; });
  const lessons = [], files = [], byId = new Map();
  for (const u of cat.units) for (const l of u.lessons) { l.unit = u; lessons.push(l); for (const f of l.files) { f.lesson = l; files.push(f); byId.set(f.id, f); } }
  const count = (fs) => { const n = {}; fs.forEach((f) => { n[f.kind] = (n[f.kind] || 0) + 1; }); return cat.kinds.filter((k) => n[k.id]).map((k) => `${k.name} ${n[k.id]}`).join(' · '); };
  const back = await comeBack();
  root.render(h(App, { C: { cat, units: cat.units, lessons, files, byId, KIND, count }, back }));
})();
