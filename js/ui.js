// ============ 共享工具层（esc / 存储 / 弹窗管理） ============
// 目标：收拢 collect / sites / notes 三页各自复制的公共逻辑，
// 仅暴露 window.UI，不依赖任何页面 DOM；页面在 defer 脚本中按需调用。
(function () {
  'use strict';

  // HTML 转义：所有动态拼进 innerHTML 的字符串必须先过这里
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // localStorage 安全读写：隐私模式/存储损坏时静默降级，键名与数据结构由调用方决定
  function loadJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* 写入失败可忽略，保证页面可用 */ }
  }

  // 弹窗开关：打开时锁滚动并暂停 Lenis，关闭时还原（滚动控制收口在 FX 适配层）
  function openModal(el) {
    if (!el) return;
    el.classList.add('open');
    FX.lockScroll();
  }
  function closeModal(el) {
    if (!el) return;
    el.classList.remove('open');
    FX.unlockScroll();
  }

  // 弹窗关闭途径（遮罩点击 + Esc）的唯一实现。
  // 只对「已打开」的弹窗触发，避免重复关闭把滚动锁解成负值。
  // onClose 决定关闭后做什么：芸香集/站点集/笔记本只需切类名 + 解锁滚动，
  // 而日历弹层要清空编辑态、灯箱要停止翻页，因此把「何时关闭」与「关闭后做什么」拆开。
  function bindDismiss(selector, onClose) {
    const close = onClose || closeModal;
    document.querySelectorAll(selector).forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m) close(m); });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll(selector + '.open').forEach(close);
    });
  }

  // 芸香集 / 站点集 / 笔记本共用形态：× 按钮（data-close="<弹窗 id>"）+ 遮罩 + Esc
  function bindModals(selector) {
    document.querySelectorAll('[data-close]').forEach((b) => {
      b.addEventListener('click', () => closeModal(document.getElementById(b.dataset.close)));
    });
    bindDismiss(selector || '.collect-modal');
  }

  window.UI = { esc, loadJSON, saveJSON, openModal, closeModal, bindDismiss, bindModals };
})();
