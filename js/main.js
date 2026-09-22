// ============ 站点身份注入（名字 / 版权年份） ============
// SITE 集中配置于 links.js；此处统一写入各页页脚与署名，消除硬编码。
(function () {
  const site = (typeof SITE !== 'undefined' && SITE) || { name: '你的名字', year: '2026' };
  // 页脚版权年份
  document.querySelectorAll('.site-footer').forEach((f) => {
    const text = f.innerHTML.replace(/©\s*\d{4}/, '© ' + site.year);
    f.innerHTML = text;
  });
  // 关于页署名「嗨，我是 …」
  const aboutName = document.querySelector('.about-hero-text .accent-inline');
  if (aboutName) aboutName.textContent = site.name;
})();

// ============ 动效能力 ============
// 平滑滚动 / 动画 / 农历换算全部收口在 js/fx.js 适配层，本文件不再直接引用 SDK 全局变量。
// 适配层在能力缺失时给 <html> 打 no-gsap（CSS 据此还原 .reveal 初始态，保证内容可见）。
const hasFx = FX.ready;

// 锚点滚动交给 Lenis；无 Lenis 时适配层退化为原生滚动
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    FX.scrollTo(target, { offset: -60, duration: 1.2 });
  });
});

// ============ 导航滚动高亮（若存在导航） ============
const nav = document.querySelector('.glass-nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  });
}

// ============ 自定义光标 ============
const dot = document.querySelector('.cursor-dot');
const ring = document.querySelector('.cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

window.addEventListener('mousemove', (e) => {
  mx = e.clientX; my = e.clientY;
  dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
});

// 光标跟随：有 GSAP 走 ticker，缺失时用 rAF 降级（否则光标环永远停在左上角）
function tickRing() {
  rx += (mx - rx) * 0.15;
  ry += (my - ry) * 0.15;
  ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
}
FX.onTick(tickRing);

// 可交互元素放大光标
const hoverTargets = 'a, button, input, textarea, .work-card, .skill, .hamburger, .mascot-frame';
document.addEventListener('mouseover', (e) => {
  if (e.target.closest(hoverTargets)) ring.classList.add('hovered');
});
document.addEventListener('mouseout', (e) => {
  if (e.target.closest(hoverTargets)) ring.classList.remove('hovered');
});

// ============ 鼠标即船 · 随动C形水波拖尾 ============
(function () {
  const canvas = document.getElementById('trailCanvas');
  if (!canvas || !canvas.getContext) return; // 触屏或低端环境跳过

  const ctx = canvas.getContext('2d');
  let W, H, dpr;

  const MAX_LEN = 48;         // 船尾拖尾最大拉伸长度(px)
  const GROW = 5;             // 每帧拉伸速度(px)

  // 历史轨迹点(平滑采样)
  const smoothing = 0.35;     // 船头坐标平滑，越高越跟手

  // 速度驱动（skill：水波弧度随移动速度变化，快时张开深、慢时收敛浅）
  let speed = 0;              // 原始移动速度(px/帧)
  let smoothSpeed = 0;        // 指数平滑后的速度，避免瞬时抖动

  // 方向弹簧式平滑（带惯性：加速趋近目标方向，同时阻尼衰减，慢柔快稳）
  // 灵感：skill 提示装饰性鼠标追踪宜用弹簧物理而非固定插值，水波才显自然
  let dirVel = 0;             // 方向角速度（惯性）
  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  // 弹簧式收敛：目标角 cur，期望角 target，返回带惯性的新角
  function springAngle(cur, target, stiffness, damping) {
    let diff = target - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    dirVel += diff * stiffness;        // 加速拉向目标
    dirVel *= damping;                 // 阻尼衰减，避免来回振荡
    return cur + dirVel;
  }

  let lastPt = { x: -1, y: -1 };
  let tail = { active: false, dir: 0, len: 0, x: 0, y: 0 }; // 当前C形拖尾状态
  let fade = 1;             // 整体淡出因子(0→1)，鼠标停止后缓缓衰减，避免尾迹突兀消失
  let lastActive = 0;       // 最近一次鼠标活动时刻(ms)，用于淡出计时

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // 十六进制转 rgba
  function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  let rafId = null;
  function startLoop() {
    if (rafId) return;         // 已有循环在跑
    rafId = requestAnimationFrame(draw);
  }
  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function onMove(e) {
    const x = e.clientX, y = e.clientY;
    // 鼠标一动就重置淡出，并刷新最后活动时刻
    lastActive = performance.now();
    fade = Math.min(1, fade + 0.3);
    startLoop();               // 有活动即恢复动画循环
    // 平滑插值，得到稳定的船头坐标
    let sx, sy;
    if (lastPt.x >= 0) {
      sx = lastPt.x + (x - lastPt.x) * smoothing;
      sy = lastPt.y + (y - lastPt.y) * smoothing;
    } else {
      sx = x; sy = y;
    }

    // C 形拖尾状态更新
    if (lastPt.x >= 0) {
      // 记录最新移动方向（目标角），实际收敛交给 draw 里的弹簧逐帧平滑
      const rawDir = Math.atan2(y - lastPt.y, x - lastPt.x);
      // 原始速度 = 本帧位移（像素）
      speed = Math.hypot(y - lastPt.y, x - lastPt.x);
      smoothSpeed += (speed - smoothSpeed) * 0.2;   // 指数平滑，消除抖动
      if (!tail.active) {
        // 鼠标刚开始移动，创建船尾波纹并记录起点
        tail = { active: true, dir: rawDir, targetDir: rawDir, len: 0, x, y };
      } else {
        tail.targetDir = rawDir;      // 更新期望方向
        tail.x = x; tail.y = y;       // 船头始终贴住鼠标
        if (tail.len < MAX_LEN) tail.len = Math.min(MAX_LEN, tail.len + GROW);
      }
    }
    lastPt = { x: sx, y: sy };
  }
  window.addEventListener('mousemove', onMove);

  // 动画循环
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 鼠标静止超过一段时间后，让水波缓缓淡出(而非瞬间消失)，更柔
    if (performance.now() - lastActive > 600) {
      fade = Math.max(0, fade - 0.02);
    }

    // 方向弹簧式逐帧收敛：慢柔快稳，让水波带惯性、不僵硬
    if (tail.active && tail.targetDir !== undefined) {
      tail.dir = springAngle(tail.dir, tail.targetDir, 0.04, 0.9);
    }

    // 1) 船尾扩散水波：一组船尾V形波纹，每条由左右两臂向斜后方延伸，随距离变宽、变淡
    //    skill：视觉成一物；水波浸入海面，V形向后张开
    if (tail.active && tail.len > 3) {
      const bx = -Math.cos(tail.dir), by = -Math.sin(tail.dir); // 反方向单位向量
      const nx = -by, ny = bx;                                 // 垂直法向
      const r = tail.len;                                      // 拖尾长度
      ctx.lineCap = 'round';
      // 速度→V形：快时张开宽、弧更深；慢时收拢、弧更浅（skill 流线水波）
      const vel = Math.min(1, smoothSpeed / 12);   // 0=很慢 1=很快
      const WAVES = 5; // 波纹条数：由近及远，模拟扩散消散
      for (let k = 0; k < WAVES; k++) {
        const q = k / (WAVES - 1);               // 0=最近(船尾) 1=最远
        const dist = (0.05 + q * 1.05) * r;      // 波纹离船头的距离
        // V 顶点在船头后方中轴上；臂长随距离与速度变长
        const vx = tail.x + bx * dist, vy = tail.y + by * dist;
        const arm = (0.5 + q * 1.3) * dist * (0.9 + vel * 0.5);
        const alpha = (1 - q) * (1 - q) * (0.55 + vel * 0.45) * fade;   // 越远越淡
        ctx.strokeStyle = hexToRgba('#eafcff', alpha);
        ctx.lineWidth = (1 - q * 0.7) * (2.6 + vel * 1.4);   // 越远越细
        // 左臂：顶点向左斜后弯出，控制点偏外后方，弧线圆润
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.quadraticCurveTo(
          vx + bx * arm * 0.5 - nx * arm * 0.9, vy + by * arm * 0.5 - ny * arm * 0.9,
          vx - nx * arm, vy - ny * arm
        );
        ctx.stroke();
        // 右臂：顶点向右斜后弯出，对称
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        ctx.quadraticCurveTo(
          vx + bx * arm * 0.5 + nx * arm * 0.9, vy + by * arm * 0.5 + ny * arm * 0.9,
          vx + nx * arm, vy + ny * arm
        );
        ctx.stroke();
      }

      // 船身：一个柔和半透明白点，作为波纹依附的锚，画面更聚焦
      const tailGrad = ctx.createRadialGradient(tail.x, tail.y, 0, tail.x, tail.y, 6);
      tailGrad.addColorStop(0, `rgba(255,255,255,${0.7 * fade})`);
      tailGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = tailGrad;
      ctx.beginPath();
      ctx.arc(tail.x, tail.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 淡出完全结束且无拖尾时暂停循环，省掉每帧 CPU（下次 onMove 会重启）
    if (fade <= 0 && !tail.active) { stopLoop(); return; }
    rafId = requestAnimationFrame(draw);
  }
  draw();
})();

// ============ 移动端菜单（若存在导航） ============
const burger = document.getElementById('hamburger');
const links = document.querySelector('.nav-links');
if (burger && links) {
  burger.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => links.classList.remove('open')));
}

// ============ 相片集数据驱动渲染 ============
// 说明：相片内容集中配置在 js/photos-data.js（PHOTOS_DATA）；此处只负责渲染。
// 置于入场动画之前，使动态生成的卡片能被下方 .reveal 入场与滚动浮现动画接管。
// 真实相片懒加载：进入视口才注入 background-image，避免首屏一次性解码大图。
(function () {
  const grid = document.getElementById('photosGrid');
  if (!grid) return; // 非相片页跳过

  const photosData = (typeof PHOTOS_DATA !== 'undefined' && PHOTOS_DATA) || [];
  if (!photosData.length) return;

  const lazyIO = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.style.backgroundImage = `url('${en.target.dataset.src}')`;
          lazyIO.unobserve(en.target);
        });
      }, { rootMargin: '200px 0px' })
    : null;

  photosData.forEach((p, idx) => {
    const card = document.createElement('article');
    card.className = 'glass-card work-card reveal';
    card.innerHTML = `
      <div class="work-thumb ${p.grad || 'g1'}"></div>
      <div class="work-info">
        <h3>${p.title}</h3>
        <p>${p.desc || ''}</p>
      </div>`;
    if (p.img) {
      const thumb = card.querySelector('.work-thumb');
      if (lazyIO) { thumb.dataset.src = p.img; lazyIO.observe(thumb); }
      else thumb.style.backgroundImage = `url('${p.img}')`;
    }
    grid.appendChild(card);
    card.addEventListener('click', () => openPhoto(idx));
  });

  // ============ 相片小灯箱 ============
  // 开/关用 CSS 过渡（可中断、进出场对称）；切图沿用作品页的缩放重放手法。
  const lb = document.getElementById('photoLightbox');
  if (!lb) return;
  const plImg = document.getElementById('plImg');
  const plTitle = document.getElementById('plTitle');
  const plDesc = document.getElementById('plDesc');
  const plCount = document.getElementById('plCount');
  let plIdx = 0;

  function renderPhoto() {
    const p = photosData[plIdx];
    // 占位卡无真实图：以渐变类呈现（.g1~.g6），与网格一致
    plImg.className = 'pl-img' + (p.img ? '' : ` ${p.grad || 'g1'}`);
    plImg.style.backgroundImage = p.img ? `url('${p.img}')` : '';
    plImg.style.animation = 'none';
    void plImg.offsetWidth; // 触发重排，重放切换缩放
    plImg.style.animation = '';
    plTitle.textContent = p.title;
    plDesc.textContent = p.desc || '';
    plCount.textContent = `${plIdx + 1} / ${photosData.length}`;
  }
  function openPhoto(i) {
    plIdx = i;
    renderPhoto();
    UI.openModal(lb);
  }
  function closePhoto() {
    UI.closeModal(lb);
  }
  function goTo(step) {
    plIdx = (plIdx + step + photosData.length) % photosData.length;
    renderPhoto();
  }

  document.getElementById('plClose').addEventListener('click', closePhoto);
  document.getElementById('plPrev').addEventListener('click', () => goTo(-1));
  document.getElementById('plNext').addEventListener('click', () => goTo(1));
  UI.bindDismiss('.photo-lightbox', closePhoto); // 遮罩点击 + Esc
  // 左右键翻页是本灯箱特有行为，关闭途径统一走 UI.bindDismiss
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') goTo(-1);
    if (e.key === 'ArrowRight') goTo(1);
  });
})();

// ============ 关于页数据驱动渲染 ============
// 说明：关于页内容集中配置在 js/about-data.js（ABOUT_DATA）；此处只负责渲染。
// 名字来自 links.js 的 SITE（见文件顶部署名逻辑）；置于入场动画之前，保证 .reveal 动画生效。
(function () {
  const about = (typeof ABOUT_DATA !== 'undefined' && ABOUT_DATA) || null;
  if (!about) return; // 非关于页或未配置数据时跳过

  // 头像：数据里配了图片路径则替换默认渐变占位
  const avatar = document.querySelector('.about-hero .avatar');
  if (avatar && about.avatar) {
    avatar.style.backgroundImage = `url('${about.avatar}')`;
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';
    avatar.classList.add('has-img');
  }

  // 头像旁身份标签
  const roles = document.getElementById('aboutRoles');
  if (roles && about.roles) roles.textContent = about.roles;

  // 左右双面板：自我介绍 + 技能
  const grid = document.getElementById('aboutGrid');
  if (grid) {
    grid.innerHTML = '';
    if (about.intro) {
      const intro = document.createElement('div');
      intro.className = 'glass-panel about-intro reveal';
      intro.innerHTML = `<h4>${about.intro.title}</h4>`
        + (about.intro.paragraphs || []).map((p) => `<p>${p}</p>`).join('');
      grid.appendChild(intro);
    }
    if (about.skills) {
      const skills = document.createElement('div');
      skills.className = 'glass-panel skills reveal';
      skills.innerHTML = `<h3>${about.skills.title}</h3><div class="skill-list">`
        + (about.skills.items || []).map((s) => `<span class="skill">${s}</span>`).join('')
        + `</div>`;
      grid.appendChild(skills);
    }
  }

  // 经历足迹时间线
  const journey = document.getElementById('aboutJourney');
  if (journey && about.timeline) {
    journey.innerHTML = `<h3>${about.timeline.title}</h3><div class="timeline">`
      + (about.timeline.items || []).map((it) => `
        <div class="timeline-item">
          <span class="tl-dot"></span>
          <div>
            <h4>${it.period}</h4>
            <p>${it.text}</p>
          </div>
        </div>`).join('')
      + `</div>`;
  }

  // 底部 CTA 按钮（action: 'contact' 表示点击打开联系表单弹窗而非跳转）
  const cta = document.getElementById('aboutCta');
  if (cta) {
    cta.innerHTML = (about.cta || []).map((b) => {
      const cls = `btn btn-${b.style === 'primary' ? 'primary' : 'ghost'}`;
      return b.action === 'contact'
        ? `<button type="button" class="${cls}" data-action="contact">${b.text}</button>`
        : `<a href="${b.link}" class="${cls}">${b.text}</a>`;
    }).join('');
  }

  // 页脚标语（© 年份与名字由顶部署名逻辑统一处理）
  const tagline = document.getElementById('aboutTagline');
  if (tagline && about.footer) tagline.textContent = about.footer;

  // ============ 联系表单弹窗 ============
  // 文案与收件邮箱来自 ABOUT_DATA.contact；提交双通道：
  //   1) contact.formEndpoint 已配置 → fetch POST 到表单直发服务（如 Formspree），留言直接进邮箱；
  //   2) 未配置 → 拼接 mailto 链接唤起访客的邮件客户端，内容已代填好。
  const contactModal = document.getElementById('contactModal');
  const contactBtn = cta && cta.querySelector('[data-action="contact"]');
  if (contactModal && contactBtn) {
    const form = document.getElementById('contactForm');
    const sendBtn = document.getElementById('contactSend');
    const contact = about.contact || {};

    // 弹窗文案
    document.getElementById('contactTitle').textContent = contact.title || '联系我';
    document.getElementById('contactSub').textContent = contact.subtitle || '';

    const openContact = () => UI.openModal(contactModal);
    const closeContact = () => UI.closeModal(contactModal);

    contactBtn.addEventListener('click', openContact);
    contactModal.querySelectorAll('[data-contact-close]').forEach((b) => b.addEventListener('click', closeContact));
    UI.bindDismiss('.collect-modal', closeContact); // 遮罩点击 + Esc

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('cName').value.trim();
      const reply = document.getElementById('cEmail').value.trim();
      const msg = document.getElementById('cMsg').value.trim();
      if (!msg) return;

      // endpoint 直发：提交到 Formspree 类服务，成功后提示并关闭
      if (contact.formEndpoint) {
        sendBtn.disabled = true;
        sendBtn.textContent = '发送中…';
        fetch(contact.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ name, _replyto: reply, message: msg }),
        }).then((res) => {
          if (!res.ok) throw new Error(res.status);
          sendBtn.textContent = '已发送 ✓';
          setTimeout(() => { closeContact(); form.reset(); sendBtn.textContent = '发送留言'; sendBtn.disabled = false; }, 900);
        }).catch(() => {
          sendBtn.textContent = '发送失败，请重试';
          sendBtn.disabled = false;
        });
        return;
      }

      // mailto 兜底：唤起邮件客户端，主题与正文代填
      const subject = `【作品集留言】来自 ${name || '访客'}`;
      const body = `${msg}\n\n——\n称呼：${name || '未填写'}\n回复邮箱：${reply || '未填写'}`;
      window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      closeContact();
    });
  }
})();

// ============ 入场动画 ============
// 无 GSAP 时适配层直接跳过，.reveal 的 CSS 初始态由 html.no-gsap 规则还原
FX.to('.reveal', {
  opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12,
  delay: 0.2,
});

// ============ 滚动浮现动画 ============
// 相片页卡片由此接管（works 页网格为 JS 渲染，走自己的入场）。
// 系统"减少动态"偏好：去位移（含清除 .reveal 的 CSS 初始偏移），仅保留淡入。
const prefersReduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
FX.all('.works-grid .work-card').forEach((card, i) => {
  FX.fromTo(card,
    prefersReduceMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 50 },
    {
      opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: card, start: 'top 85%', once: true },
      delay: (i % 3) * 0.1,
    }
  );
});

FX.all('.glass-panel, .contact-panel, .site-footer, .section-head').forEach((el) => {
  // 首页门户大块与日历由入场动画处理，跳过滚动触发
  if (el.classList.contains('portal-merged') || el.classList.contains('calendar') || el.classList.contains('mascot-frame')) return;
  FX.fromTo(el,
    { opacity: 0, y: 40 },
    {
      opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    }
  );
});

// ============ 作品卡片 3D 跟随鼠标（叠加在照片墙错位之上） ============
// 实现收口在适配层 FX.bind3D，供静态卡片与动态渲染卡片共用。
FX.all('.work-card').forEach(FX.bind3D);

// ============ 小人卡片 3D 按压跟随鼠标（方案A + 高光跟随） ============
(function () {
  const frame = document.getElementById('mascotFrame');
  if (!frame) return;
  const inner = frame.querySelector('.mascot-inner');
  const shine = frame.querySelector('.mascot-shine');

  let rafId = null;

  // 实时移动鼠标时更新按压形变 + 高光位置
  function onMove(e) {
    const r = frame.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5; // -0.5 ~ 0.5
    const py = (e.clientY - r.top) / r.height - 0.5;

    // 相对位置转百分比（供高光定位）
    const shx = ((e.clientX - r.left) / r.width) * 100;
    const shy = ((e.clientY - r.top) / r.height) * 100;

    // 更新高光位置
    shine.style.setProperty('--shx', shx + '%');
    shine.style.setProperty('--shy', shy + '%');

    // 鼠标驱动按压形变：rotateX 朝鼠标方向下压，rotateY 横向，轻微缩放模拟凹陷
    FX.to(inner, {
      rotateX: -py * 16,
      rotateY: px * 16,
      scale: 0.95,
      duration: 0.4,
      ease: 'power2.out',
    });
  }

  function onEnter() { frame.classList.add('is-active'); }
  function onLeave() {
    frame.classList.remove('is-active');
    FX.to(inner, { rotateX: 0, rotateY: 0, scale: 1, duration: 0.5, ease: 'back.out(1.6)' });
  }

  frame.addEventListener('mousemove', onMove);
  frame.addEventListener('mouseenter', onEnter);
  frame.addEventListener('mouseleave', onLeave);
})();

// ============ 鼓励语轮换（定时 + 点击，句子在 js/encourage.js 维护） ============
(function () {
  const bubble = document.querySelector('.encourage-bubble');
  if (!bubble) return;
  const FALLBACK = ['每一次努力，都让今天比昨天更好一点。'];
  const quotes = (typeof ENCOURAGE_QUOTES !== 'undefined' && ENCOURAGE_QUOTES.length) ? ENCOURAGE_QUOTES : FALLBACK;

  const INTERVAL = 15000; // 自动轮换间隔
  const SWAP_MS = 240;    // 与 CSS 过渡时长保持一致
  let idx = 0;
  let timer = null;
  let swapping = false;

  function next() {
    if (swapping) return;
    swapping = true;
    idx = (idx + 1) % quotes.length;
    bubble.classList.add('is-swapping');
    setTimeout(() => {
      bubble.textContent = quotes[idx];
      bubble.classList.remove('is-swapping');
      swapping = false;
    }, SWAP_MS);
  }

  function start() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) next(); }, INTERVAL);
  }

  // 点击气泡或小人：立即换下一句并重置计时
  const onManual = () => { next(); start(); };
  bubble.addEventListener('click', onManual);
  const frame = document.getElementById('mascotFrame');
  if (frame) frame.addEventListener('click', onManual);

  start();
})();

// ============ 联系表单 ============
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.textContent = '已收到，谢谢你！✨';
    setTimeout(() => { btn.textContent = '发送消息'; e.target.reset(); }, 2500);
  });
}

// ============ 日历组件（含轻量日期标记） ============
(function () {
  const grid = document.getElementById('calGrid');
  const label = document.getElementById('calLabel');
  const prevBtn = document.getElementById('calPrev');
  const nextBtn = document.getElementById('calNext');
  if (!grid || !label) return;

  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth(); // 0-11

  const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  // ---- 标记数据：{ 'YYYY-MM-DD': { text, color } } ----
  const MARK_KEY = 'calendar_marks_v1';
  const pad = (n) => String(n).padStart(2, '0');

  // 读写统一走 js/ui.js：同一职责不允许存在第二套实现。
  // UI.loadJSON 在缺失/损坏时返回 null，而本组件要的是空对象，故补一层 || {}。
  function loadMarks() {
    return UI.loadJSON(MARK_KEY) || {};
  }
  function persistMarks() {
    UI.saveJSON(MARK_KEY, marks);
  }
  let marks = loadMarks();

  // 重复标记展开：把"每年公历/每年农历"的标记映射到当前视图的某一天
  // 返回 { iso: mark }，key 为展开到的公历日期，_source 记录原始存储键
  let overlayMap = {};
  function buildOverlay(year, month) {
    const map = {};
    const dim = new Date(year, month + 1, 0).getDate();
    for (const [iso, m] of Object.entries(marks)) {
      if (!m || !m.repeat) continue;
      if (m.repeat === 'solar') {
        const [, mm, dd] = iso.split('-').map(Number);
        if (mm === month + 1 && dd <= dim) map[`${year}-${pad(mm)}-${pad(dd)}`] = { ...m, _source: iso };
      } else if (m.repeat === 'lunar' && FX.lunar.ready && m.lMonth && m.lDay) {
        // 农历月日可能落在相邻公历年（如腊月 → 次年1/2月），扫描 Y-1/Y/Y+1
        for (const ly of [year - 1, year, year + 1]) {
          const s = FX.lunar.lunar2solar(ly, m.lMonth, m.lDay, !!m.lLeap);
          if (s && s.cYear === year && s.cMonth === month + 1 && s.cDay <= dim) {
            map[`${s.cYear}-${pad(s.cMonth)}-${pad(s.cDay)}`] = { ...m, _source: iso };
          }
        }
      }
    }
    return map;
  }

  function render() {
    const first = new Date(viewYear, viewMonth, 1);
    const startWeekday = first.getDay(); // 0=周日
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    overlayMap = buildOverlay(viewYear, viewMonth);

    label.textContent = `${viewYear} 年 ${MONTHS[viewMonth]}`;
    grid.innerHTML = '';

    for (let i = 0; i < startWeekday; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      grid.appendChild(empty);
    }

    const today = now.getDate();
    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
      const mark = marks[iso] || overlayMap[iso]; // 精确标记优先于重复展开
      const cell = document.createElement('div');
      // has-mark + 颜色类下发给格子本身，供 CSS 做底纹提示（圆点仍单独渲染）
      cell.className = 'cal-day'
        + (isCurrentMonth && d === today ? ' today' : '')
        + (mark ? ' has-mark ' + (mark.color || 'blue') : '');
      cell.dataset.date = iso;
      // 农历小字：初一显示月名，节气优先显示节气名，其余显示日子
      let lunarText = '';
      const lu = FX.lunar.solar2lunar(viewYear, viewMonth + 1, d);
      if (lu) lunarText = lu.isTerm ? lu.term : (lu.lDay === 1 ? lu.monthCn : lu.dayCn);
      const num = document.createElement('span');
      num.className = 'cal-num';
      num.textContent = d;
      cell.appendChild(num);
      if (lunarText) {
        const lu = document.createElement('span');
        lu.className = 'cal-lunar';
        lu.textContent = lunarText;
        cell.appendChild(lu);
      }
      if (mark) {
        const dot = document.createElement('span');
        dot.className = 'cal-dot ' + (mark.color || 'blue');
        cell.appendChild(dot);
        if (mark.icon) {
          const emo = document.createElement('span');
          emo.className = 'cal-emoji';
          emo.textContent = mark.icon;
          cell.appendChild(emo);
        }
      }
      grid.appendChild(cell);
    }
  }

  prevBtn.addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    render();
  });
  nextBtn.addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    render();
  });

  // ---- 标记弹层 ----
  const modal = document.getElementById('calModal');
  const mTitle = document.getElementById('calModalTitle');
  const mText = document.getElementById('calModalText');
  const mIcons = document.getElementById('calIcons');
  const mColors = document.getElementById('calColors');
  const mRepeat = document.getElementById('calRepeat');
  const mSave = document.getElementById('calModalSave');
  const mDelete = document.getElementById('calModalDelete');
  const mClose = document.getElementById('calModalClose');
  let editingDate = null;     // 当前点击的 'YYYY-MM-DD'
  let editingSource = null;   // 标记的原始存储键（重复展开实例指向源键，新建为 null）
  let editingColor = 'blue';
  let editingIcon = '';       // '' = 无图标
  let editingRepeat = 'none'; // none=仅今年 / solar=每年公历 / lunar=每年农历

  function openMarkModal(iso) {
    const exact = marks[iso];
    const overlay = !exact ? overlayMap[iso] : null;
    const mark = exact || overlay;
    editingDate = iso;
    editingSource = exact ? iso : (overlay ? overlay._source : null);
    editingColor = (mark && mark.color) || 'blue';
    editingIcon = (mark && mark.icon) || '';
    editingRepeat = (mark && mark.repeat) || 'none';
    const [y, m, d] = iso.split('-');
    mTitle.textContent = `${y} 年 ${MONTHS[Number(m) - 1]} ${Number(d)} 日`;
    mText.value = mark ? mark.text : '';
    mIcons.querySelectorAll('.cal-ico').forEach((c) =>
      c.classList.toggle('active', c.dataset.ico === editingIcon));
    mColors.querySelectorAll('.cal-color').forEach((c) =>
      c.classList.toggle('active', c.dataset.color === editingColor));
    mRepeat.querySelectorAll('.cal-rp').forEach((c) =>
      c.classList.toggle('active', c.dataset.rp === editingRepeat));
    // 有标记才显示删除按钮
    mDelete.style.display = mark ? '' : 'none';
    UI.openModal(modal);
    setTimeout(() => mText.focus(), 120);
  }
  // 关闭：切类名 + 解锁滚动走公共实现，本弹层额外清空编辑态
  function closeMarkModal() {
    UI.closeModal(modal);
    editingDate = null;
    editingSource = null;
  }

  grid.addEventListener('click', (e) => {
    const cell = e.target.closest('.cal-day');
    if (!cell || cell.classList.contains('empty')) return;
    openMarkModal(cell.dataset.date);
  });

  mIcons.addEventListener('click', (e) => {
    const c = e.target.closest('.cal-ico');
    if (!c) return;
    editingIcon = c.dataset.ico;
    mIcons.querySelectorAll('.cal-ico').forEach((x) => x.classList.toggle('active', x === c));
  });

  mRepeat.addEventListener('click', (e) => {
    const c = e.target.closest('.cal-rp');
    if (!c) return;
    editingRepeat = c.dataset.rp;
    mRepeat.querySelectorAll('.cal-rp').forEach((x) => x.classList.toggle('active', x === c));
  });

  mColors.addEventListener('click', (e) => {
    const c = e.target.closest('.cal-color');
    if (!c) return;
    editingColor = c.dataset.color;
    mColors.querySelectorAll('.cal-color').forEach((x) => x.classList.toggle('active', x === c));
  });

  mSave.addEventListener('click', () => {
    const text = mText.value.trim();
    if (!text || !editingDate) { closeMarkModal(); return; }
    const base = { text, color: editingColor, icon: editingIcon, repeat: editingRepeat };
    // 每年农历：把源日期反查成农历月日存起来，渲染时再换算回公历
    if (editingRepeat === 'lunar' && FX.lunar.ready) {
      const key = editingSource || editingDate;
      const [sy, sm, sd] = key.split('-').map(Number);
      const lu = FX.lunar.solar2lunar(sy, sm, sd);
      if (lu) { base.lMonth = lu.lMonth; base.lDay = lu.lDay; base.lLeap = lu.isLeap; }
    }
    if (editingRepeat === 'none' && editingSource && editingSource !== editingDate) {
      // 重复实例被改为"仅今年"：删除原重复源，落到点击的这一天
      delete marks[editingSource];
      marks[editingDate] = base;
    } else {
      marks[editingSource || editingDate] = base;
    }
    persistMarks();
    closeMarkModal();
    render();
  });

  mDelete.addEventListener('click', () => {
    const target = editingSource || editingDate;
    if (marks[target]) {
      delete marks[target];
      persistMarks();
      render();
    }
    closeMarkModal();
  });

  mClose.addEventListener('click', closeMarkModal);
  UI.bindDismiss('.collect-modal', closeMarkModal); // 遮罩点击 + Esc

  render();
})();

// ============ 时钟组件 ============
(function () {
  const el = document.getElementById('clockTime');
  if (!el) return;
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    const d = new Date();
    el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  tick();
  setInterval(tick, 1000);
})();

// 初始化刷新 ScrollTrigger
FX.refreshNow();

// ============ 作品集数据驱动渲染 + 筛选 + 灯箱（方案四 + 方案二） ============
// 说明：独立 IIFE 模块，与既有动效逻辑低耦合。
// 网格为杂志画廊瀑布流（works-grid.magazine）：封面按 ratio 错落，图注展示编号与标题；
// 入场用封面 clip-path 逐张揭示，卡体不再位移/倾斜，也不再绑定 3D 跟随。
(function () {
  const grid = document.getElementById('worksGrid');
  if (!grid) return; // 非作品页跳过

  // 系统"减少动态"偏好：入场退化为整体淡入
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 占位图片：沿用既有渐变 g1~g6 作为缩略图/灯箱大图（真实图可后续替换）
  const GRADS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];

  // 外链集中配置在 js/links.js 的 WORK_LINKS；此处做防御性解耦，避免页面未引 links.js 时抛错。
  const L = (typeof WORK_LINKS !== 'undefined' && WORK_LINKS) || {};

  // 作品内容集中配置在 js/works-data.js（WORKS_DATA）；此处只负责渲染。
  const worksData = (typeof WORKS_DATA !== 'undefined' && WORKS_DATA) || [];

  // 外链解析：条目可直接写 link，或用 linkKey 引用 WORK_LINKS 里的键（link 优先）。
  function resolveLink(w) {
    return w.link || (w.linkKey && L[w.linkKey]) || '';
  }

  // 筛选胶囊文案集中配置在 js/works-data.js 的 WORK_CATS（顺序即显示顺序）；
  // 数据里出现而未配置的分类会自动追加（文案回退为该分类第一个作品的 catText）。
  function renderFilterChips() {
    const bar = document.getElementById('worksFilter');
    if (!bar) return;
    const chips = [{ key: 'all', label: '全部' }];
    const seen = new Set();
    (typeof WORK_CATS !== 'undefined' && WORK_CATS || []).forEach((c) => {
      if (!c || !c.key || seen.has(c.key)) return;
      seen.add(c.key);
      chips.push({ key: c.key, label: c.label || c.key });
    });
    worksData.forEach((w) => {
      if (!w.cat || seen.has(w.cat)) return;
      seen.add(w.cat);
      chips.push({ key: w.cat, label: w.catText || w.cat });
    });
    bar.innerHTML = chips.map((c, i) =>
      `<button class="filter-chip${i === 0 ? ' active' : ''}" data-filter="${c.key}">${c.label}</button>`
    ).join('');
  }
  renderFilterChips();

  let currentFilter = 'all';
  let visible = []; // 当前可见作品索引
  let currentIdx = 0;

  // 真实封面图懒加载：卡片进入视口才注入 background-image，并停止观察。
  // 用 IntersectionObserver 避免首屏一次解码所有大图；降级时直接注入。
  const lazyIO = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target;
          el.style.backgroundImage = `url('${el.dataset.src}')`;
          lazyIO.unobserve(el);
        });
      }, { rootMargin: '200px 0px' })
    : null;
  function lazyLoadThumb(el, src) {
    el.dataset.src = src; // 先存地址，进视口再取
    if (lazyIO) lazyIO.observe(el);
    else el.style.backgroundImage = `url('${src}')`; // 无 IntersectionObserver 时立即加载
  }

  // 占位渐变以 CSS 类 .g1~.g6 为唯一来源（style.css），此处不再重复写色值；
  // 有真实图时用 w.img 覆盖。

  function filterWorks() {
    visible = worksData
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => currentFilter === 'all' || w.cat === currentFilter)
      .map(({ i }) => i);
  }

  // 渲染作品网格（方案四）
  function renderGrid() {
    grid.innerHTML = '';
    filterWorks();
    visible.forEach((wi, idx) => {
      const w = worksData[wi];
      const link = resolveLink(w);
      const card = document.createElement('article');
      card.className = 'glass-card work-card';
      // 有真实封面图时加 has-img 类，触发柔和蒙层
      const hasImg = !!w.img;
      card.innerHTML = `
        <div class="work-media ${w.grad}" style="--ratio:${w.ratio || '4 / 3'}">
          <div class="work-thumb${hasImg ? ' has-img' : ''}"></div>
          <div class="work-overlay">
            <div class="wo-meta"><span>${w.catText}</span><span>${w.year}</span></div>
            <div class="wo-actions">
              <span class="wo-view">查看详情 →</span>
              ${link ? `<a class="wo-visit" href="${link}" target="_blank" rel="noopener">访问项目 ↗</a>` : ''}
            </div>
          </div>
        </div>
        <div class="work-caption">
          <span class="wc-idx">${String(wi + 1).padStart(2, '0')}</span>
          <div class="wc-text">
            <h3>${w.title}</h3>
            <p>${w.catText} · ${w.year}</p>
          </div>
        </div>`;
      card.dataset.idx = wi;
      // 真实封面图懒加载：进入视口才注入 background-image，节省首屏网络与解码
      if (hasImg) lazyLoadThumb(card.querySelector('.work-thumb'), w.img);
      // 访问项目链接点击时阻止冒泡，避免同时打开灯箱
      const visitLink = card.querySelector('.wo-visit');
      if (visitLink) visitLink.addEventListener('click', (e) => e.stopPropagation());
      card.addEventListener('click', () => openLightbox(wi));
      grid.appendChild(card);
    });

    // 统计计数
    const countEl = document.getElementById('worksCount');
    if (countEl) countEl.textContent = `共 ${visible.length} 件作品`;

    // 入场：封面 clip-path 逐张揭示（杂志开页感），图注随后淡入；
    // 尊重"减少动态"偏好，退化为整体淡入。不依赖 ScrollTrigger，立即执行。
    if (hasFx && reduceMotion) {
      FX.fromTo(grid.querySelectorAll('.work-card'), { opacity: 0 },
        { opacity: 1, duration: 0.3, stagger: 0.05 });
    } else if (hasFx) {
      FX.fromTo(grid.querySelectorAll('.work-media'),
        { clipPath: 'inset(0 0 100% 0)' },
        { clipPath: 'inset(0 0 0 0)', duration: 0.65, ease: 'power3.out', stagger: 0.08 });
      FX.fromTo(grid.querySelectorAll('.work-caption'),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.08, delay: 0.2 });
    }
    // 重新计算滚动触发位置与滚动上限：网格渲染/筛选会改变页面高度，
    // 若不重测，Lenis 会沿用初始化时（网格为空）的 limit=0，导致滚轮无法下滚。
    FX.refresh();
  }

  // ============ 灯箱（方案二） ============
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImg');
  const lbTag = document.getElementById('lbTag');
  const lbTitle = document.getElementById('lbTitle');
  const lbDesc = document.getElementById('lbDesc');
  const lbSkills = document.getElementById('lbSkills');
  const lbMeta = document.getElementById('lbMeta');
  const lbThumbs = document.getElementById('lbThumbs');
  if (!lb) return; // 无灯箱结构则跳过

  function openLightbox(wi) {
    currentIdx = visible.indexOf(wi);
    renderLightbox();
    UI.openModal(lb);
  }
  function closeLightbox() {
    UI.closeModal(lb);
  }
  function goTo(step) {
    currentIdx = (currentIdx + step + visible.length) % visible.length;
    renderLightbox();
  }
  function renderLightbox() {
    const wi = visible[currentIdx];
    const w = worksData[wi];
    // 占位渐变由 CSS 类提供（唯一来源）；有真实图时以 url 覆盖
    lbImg.className = 'lightbox-img ' + (w.img ? '' : w.grad);
    lbImg.style.backgroundImage = w.img ? `url('${w.img}')` : '';
    lbImg.style.animation = 'none';
    void lbImg.offsetWidth; // 触发重排以重放缩放动画
    lbImg.style.animation = '';
    lbTag.textContent = w.catText;
    lbTitle.textContent = w.title;
    lbDesc.textContent = w.desc;
    lbSkills.innerHTML = w.skills.map((s) => `<span class="skill">${s}</span>`).join('');
    lbMeta.innerHTML = `<span>${w.year}</span><span>${currentIdx + 1} / ${visible.length}</span>`;
    // 有项目链接时显示「查看在线项目」入口
    let visitEl = lb.querySelector('.lb-visit');
    if (w.link) {
      if (!visitEl) {
        visitEl = document.createElement('a');
        visitEl.className = 'lb-visit';
        visitEl.target = '_blank';
        visitEl.rel = 'noopener';
        lb.querySelector('.lightbox-info').appendChild(visitEl);
      }
      visitEl.href = w.link;
      visitEl.textContent = '查看在线项目 ↗';
      visitEl.style.display = 'inline-flex';
    } else if (visitEl) {
      visitEl.style.display = 'none';
    }
    // 底部缩略图导览
    lbThumbs.innerHTML = visible.map((idx, i) => {
      const t = worksData[idx];
      return `<div class="lb-thumb${t.img ? '' : ' ' + t.grad}${i === currentIdx ? ' active' : ''}" style="background-image:${t.img ? `url('${t.img}')` : ''}" data-idx="${i}"></div>`;
    }).join('');
  }

  // 事件绑定
  document.getElementById('lbClose').addEventListener('click', closeLightbox);
  document.getElementById('lbPrev').addEventListener('click', () => goTo(-1));
  document.getElementById('lbNext').addEventListener('click', () => goTo(1));
  UI.bindDismiss('.lightbox', closeLightbox); // 遮罩点击 + Esc
  lbThumbs.addEventListener('click', (e) => {
    const t = e.target.closest('.lb-thumb');
    if (t) { currentIdx = parseInt(t.dataset.idx, 10); renderLightbox(); }
  });
  // 左右键翻页是本灯箱特有行为，关闭途径统一走 UI.bindDismiss
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') goTo(-1);
    if (e.key === 'ArrowRight') goTo(1);
  });

  // 筛选
  const filterBar = document.getElementById('worksFilter');
  if (filterBar) {
    filterBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      filterBar.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderGrid();
    });
  }

  renderGrid();
})();

// ============ 导航自动高亮：按 href 与当前文件名比对（顶部胶囊/迷你导航通用） ============
(function () {
  const nav = document.querySelector('.glass-nav, .mini-nav');
  if (!nav) return;
  // 直接用链接 href 与当前文件名比对，无需维护页面清单——新增页面自动高亮，零耦合
  const page = location.pathname.split('/').pop() || 'index.html';
  nav.querySelectorAll('a').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('href') === page);
  });
})();