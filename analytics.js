/* First-party event definitions. Never read or transmit personal form values. */
(() => {
  'use strict';
  const site = document.currentScript.dataset.site;
  const id = document.currentScript.dataset.measurement;
  const production = site === 'stretching' ? 'from-stretching.vercel.app' : 'frombody-gym.vercel.app';
  if (location.hostname !== production) return;
  const disabled = () => { try { return localStorage.getItem('frombody_analytics_disabled') === '1'; } catch { return false; } };
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  function cleanLocation() {
    const url = new URL(location.origin + location.pathname);
    const input = new URLSearchParams(location.search);
    for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']) {
      const value = input.get(key);
      if (value && /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(value) && !/\d{9}/.test(value)) url.searchParams.set(key, value);
    }
    return url.href;
  }
  // Remember only campaign labels for this tab; never store form content.
  const campaign = Object.fromEntries(new URL(cleanLocation()).searchParams);
  let attribution = campaign;
  try {
    if (Object.keys(campaign).length) sessionStorage.setItem('frombody_campaign', JSON.stringify(campaign));
    else attribution = JSON.parse(sessionStorage.getItem('frombody_campaign') || '{}');
  } catch {}
  window.frombodyAttribution = () => ({...attribution});
  let referrer = '';
  try { referrer = new URL(document.referrer).origin; } catch {}
  window['ga-disable-' + id] = disabled();
  gtag('js', new Date());
  gtag('config', id, {
    page_location: cleanLocation(), page_referrer: referrer,
    allow_google_signals: false, allow_ad_personalization_signals: false,
    site_name: site, send_page_view: true
  });
  if (!disabled()) {
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.append(tag);
  }
  const fields = new Set(['section_name','placement','action','branch','program','error_type','visible_seconds','percent_scrolled']);
  window.frombodyTrack = (name, parameters = {}) => {
    if (disabled()) return;
    const safe = {site_name: site};
    for (const [key, value] of Object.entries(parameters)) if (fields.has(key)) safe[key] = value;
    gtag('event', name, {...safe, page_location: cleanLocation(), page_referrer: referrer});
  };
  const track = window.frombodyTrack;
  const sectionIds = new Set([...document.querySelectorAll('main section[id]')].map(el => el.id));
  const sections = [...document.querySelectorAll('main section[id]')];
  const states = new Map(sections.map(el => [el, {active: false, seconds: 0, sent: 0, seen: false}]));
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = states.get(entry.target);
      state.active = entry.isIntersecting;
      if (state.active && !state.seen) {
        state.seen = true;
        track('section_view', {section_name: entry.target.id});
      }
    }
  }, {threshold: 0, rootMargin: '-15% 0px -15% 0px'});
  sections.forEach(el => observer.observe(el));
  function flush() {
    for (const [el, state] of states) {
      const seconds = Math.floor(state.seconds - state.sent);
      if (seconds > 0) {
        track('section_engagement', {section_name: el.id, visible_seconds: seconds});
        state.sent += seconds;
      }
    }
  }
  let last = performance.now();
  let ticks = 0;
  setInterval(() => {
    const now = performance.now();
    const elapsed = Math.min((now - last) / 1000, 2);
    last = now;
    if (document.visibilityState !== 'visible' || !document.hasFocus() || document.querySelector('dialog[open]')) return;
    for (const state of states.values()) if (state.active) state.seconds += elapsed;
    if (++ticks % 15 === 0) flush();
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  const scrollSeen = new Set();
  window.addEventListener('scroll', () => {
    const height = document.documentElement.scrollHeight;
    const percent = Math.min(100, Math.round((scrollY + innerHeight) / height * 100));
    for (const level of [25,50,75,90]) if (percent >= level && !scrollSeen.has(level)) {
      scrollSeen.add(level); track('scroll_depth', {percent_scrolled: level});
    }
  }, {passive:true});
  document.addEventListener('click', event => {
    const element = event.target.closest('a,button');
    if (!element) return;
    const section = element.closest('section[id]');
    const placement = section && sectionIds.has(section.id) ? section.id : element.closest('header') ? 'header' : element.closest('.sticky') ? 'sticky' : 'other';
    const href = element.getAttribute('href') || '';
    if (element.matches('[data-lead-trigger]') || href === '#apply') {
      track('cta_click', {placement, action: 'consultation'});
      if (site === 'stretching') track('form_open', {placement});
    } else if (href.startsWith('tel:')) track('contact_click', {placement, action:'phone'});
    else if (/^https:\/\/(m\.place|map)\.naver\.com\//.test(href)) track('contact_click', {placement, action:href.includes('/ticket') ? 'naver_booking' : 'naver_map'});
    else if (element.matches('.carousel-arrow,[data-slide]') || /^(program|tour)-(prev|next)$/.test(element.id)) track('carousel_click', {placement, action:'navigate'});
  });
  document.querySelectorAll('details').forEach((el, index) => el.addEventListener('toggle', () => {
    if (el.open && el.closest('#faq')) track('faq_open', {action:'question_' + (index + 1)});
  }));
  document.querySelectorAll('form').forEach(form => {
    let started = false;
    form.addEventListener('input', () => { if (!started) {started = true; track('lead_form_start');} });
    form.addEventListener('submit', () => track('lead_submit_attempt'));
  });
  const footer = document.querySelector('footer');
  if (footer) {
    const notice = document.createElement('details');
    notice.style.cssText='font-size:12px;line-height:1.7;margin:16px 0;';
    const summary = document.createElement('summary'); summary.textContent='사이트 이용 분석 안내';
    const description = document.createElement('p');
    description.textContent='서비스 개선과 광고 효과 분석을 위해 Google Analytics를 사용하여 방문 경로, 페이지 이용 및 신청 완료 여부를 측정합니다. 이름·연락처·상담 내용은 분석 이벤트에 포함하지 않습니다. 영역별 시간은 화면에 보인 시간의 추정치입니다.';
    const button = document.createElement('button'); button.type='button';
    button.textContent=disabled() ? '이 브라우저에서 분석 허용' : '이 브라우저에서 분석 거부';
    button.addEventListener('click', () => {
      try { localStorage.setItem('frombody_analytics_disabled', disabled() ? '0' : '1'); } catch {return;}
      window['ga-disable-' + id] = disabled();
      if (disabled()) for (const cookie of document.cookie.split(';')) {
        const key = cookie.trim().split('=')[0];
        if (key === '_ga' || key.startsWith('_ga_')) {
          document.cookie=key+'=; Max-Age=0; path=/';
          document.cookie=key+'=; Max-Age=0; path=/; domain='+location.hostname;
        }
      }
      location.reload();
    });
    notice.append(summary,description,button); footer.append(notice);
  }
})();
