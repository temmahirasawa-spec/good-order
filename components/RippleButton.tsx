"use client";

import { forwardRef, useRef } from "react";
import { spawnRipple } from "@/lib/animations";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * ボタン押下時にゴールドの波紋を広げる。
 * 既存のボタンクラスをそのまま className で指定できる（position: relative + overflow: hidden を自動付与）。
 */
const RippleButton = forwardRef<HTMLButtonElement, Props>(function RippleButton(
  { className = "", onClick, children, ...rest },
  ref
) {
  const localRef = useRef<HTMLButtonElement | null>(null);

  return (
    <button
      ref={(el) => {
        localRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
      }}
      className={`ripple-btn ${className}`}
      onClick={(e) => {
        if (localRef.current) {
          spawnRipple(localRef.current, e.clientX, e.clientY);
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
});

export default RippleButton;
