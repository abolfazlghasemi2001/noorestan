/* نورستان: آداپتور مهاجرت نتیجهٔ بازی‌ها
 * باید بعد از common.js و قبل از کد خود بازی بارگذاری شود.
 * نتیجهٔ قدیمی G.result را نگه می‌دارد، اما ورودی را از قرارداد واحد عبور می‌دهد.
 */
(function (root) {
  const G = root.G;
  const R = root.NoorestanGameResult;
  if (!G || !R || typeof G.result !== 'function' || G.result.__noorestanBridge) return;
  const legacyResult = G.result;
  const bridged = function (input) {
    const normalized = R.normalize(input);
    const oldShape = R.legacy({ ...input, gameId: normalized.gameId });
    return legacyResult({
      ...input,
      ...oldShape,
      gameId: normalized.gameId,
      completion: normalized.completion,
      mode: normalized.mode,
      metadata: normalized.metadata,
      at: normalized.at
    });
  };
  bridged.__noorestanBridge = true;
  G.result = bridged;
})(typeof window === 'undefined' ? globalThis : window);
