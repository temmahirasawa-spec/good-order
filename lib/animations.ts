/**
 * UI アニメーション共通ユーティリティ
 */

/**
 * sourceEl を document.body にクローンして、targetEl の位置へ飛ばす。
 * 同時に scale(1) → scale(0.15)、opacity 1 → 0.6。
 * 終了後、クローンを削除する。
 */
export function flyToCart(sourceEl: HTMLElement, targetEl: HTMLElement) {
  const src = sourceEl.getBoundingClientRect();
  const tgt = targetEl.getBoundingClientRect();
  const clone = sourceEl.cloneNode(true) as HTMLElement;

  Object.assign(clone.style, {
    position:      "fixed",
    left:          `${src.left}px`,
    top:           `${src.top}px`,
    width:         `${src.width}px`,
    height:        `${src.height}px`,
    margin:        "0",
    pointerEvents: "none",
    zIndex:        "9999",
    transition:    "transform 480ms cubic-bezier(0.6, 0, 0.4, 1), opacity 480ms cubic-bezier(0.6, 0, 0.4, 1)",
    borderRadius:  "12px",
    overflow:      "hidden",
  } as CSSStyleDeclaration);

  document.body.appendChild(clone);

  requestAnimationFrame(() => {
    const dx = tgt.left + tgt.width  / 2 - (src.left + src.width  / 2);
    const dy = tgt.top  + tgt.height / 2 - (src.top  + src.height / 2);
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.15)`;
    clone.style.opacity   = "0.6";
  });

  // 着地直前にカートアイコンを bump
  window.setTimeout(() => {
    targetEl.classList.remove("cart-bump");
    // reflow で再アニメ可能にする
    void targetEl.offsetWidth;
    targetEl.classList.add("cart-bump");
    window.setTimeout(() => targetEl.classList.remove("cart-bump"), 640);
  }, 420);

  window.setTimeout(() => clone.remove(), 500);
}

/**
 * ゴールドの波紋を、クリック位置を中心に発生させる。
 * 呼び出し元要素は position: relative + overflow: hidden を前提。
 */
export function spawnRipple(el: HTMLElement, clientX: number, clientY: number) {
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = clientX - rect.left - size / 2;
  const y = clientY - rect.top  - size / 2;
  const span = document.createElement("span");
  span.className = "ripple";
  span.style.width  = `${size}px`;
  span.style.height = `${size}px`;
  span.style.left   = `${x}px`;
  span.style.top    = `${y}px`;
  el.appendChild(span);
  window.setTimeout(() => span.remove(), 520);
}
