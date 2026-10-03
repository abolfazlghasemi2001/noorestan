/* نورستان: فعال‌ساز قرارداد نتیجه
 * این فایل را بعد از common.js و پیش از اسکریپت خود بازی قرار بده.
 * ترتیب را خودش کنترل می‌کند و برای اجرای مستقیم صفحه هم خطای واضح می‌دهد.
 */
(function (root) {
  const files = ['result-contract.js', 'result-bridge.js'];
  const current = document.currentScript;
  const base = current && current.src ? current.src.replace(/[^/]+$/, '') : './';
  const load = (i) => {
    if (i >= files.length) {
      root.dispatchEvent(new CustomEvent('noorestan:game-contract-ready'));
      return;
    }
    const s = document.createElement('script');
    s.src = base + files[i];
    s.async = false;
    s.onload = () => load(i + 1);
    s.onerror = () => { throw new Error('نورستان: قرارداد بازی بارگذاری نشد: ' + files[i]); };
    document.head.appendChild(s);
  };
  if (root.NoorestanGameResult && root.G && root.G.result) {
    root.dispatchEvent(new CustomEvent('noorestan:game-contract-ready'));
  } else {
    load(0);
  }
})(typeof window === 'undefined' ? globalThis : window);
