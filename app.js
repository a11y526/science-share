// 과학 자료실 — catalog.json 하나로 그리는 정적 사이트(서버 없음). catalog.json은 관리 앱(share.py)이 만든다.
// 화면 부품은 Astryx(React, 빌드 없이 CDN). JSX 대신 h(...)로 쓴다.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Badge, TextInput, TextArea, TabList, Tab, Dialog, Avatar } from '@astryxdesign/core';
import { createClient } from '@supabase/supabase-js';
const h = React.createElement;
const F = React.Fragment;

// ---------- 구글 로그인·프로필 (Supabase science-share 프로젝트 — 과학 포털 서버와 따로) ----------
const sb = createClient('https://zxbqomcwszwxbzwzfoef.supabase.co', 'sb_publishable_fuRzRkuWshOjpPaUm1SdMw_wzdm0kvV',
  { auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, storageKey: 'share-auth' } });
let auth = { ready: false, user: null, profile: null, member: null };
const authSubs = new Set();
const setAuth = (p) => { auth = { ...auth, ...p }; authSubs.forEach((f) => f(auth)); };
function useAuth() {
  const [s, set] = useState(auth);
  useEffect(() => { authSubs.add(set); set(auth); return () => { authSubs.delete(set); }; }, []);
  return s;
}
async function loadProfile(user) {
  if (!user) { setAuth({ ready: true, user: null, profile: null, member: null }); return; }
  const [{ data }, { data: m }] = await Promise.all([
    sb.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    sb.from('members').select('status,is_admin').eq('user_id', user.id).maybeSingle()]);
  setAuth({ ready: true, user, profile: data || null, member: m || { status: 'pending', is_admin: false } });
}
sb.auth.onAuthStateChange((_e, s) => { setTimeout(() => loadProfile(s?.user || null), 0); });  // 콜백 안에서 바로 부르면 멈출 수 있어 한 박자 뒤에
const nameOf = (s) => s.profile?.name || s.user?.user_metadata?.full_name || (s.user?.email || '').split('@')[0];
const picOf = (s) => s.user?.user_metadata?.avatar_url || s.user?.user_metadata?.picture;
async function googleLogin() {
  if (!/^https:|^http:\/\/localhost/.test(location.href)) { toast('여기서는 로그인할 수 없어요'); return; }
  sessionStorage.setItem('sb-back', location.hash || '#/');
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: HERE } });
  if (error) toast(`로그인 창을 열지 못했어요: ${error.message}`);
}
async function logout() { await sb.auth.signOut(); toast('로그아웃했어요'); }
// 구글에서 돌아왔을 때(?code=…). GitHub 로그인(state가 sh-로 시작)과 겹치지 않게 구분
async function sbComeBack() {
  const q = new URLSearchParams(location.search);
  const back = sessionStorage.getItem('sb-back');
  const hashErr = location.hash.startsWith('#error=');
  if (!back || (q.get('state') || '').startsWith('sh-')) { if (hashErr) history.replaceState(null, '', HERE + '#/'); return null; }
  if (!q.get('code') && !q.get('error') && !hashErr) return null;
  sessionStorage.removeItem('sb-back');
  history.replaceState(null, '', HERE + back);
  if (!q.get('code')) return '로그인을 취소했어요';
  // 코드 교환이 두 번 일어나 두 번째가 "code verifier 없음"으로 실패해도 첫 번째로 이미 로그인됐을 수 있다 → 세션이 있으면 성공
  const { data, error } = await sb.auth.exchangeCodeForSession(q.get('code'));
  let user = data?.user;
  if (error || !user) user = (await sb.auth.getSession()).data.session?.user;
  if (!user) return '로그인이 안 됐어요. 다시 눌러 주세요';
  await loadProfile(user);
  if (!auth.profile) history.replaceState(null, '', HERE + '#/me');  // 처음 온 사람은 프로필부터
  return '로그인했어요';
}
let loginOpen = () => {};
// 가입 승인: 구글 로그인 → 프로필 → 관리자가 [승인]하면 모든 자료(웹 학습지 포함)를 보고 받을 수 있다
const approved = (s = auth) => s.member?.status === 'approved';
const need = () => {
  if (!auth.user) { loginOpen(); return false; }
  if (approved()) return true;
  toast(auth.member?.status === 'rejected' ? '가입이 승인되지 않았어요' : '가입 승인을 기다리고 있어요. 승인되면 바로 볼 수 있어요');
  return false;
};
// 비공개 자료(웹 학습지)는 승인된 사람만 서버에서 받는다
async function privateBlob(f) {
  const { data, error } = await sb.rpc('get_private_file', { p_name: f.name });
  if (error || !data) throw new Error(error?.message || '없는 자료예요');
  return new Blob([data.body], { type: 'text/html;charset=utf-8' });
}

// ---------- 글자 도우미 ----------
const DAY = 86400;
const SITE = new URL('./', location.href).href;
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const ago = (t) => { const s = Date.now() / 1000 - t; if (s < 3600) return '방금'; if (s < DAY) return `${Math.floor(s / 3600)}시간 전`; if (s < 30 * DAY) return `${Math.floor(s / DAY)}일 전`; if (s < 365 * DAY) return `${Math.floor(s / (30 * DAY))}개월 전`; return `${Math.floor(s / (365 * DAY))}년 전`; };
const size = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`;
const date = (t) => new Date(t * 1000).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const EXT = { pptx: 'PPT', ppt: 'PPT', key: 'KEY', docx: 'DOCX', hwp: 'HWP', hwpx: 'HWP', xlsx: 'XLSX', pdf: 'PDF', jpg: 'JPG', png: 'PNG', mp4: 'MP4', html: 'HTML' };
const extName = (f) => EXT[f.ext] || f.ext.toUpperCase();
const badgeOf = (f) => f.private ? '승인 회원' : f.kind === 'lesson' && f.slides ? `${f.slides}쪽` : f.kind === 'sim' ? '시뮬레이션' : extName(f);
const primary = (l) => l.files.find((f) => f.kind === 'lesson') || l.files.find((f) => f.kind === 'sim') || l.files.find((f) => f.thumb) || l.files[0];
const lessonThumb = (l) => (l.files.find((f) => f.kind === 'lesson' && f.thumb) || l.files.find((f) => f.kind === 'sim' && f.thumb) || l.files.find((f) => f.thumb) || {}).thumb;
const portalFiles = (l) => l.files.filter((f) => f.portal);
const isNew = (t) => Date.now() / 1000 - t < 7 * DAY;
const go = (path) => { location.hash = '#' + path; };
async function download(f) {
  if (!need()) return;
  const a = document.createElement('a'); a.download = f.name;
  if (f.private) {
    try { a.href = URL.createObjectURL(await privateBlob(f)); } catch { toast('받지 못했어요. 다시 눌러 주세요'); return; }
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return;
  }
  a.href = enc(f.path); a.click();
}
async function openNew(f) {
  if (!need()) return;
  if (!f.private) { open(enc(f.path), '_blank', 'noopener'); return; }
  const w = open('', '_blank');
  try { w.location.href = URL.createObjectURL(await privateBlob(f)); } catch { w.close(); toast('열지 못했어요. 다시 눌러 주세요'); }
}

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
  user: () => svg([['circle', { cx: 12, cy: 8, r: 4 }], 'M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6']),
  lock: () => svg([['rect', { x: 5, y: 11, width: 14, height: 9, rx: 2 }], 'M8 11V8a4 4 0 0 1 8 0v3']),
};

// ---------- 조각 ----------
const Ava = ({ u, big }) => h('span', { className: big ? 'ava big' : 'ava', 'aria-hidden': true }, u.roman);
function Thumb({ f, label }) {
  const doc = f.thumb && !['html', 'jpg', 'png', 'mp4'].includes(f.ext);
  return h('div', { className: doc ? 'thumb doc' : 'thumb' },
    f.thumb ? h('img', { src: enc(f.thumb), alt: '', loading: 'lazy' }) : f.private ? h('span', { className: 'ext lock-ic' }, ICON.lock(), '웹 학습지') : h('span', { className: 'ext' }, extName(f)),
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
function Locked({ f, s }) {
  const st = s.user ? s.member?.status : null;
  const [b, t, btn] = !s.user
    ? ['로그인하면 볼 수 있어요', '구글 계정으로 로그인하고 가입 승인을 받으면 모든 자료를 보고 내려받을 수 있어요', h(Button, { label: 'Google로 로그인', variant: 'primary', onClick: googleLogin })]
    : st === 'rejected'
      ? ['가입이 승인되지 않았어요', '자료실을 운영하는 선생님께 문의해 주세요', null]
      : ['가입 승인을 기다리고 있어요', s.profile ? '승인되면 이 화면에서 바로 볼 수 있어요. 승인 뒤 새로고침해 주세요' : '먼저 내 프로필(이름·학교)을 적어 주시면 승인에 도움이 돼요',
         s.profile ? h(Button, { label: '새로고침', onClick: () => location.reload() }) : h(Button, { label: '프로필 적기', variant: 'primary', onClick: () => go('/me') })];
  return h('div', { className: 'player' }, h('div', { className: 'still lock' },
    f.thumb && h('img', { src: enc(f.thumb), alt: '' }),
    h('div', { className: 'lock-box' }, ICON.lock(), h('b', null, b), h('span', null, t), btn)));
}
function PrivateView({ f }) {
  const [text, setText] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let dead = false;
    privateBlob(f).then((b) => b.text()).then((t) => { if (!dead) setText(t); }).catch(() => !dead && setErr('불러오지 못했어요. 새로고침해 주세요'));
    return () => { dead = true; };
  }, [f.name]);
  if (err) return h('div', { className: 'player' }, h('div', { className: 'still' }, h('span', null, err)));
  if (text == null) return h('div', { className: 'player doc' }, h('div', { className: 'still' }, h('span', null, '불러오는 중…')));
  return h(WsView, { html: text, title: f.title });
}

// ---------- 웹 학습지 보기: 학생이 포털 반 페이지에서 보는 모양 그대로(쪽 카드·칸·고르기 단추) + [정답 보기] ----------
// 웹판 규칙(section.page[data-slide][data-title], .bl .ox .ineq .box .fill .plot .sim)을 포털 worksheet.js처럼 읽는다
const WS_KEEP = new Set(['DIV', 'SPAN', 'P', 'H2', 'H3', 'H4', 'B', 'STRONG', 'I', 'EM', 'SMALL', 'BR', 'U', 'SUB', 'SUP', 'TABLE', 'THEAD', 'TBODY', 'TFOOT',
  'TR', 'TD', 'TH', 'CAPTION', 'COLGROUP', 'COL', 'UL', 'OL', 'LI', 'IMG', 'FIGURE', 'FIGCAPTION', 'SECTION']);
const WS_SYM = ['<', '=', '>'];
const SYM_OF = { '<': '<', '＜': '<', '〈': '<', '=': '=', '＝': '=', '>': '>', '＞': '>', '〉': '>' };
function wsPages(text) {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return [...doc.querySelectorAll('section.page')].map((s, i) => ({ slide: s.dataset.slide || String(i + 1), title: s.dataset.title || s.querySelector('h2,h3')?.textContent || '', el: s }));
}
const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
function wsBuild(sec, showKey) {
  const root = sec.cloneNode(true);
  root.querySelector(':scope > h2, :scope > h3')?.remove();  // 제목은 카드 머리에
  // 칸 → 포털 입력칸
  root.querySelectorAll('.sim').forEach((el) => {
    const c = mk('div', 'ws-sim');
    const bar = mk('div', 'ws-sim-bar');
    bar.append(mk('span', 'ws-sim-t', '시뮬레이션'), mk('span', 'ws-sim-note', '포털에서 열려요'));
    c.append(bar); el.replaceWith(c);
  });
  root.querySelectorAll('.plot').forEach((el) => {
    const c = mk('div', 'ws-plot-ph', showKey && el.dataset.points ? `점 찍기 칸 · 정답 ${el.dataset.points.replace(/\|/g, '  ')}` : '점 찍기 칸 (포털에서 그래프에 점을 찍어요)');
    el.replaceWith(c);
  });
  root.querySelectorAll('.ineq .box').forEach((el) => {
    const ans = SYM_OF[el.textContent.trim()] || '';
    const g = mk('span', 'ws-ox ws-sym');
    WS_SYM.forEach((o) => { const b = mk('button', 'ws-opt', o); b.type = 'button'; b.setAttribute('aria-pressed', String(showKey && o === ans)); g.append(b); });
    el.replaceWith(g);
  });
  root.querySelectorAll('.ox').forEach((el) => {
    const sim = el.classList.contains('sim-in'), multi = el.classList.contains('multi');
    const g = mk('span', `ws-ox${sim ? ' ws-sim-ox' : ''}${multi ? ' ws-multi' : ''}`);
    [...el.querySelectorAll('i')].forEach((i) => {
      const b = mk('button', 'ws-opt', i.textContent.trim()); b.type = 'button';
      b.setAttribute('aria-pressed', String(showKey && i.classList.contains('ok')));
      if (sim) b.disabled = true;
      g.append(b);
    });
    el.replaceWith(g);
  });
  root.querySelectorAll('.bl, .fill').forEach((el) => {
    const sim = el.classList.contains('sim-in'), fill = el.classList.contains('fill');
    const ans = el.textContent.trim();
    const x = fill ? mk('textarea', 'input ws-in ws-fill') : mk('input', `input ws-in ws-bl${el.classList.contains('s') ? ' ws-s' : ''}${el.classList.contains('l') ? ' ws-l' : ''}`);
    if (fill) x.rows = 2; else { x.type = 'text'; x.autocomplete = 'off'; }
    if (sim) { x.readOnly = true; x.classList.add('ws-sim-in'); x.placeholder = fill ? '시뮬레이션을 하면 저절로 채워져요' : '시뮬레이션'; }
    if (showKey && ans) { x.value = ans; x.classList.add('ws-key'); }
    el.replaceWith(x);
  });
  // 남길 태그만, class는 w- 붙여(포털과 같은 CSS 이름), style 등은 뺀다
  [...root.querySelectorAll('*')].forEach((el) => {
    if (!root.contains(el)) return;
    const t = el.tagName;
    if (/^(SCRIPT|STYLE|IFRAME|LINK|META|OBJECT|EMBED|SVG)$/.test(t)) { el.remove(); return; }
    const ours = /^(ws-|input)/.test(el.className || '');
    if (!ours && !WS_KEEP.has(t) && !/^(INPUT|TEXTAREA|BUTTON)$/.test(t)) { el.replaceWith(...el.childNodes); return; }
    if (ours) return;
    [...el.attributes].forEach((a) => { const n = a.name.toLowerCase();
      if (n === 'class') el.setAttribute('class', a.value.split(/\s+/).filter(Boolean).map((c) => 'w-' + c).join(' '));
      else if (!(['colspan', 'rowspan', 'alt'].includes(n) || (t === 'IMG' && n === 'src' && /^data:image\//.test(a.value)))) el.removeAttribute(a.name); });
  });
  return [...root.childNodes];
}
function WsView({ html, title }) {
  const pages = React.useMemo(() => wsPages(html), [html]);
  const [i, setI] = useState(0);
  const [key, setKey] = useState(false);
  const box = React.useRef(null), wrap = React.useRef(null);
  useEffect(() => {
    if (!box.current || !pages[i]) return;
    box.current.replaceChildren(...wsBuild(pages[i].el, key));
  }, [pages, i, key]);
  const goPage = (n) => { setI(n); wrap.current?.scrollTo({ top: 0 }); };
  useEffect(() => {  // 칸 고르기 단추: 누르면 골라짐(연습용, 저장 안 함)
    const el = box.current; if (!el) return;
    const on = (e) => { const b = e.target.closest('.ws-opt'); if (!b || b.disabled) return;
      const g = b.parentElement; if (!g.classList.contains('ws-multi')) g.querySelectorAll('.ws-opt').forEach((x) => x !== b && x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); };
    el.addEventListener('click', on); return () => el.removeEventListener('click', on);
  }, []);
  if (!pages.length) return h('div', { className: 'player' }, h('div', { className: 'still' }, h('span', null, '학습지 쪽(section class="page")을 찾지 못했어요')));
  const p = pages[i];
  return h('div', { className: 'player doc wsv', ref: wrap },
    h('div', { className: 'wsv-card' },
      h('div', { className: 'ws-head' },
        h('div', null, h('div', { className: 'ws-slide' }, `${p.slide}쪽`), h('h2', null, p.title)),
        h('button', { type: 'button', className: key ? 'wsv-key on' : 'wsv-key', 'aria-pressed': key, onClick: () => setKey(!key) }, key ? '정답 숨기기' : '정답 보기')),
      h('div', { className: 'ws-page', ref: box }),
      h('div', { className: 'ws-nav' },
        h('button', { type: 'button', className: 'ws-arrow', disabled: i === 0, 'aria-label': '앞 쪽', onClick: () => goPage(i - 1) }, '‹'),
        h('div', { className: 'ws-dots' }, pages.map((x, j) => h('button', { key: j, type: 'button', className: j === i ? 'ws-dot on' : 'ws-dot', 'aria-current': j === i ? 'page' : undefined, onClick: () => goPage(j) }, x.slide))),
        h('button', { type: 'button', className: 'ws-arrow', disabled: i === pages.length - 1, 'aria-label': '다음 쪽', onClick: () => goPage(i + 1) }, '›'))),
    h('p', { className: 'wsv-foot' }, `${title} · 학생은 포털 반 페이지에서 이 모양으로 풀어요. 여기서 쓴 답은 저장되지 않아요`));
}

// ---------- 웹 학습지 → 내 포털 (2026-11-12) ----------
// 내 포털 관리 화면(teacher/?ws-in=1#lessons)을 새 창으로 열고, 그 창이 'ws:ready'를 보내면 학습지 html을 넘긴다.
// 포털은 [학습지 올리기]와 같은 미리보기를 띄우고, 선생님이 [저장]을 눌러야 들어간다(포털 teacher.js '공유 자료실에서 웹 학습지 받기')
let wsSendOpen = () => {};
const PORTAL_KEY = 'my-portal';
function portalBase(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//.test(s)) s = 'https://' + s;
  let u; try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' && u.hostname !== 'localhost') return null;
  const path = u.pathname.replace(/(teacher\/)?(index\.html)?$/, '').replace(/\/?$/, '/');
  return u.origin + path;
}
function WsSend({ f, onClose }) {
  const [addr, setAddr] = useState(() => { try { return localStorage.getItem(PORTAL_KEY) || ''; } catch { return ''; } });
  const [html, setHtml] = useState(null);
  const [st, setSt] = useState({ phase: 'start', msg: '' });
  const live = React.useRef(null);
  useEffect(() => {
    let dead = false;
    privateBlob(f).then((b) => b.text()).then((t) => !dead && setHtml(t)).catch(() => !dead && setSt({ phase: 'start', msg: '학습지를 불러오지 못했어요. 새로고침해 주세요' }));
    return () => { dead = true; live.current?.(); };
  }, [f.name]);
  const send = () => {
    const base = portalBase(addr);
    if (!base) { setSt({ phase: 'start', msg: '포털 주소를 확인해 주세요. 예: https://아이디.github.io/science-portal/' }); return; }
    try { localStorage.setItem(PORTAL_KEY, base); } catch {}
    const origin = new URL(base).origin;
    const win = window.open(`${base}teacher/?ws-in=1#lessons`, 'portal-admin');
    if (!win) { setSt({ phase: 'start', msg: '새 창이 막혔어요. 브라우저 주소창 오른쪽에서 팝업을 허용해 주세요' }); return; }
    live.current?.();
    const payload = { type: 'ws:file', code: f.lesson.code, name: f.title, html };
    const on = (e) => {
      if (e.origin !== origin || e.source !== win) return;
      if (e.data?.type === 'ws:ready') win.postMessage(payload, origin);
      if (e.data?.type === 'ws:got') { stop(); setSt({ phase: 'done', msg: '' }); }
    };
    const slow = setTimeout(() => setSt((s) => s.phase === 'wait' ? { phase: 'wait', msg: '포털이 아직 답하지 않아요. 열린 창이 내 포털 관리 화면인지, 포털이 최신 버전인지 확인해 주세요' } : s), 15000);
    const stop = () => { removeEventListener('message', on); clearTimeout(slow); live.current = null; };
    live.current = stop;
    addEventListener('message', on);
    setSt({ phase: 'wait', msg: '' });
  };
  return h('div', { className: 'ws-send' },
    h('h2', null, '웹 학습지를 내 포털에 넣기'),
    h('p', { className: 'sub' }, `${f.lesson.code}차시 '${f.title}'을(를) 내 포털 관리 화면으로 넘겨요. 새 창에서 학습지 미리보기가 뜨면 `, h('b', null, '[저장]'), '을 누르세요. 관리 화면에 로그인돼 있지 않으면 로그인부터 하면 돼요.'),
    st.phase === 'done'
      ? h('div', { className: 'ws-send-ok' }, h('b', null, '포털로 넘겼어요'), h('span', null, '열린 관리 화면에서 미리보기를 확인하고 [저장]을 눌러 주세요'))
      : h(F, null,
          h(TextInput, { label: '내 포털 주소', value: addr, onChange: setAddr, placeholder: 'https://아이디.github.io/science-portal/' }),
          h('div', { className: 'btns' },
            h(Button, { label: !html ? '학습지 불러오는 중…' : st.phase === 'wait' ? '다시 열기' : '관리 화면 열어서 넣기', variant: 'primary', isDisabled: !html || !addr.trim(), onClick: send })),
          st.phase === 'wait' && !st.msg && h('p', { className: 'note' }, '포털 창이 열리기를 기다리는 중…'),
          st.msg && h('p', { className: 'note warn' }, st.msg)),
    h('p', { className: 'note' }, '포털 주소는 학생들이 들어가는 내 포털 첫 화면 주소예요. 한 번 적으면 이 브라우저가 기억해요.'));
}

// ---------- PDF 보기: 자체 리더(pdf.js) — 쪽을 화면 너비에 꽉 차게 이어서 그린다 ----------
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfjsP = null;
const pdfjs = () => pdfjsP || (pdfjsP = new Promise((ok, no) => {
  const s = document.createElement('script'); s.src = PDFJS + 'pdf.min.js';
  s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
  s.onerror = () => { pdfjsP = null; no(new Error('pdf.js')); };
  document.head.append(s);
}));
function PdfView({ f, src }) {
  const scroller = React.useRef(null), pagesEl = React.useRef(null);
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState(1);  // 1 = 너비에 꽉
  const [cur, setCur] = useState(1);
  const [w, setW] = useState(0);
  useEffect(() => {
    let dead = false, d = null;
    pdfjs().then((lib) => lib.getDocument(src).promise).then((x) => { d = x; if (!dead) setDoc(x); }).catch(() => !dead && setErr('PDF를 열지 못했어요. [내려받기]로 받아 보세요'));
    return () => { dead = true; d?.destroy(); };
  }, [src]);
  useEffect(() => {  // 칸 너비 따라 다시 그리기
    const el = scroller.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const host = pagesEl.current; if (!doc || !host || !w) return;
    let dead = false;
    const width = Math.max(200, (w - 32) * zoom), dpr = Math.min(window.devicePixelRatio || 1, 2);
    host.replaceChildren();
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); draw(e.target); } }), { root: scroller.current, rootMargin: '600px 0px' });
    const seen = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (v) setCur(+v.target.dataset.n); },
      { root: scroller.current, threshold: [0.25, 0.5, 0.75] });
    const draw = async (box) => {
      const pg = await doc.getPage(+box.dataset.n); if (dead) return;
      const vp = pg.getViewport({ scale: width / pg.getViewport({ scale: 1 }).width });
      const c = document.createElement('canvas'); c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
      box.style.height = `${vp.height}px`; box.append(c);
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise.catch(() => {});
    };
    (async () => {
      const first = await doc.getPage(1); if (dead) return;
      const r = first.getViewport({ scale: 1 }); const hgt = width * r.height / r.width;
      for (let n = 1; n <= doc.numPages; n++) {
        const box = document.createElement('div'); box.className = 'pdf-page'; box.dataset.n = n;
        box.style.width = `${width}px`; box.style.height = `${hgt}px`;
        host.append(box); io.observe(box); seen.observe(box);
      }
    })();
    return () => { dead = true; io.disconnect(); seen.disconnect(); };
  }, [doc, w, zoom]);
  const jump = (n) => { const el = pagesEl.current?.querySelector(`[data-n="${n}"]`); el?.scrollIntoView({ block: 'start' }); };
  const full = () => { const el = scroller.current?.parentElement; if (document.fullscreenElement) document.exitFullscreen(); else el?.requestFullscreen?.(); };
  if (err) return h('div', { className: 'player' }, h('div', { className: 'still' }, h('span', null, err), h(Button, { label: `내려받기 · ${size(f.size)}`, variant: 'primary', onClick: () => download(f) })));
  return h('div', { className: 'player doc pdfv' },
    h('div', { className: 'pdf-bar' },
      h('div', { className: 'pdf-pg' },
        h('button', { type: 'button', disabled: !doc || cur <= 1, 'aria-label': '앞 쪽', onClick: () => jump(cur - 1) }, '‹'),
        h('span', null, h('b', null, doc ? cur : '–'), ` / ${doc ? doc.numPages : '–'}`),
        h('button', { type: 'button', disabled: !doc || cur >= (doc?.numPages || 1), 'aria-label': '다음 쪽', onClick: () => jump(cur + 1) }, '›')),
      h('div', { className: 'pdf-pg' },
        h('button', { type: 'button', 'aria-label': '작게', disabled: zoom <= 0.5, onClick: () => setZoom(Math.max(0.5, +(zoom - 0.25).toFixed(2))) }, '−'),
        h('button', { type: 'button', className: 'pdf-fit', onClick: () => setZoom(1) }, zoom === 1 ? '너비 맞춤' : `${Math.round(zoom * 100)}%`),
        h('button', { type: 'button', 'aria-label': '크게', disabled: zoom >= 3, onClick: () => setZoom(Math.min(3, +(zoom + 0.25).toFixed(2))) }, '+'),
        h('button', { type: 'button', 'aria-label': '전체 화면', onClick: full }, '⛶'))),
    h('div', { className: 'pdf-scroll', ref: scroller },
      !doc && h('div', { className: 'pdf-wait' }, '불러오는 중…'),
      h('div', { className: 'pdf-pages', ref: pagesEl })));
}
function Player({ f }) {
  const s = useAuth();
  if (!s.ready) return h('div', { className: 'player' });
  if (!approved(s)) return h(Locked, { f, s });
  if (f.private) return h(PrivateView, { f });
  const src = enc(f.path);
  if (f.ext === 'html') return h('div', { className: 'player' }, h('iframe', { src, title: f.title, allow: 'fullscreen', loading: 'lazy' }));
  if (f.ext === 'pdf') return h(PdfView, { key: src, f, src });
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
          ['html', 'pdf'].includes(f.ext) && h(Button, { label: '새 창', onClick: () => openNew(f) }),
          h(Button, { label: '내려받기', onClick: () => download(f) }),
          f.private ? h(Button, { label: '내 포털에 넣기', variant: 'primary', onClick: () => need() && wsSendOpen(f) })
            : portalFiles(l).length > 0 && h(Button, { label: '내 포털에 넣기', variant: 'primary', onClick: () => importOpen([l.code]) }))),
      h('div', { className: 'desc-box' },
        h('span', { className: 'k' }, `${C.KIND[f.kind]} · ${size(f.size)} · ${date(f.mtime)} 올림`),
        f.portal && h(F, null, ' · 포털 자리 ', h('code', null, f.portal)),
        h('div', null, `${l.code} ${l.title} — ${C.count(l.files)}`),
        f.kind === 'lesson' && h('div', { className: 'note' }, '←/→ 쪽 넘기기 · F 전체 화면 · A 답 보기 (화면을 한 번 누른 뒤)'),
        f.private ? h('div', { className: 'note' }, '정답이 들어 있는 웹 학습지예요. 가입 승인된 선생님만 받을 수 있어요. [내 포털에 넣기]를 누르면 내 포털 관리 화면이 열려 바로 넣을 수 있어요(미리보기에서 [저장])')
          : f.kind === 'sheet' && h('div', { className: 'note' }, '학생이 포털에서 쓰는 웹 학습지는 이 차시의 \'웹 학습지 (정답 포함)\'에서 받을 수 있어요(승인 회원)'))),
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

// ---------- 내 프로필 ----------
function Me() {
  const s = useAuth();
  const [v, setV] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!s.user || v) return;
    const p = s.profile || {};
    setV({ name: p.name || s.user.user_metadata?.full_name || '', school: p.school || '', subject: p.subject || '과학', intro: p.intro || '' });
  }, [s.user, s.profile]);
  if (!s.ready) return h('div', { className: 'empty' }, '불러오는 중…');
  if (!s.user) return h('div', { className: 'empty' }, h('p', { style: { margin: '0 0 14px' } }, '로그인하면 내 프로필을 만들 수 있어요'),
    h(Button, { label: 'Google로 로그인', variant: 'primary', onClick: googleLogin }));
  if (!v) return null;
  const first = !s.profile;
  const set = (k) => (x) => setV({ ...v, [k]: x });
  const save = async () => {
    if (!v.name.trim()) { toast('이름을 적어 주세요'); return; }
    setBusy(true);
    const row = { user_id: s.user.id, name: v.name.trim(), school: v.school.trim(), subject: v.subject.trim(), intro: v.intro.trim() };
    const { data, error } = await sb.from('profiles').upsert(row).select().single();
    setBusy(false);
    if (error) { toast('저장이 안 됐어요. 다시 눌러 주세요'); return; }
    setAuth({ profile: data });
    toast('저장했어요');
    if (first) { go('/'); if (!approved()) setTimeout(() => toast('가입 신청이 됐어요. 승인되면 모든 자료를 볼 수 있어요'), 300); }
  };
  return h('div', { className: 'me' },
    h('div', { className: 'banner me-head' },
      h(Avatar, { name: v.name || nameOf(s), src: picOf(s), size: 96 }),
      h('div', null,
        h('small', null, first ? '처음 오셨네요 · 프로필을 만들어 주세요' : '내 프로필'),
        h('h1', null, v.name || nameOf(s)),
        h('p', null, [v.school, v.subject].filter(Boolean).join(' · ') || s.user.email))),
    h('div', { className: 'g-box me-form' },
      h(TextInput, { label: '이름', value: v.name, onChange: set('name'), maxLength: 40, placeholder: '예: 김과학' }),
      h(TextInput, { label: '학교', value: v.school, onChange: set('school'), maxLength: 60, placeholder: '예: ○○중학교' }),
      h(TextInput, { label: '과목', value: v.subject, onChange: set('subject'), maxLength: 30 }),
      h(TextArea, { label: '소개', value: v.intro, onChange: set('intro'), maxLength: 300, rows: 3, placeholder: '한두 줄로 적어 주세요' }),
      h('p', { className: 'note', style: { margin: 0 } }, `로그인 계정 ${s.user.email} · 가입 상태: ${s.member?.is_admin ? '관리자' : ST[s.member?.status] || '승인 대기'} · 프로필은 나와 자료실 관리자만 봐요`),
      h('div', { className: 'btns' },
        h(Button, { label: busy ? '저장하는 중…' : first ? '저장하고 시작하기' : '저장', variant: 'primary', isDisabled: busy, onClick: save }),
        h(Button, { label: '로그아웃', onClick: () => { logout(); go('/'); } }))));
}
// ---------- 가입 승인 (관리자) ----------
const ST = { pending: '승인 대기', approved: '승인됨', rejected: '거절' };
function Admin() {
  const s = useAuth();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState('');
  const load = async () => { const { data, error } = await sb.rpc('admin_members'); setList(error ? [] : data || []); };
  useEffect(() => { if (s.member?.is_admin) load(); }, [s.member?.is_admin]);
  if (!s.ready) return h('div', { className: 'empty' }, '불러오는 중…');
  if (!s.member?.is_admin) return h('div', { className: 'empty' }, '관리자만 볼 수 있어요');
  if (!list) return h('div', { className: 'empty' }, '불러오는 중…');
  const decide = async (m, st) => {
    setBusy(m.id);
    const { error } = await sb.rpc('admin_decide', { p_user: m.id, p_status: st });
    setBusy('');
    if (error) { toast('바꾸지 못했어요. 다시 눌러 주세요'); return; }
    toast(st === 'approved' ? `${m.name || m.email} 선생님을 승인했어요` : st === 'rejected' ? '거절했어요' : '대기로 돌렸어요');
    load();
  };
  const wait = list.filter((m) => m.status === 'pending').length;
  return h('div', { className: 'admin' },
    h('div', { className: 'banner' }, h('small', null, '관리자'), h('h1', null, '가입 승인'),
      h('p', { className: 'note', style: { margin: '6px 0 0' } }, `승인 대기 ${wait}명 · 전체 ${list.length}명 — 승인하면 모든 자료와 웹 학습지(정답 포함)를 받을 수 있어요`)),
    list.length === 0 ? h('div', { className: 'empty' }, '아직 가입한 사람이 없어요')
      : h('ul', { className: 'mem-list' }, list.map((m) => h('li', { key: m.id, className: `mem ${m.status}` },
          h(Avatar, { name: m.name || m.email, size: 44 }),
          h('div', { className: 'mem-t' },
            h('b', null, m.name || '(이름 없음)', ' ', h(Badge, { variant: m.status === 'approved' ? 'success' : 'neutral', label: m.is_admin ? '관리자' : ST[m.status] })),
            h('span', null, [m.school, m.subject].filter(Boolean).join(' · ') || '프로필을 아직 안 적었어요'),
            h('small', null, `${m.email} · ${new Date(m.requested_at).toLocaleDateString('ko-KR')} 가입`),
            m.intro && h('p', null, m.intro)),
          !m.is_admin && h('div', { className: 'btns', style: { marginTop: 0 } },
            m.status !== 'approved' && h(Button, { label: '승인', variant: 'primary', isDisabled: busy === m.id, onClick: () => decide(m, 'approved') }),
            m.status !== 'rejected' && h(Button, { label: m.status === 'approved' ? '승인 취소' : '거절', isDisabled: busy === m.id, onClick: () => decide(m, m.status === 'approved' ? 'pending' : 'rejected') }),
            m.status === 'rejected' && h(Button, { label: '대기로', isDisabled: busy === m.id, onClick: () => decide(m, 'pending') }))))));
}

function AuthBtn() {
  const s = useAuth();
  if (!s.ready) return null;
  if (!s.user) return h(Button, { label: '로그인', onClick: () => loginOpen() });
  return h('a', { className: 'me-av', href: '#/me', 'aria-label': `내 프로필 (${nameOf(s)})`, title: '내 프로필' },
    h(Avatar, { name: nameOf(s), src: picOf(s), size: 36 }));
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
        h('li', null, '학생이 포털에서 쓰는 웹 학습지(칸·정답 포함)는 승인 회원만 받아요. 자료 화면의 [내 포털에 넣기]를 누르면 내 포털 관리 화면이 열려 바로 넣어요. 과학 포털을 복사해 쓰면 하루 세 번 저절로도 들어와요'))));
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
  const s = useAuth();
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
    h('nav', null, item('#/me', 'me', ICON.user(), '내 프로필'), item('#/guide', 'guide', ICON.guide(), '내 포털에 넣는 법'),
      s.member?.is_admin && item('#/admin', 'admin', ICON.lock(), '가입 승인')),
    h('p', { className: 'side-foot' }, '교과서 그림은 수업 목적으로만 쓰세요.', h('br'), '정답이 든 웹 학습지는 승인된 선생님만 받아요.'));
}
function App({ C, back }) {
  const path = useHash();
  const narrow = useNarrow();
  const [, a, b, c] = path.split('/');
  const [q, setQ] = useState(a === 's' ? path.slice(3) : '');
  const [open, setOpen] = useState(false);
  const [imp, setImp] = useState(back && back.codes.length ? { codes: back.codes, start: back, n: 1 } : null);
  const [msg, setMsg] = useState('');
  const [login, setLogin] = useState(false);
  const [wsf, setWsf] = useState(null);
  wsSendOpen = setWsf;
  importOpen = (codes) => need() && setImp({ codes, n: Date.now() });
  loginOpen = () => setLogin(true);
  toastSet = (t) => { setMsg(t); clearTimeout(toastSet.t); toastSet.t = setTimeout(() => setMsg(''), 1800); };

  useEffect(() => { setOpen(false); if (a === 's') setQ(path.slice(3)); }, [path]);
  const drawer = narrow || a === 'w';  // 좁은 화면·자료 보기에서는 사이드바를 서랍으로
  useEffect(() => { document.body.classList.toggle('drawer', drawer); document.body.classList.toggle('open', drawer && open); }, [drawer, open]);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') setOpen(false); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);

  const nav = a === 'u' ? `u${b}` : ['recent', 'guide', 'me', 'admin'].includes(a) ? a : a === 'w' || a === 's' ? '' : 'home';
  let body;
  if (a === 'w') body = h(Watch, { key: b, C, id: b });
  else if (a === 'u') body = h(Unit, { C, no: b, tab: c });
  else if (a === 'k') body = h(Home, { C, kind: b });
  else if (a === 'recent') body = h(Recent, { C });
  else if (a === 's') body = h(Search, { C, q: path.slice(3) });
  else if (a === 'guide') body = h(Guide);
  else if (a === 'me') body = h(Me);
  else if (a === 'admin') body = h(Admin);
  else body = h(Home, { C });

  return h(F, null,
    h('header', { className: 'top' },
      h('div', { className: 'top-l' },
        h('button', { className: 'menu-btn', 'aria-label': '메뉴', 'aria-expanded': open, 'aria-controls': 'side', onClick: () => setOpen(!open) }, ICON.menu()),
        h('a', { className: 'logo', href: '#/' }, '과학 자료실')),
      h('form', { className: 'search', role: 'search', onSubmit: (e) => { e.preventDefault(); if (q.trim()) go(`/s/${encodeURIComponent(q.trim())}`); } },
        h(TextInput, { label: '검색', isLabelHidden: true, value: q, onChange: setQ, placeholder: '차시·자료 이름 검색' })),
      h('div', { className: 'top-r' },
        h('div', { className: 'portal-btn' }, h(Button, { label: '내 포털에 넣기', variant: 'primary', onClick: () => go('/guide') })),
        h(AuthBtn))),
    h('div', { className: 'shade', onClick: () => setOpen(false) }),
    h('div', { className: 'shell' },
      h(Side, { C, nav }),
      h('main', { className: 'main' }, body)),
    h(Dialog, { isOpen: !!imp, onOpenChange: (o) => { if (!o) setImp(null); }, width: 520, purpose: 'form' },
      imp && h('div', { style: { padding: 24 } }, h(ImportBody, { key: imp.n, C, codes: imp.codes, start: imp.start }),
        h('div', { style: { marginTop: 16, textAlign: 'right' } }, h(Button, { label: '닫기', onClick: () => setImp(null) })))),
    h(Dialog, { isOpen: !!wsf, onOpenChange: (o) => { if (!o) setWsf(null); }, width: 520, purpose: 'form' },
      wsf && h('div', { style: { padding: 24 } }, h(WsSend, { key: wsf.id, f: wsf }),
        h('div', { style: { marginTop: 16, textAlign: 'right' } }, h(Button, { label: '닫기', onClick: () => setWsf(null) })))),
    h(Dialog, { isOpen: login, onOpenChange: setLogin, width: 420, purpose: 'form' },
      login && h('div', { className: 'login-box' },
        h('h2', null, '로그인'),
        h('p', null, '구글 계정으로 로그인하고 프로필을 적으면 가입 신청이 돼요. 승인되면 모든 자료와 웹 학습지를 보고 내려받을 수 있어요. 이름·이메일·프로필 사진만 받아요.'),
        h(Button, { label: 'Google로 로그인', variant: 'primary', size: 'lg', onClick: googleLogin }),
        h('div', { style: { marginTop: 12 } }, h(Button, { label: '닫기', onClick: () => setLogin(false) })))),
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
  const said = await sbComeBack();
  const back = await comeBack();
  root.render(h(App, { C: { cat, units: cat.units, lessons, files, byId, KIND, count }, back }));
  if (said) setTimeout(() => toast(said), 300);
})();
