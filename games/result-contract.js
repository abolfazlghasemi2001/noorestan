/* نورستان: قرارداد مشترک نتیجهٔ بازی‌ها
 * این لایه عمداً مستقل است تا مهاجرت بازی‌ها تدریجی و کم‌ریسک باشد.
 */
(function (root) {
  const MODES = new Set(['solo', 'online', 'local']);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(+n) ? +n : min));
  const text = value => String(value == null ? '' : value).trim();

  function normalize(input) {
    const x = input || {};
    const gameId = text(x.gameId || x.game || x.key).toLowerCase();
    if (!gameId) throw new Error('gameId is required');
    const stars = Math.round(clamp(x.stars, 0, 3));
    const score = Math.max(0, Math.round(Number.isFinite(+x.score) ? +x.score : 0));
    const completion = clamp(x.completion == null ? (stars ? 1 : 0) : x.completion, 0, 1);
    const mode = MODES.has(x.mode) ? x.mode : 'solo';
    return Object.freeze({
      gameId,
      score,
      stars,
      completion,
      mode,
      metadata: x.metadata && typeof x.metadata === 'object' ? { ...x.metadata } : {},
      at: Number.isFinite(+x.at) ? +x.at : Date.now()
    });
  }

  function legacy(input) {
    const r = normalize(input);
    return { key: r.gameId, game: text(input.game || input.title || r.gameId), score: r.score, stars: r.stars, mode: r.mode, metadata: r.metadata };
  }

  root.NoorestanGameResult = Object.freeze({ normalize, legacy });
})(typeof window === 'undefined' ? globalThis : window);
