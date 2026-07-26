"use client";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Logo({ size = "md", className = "" }: LogoProps) {
  const sizes = {
    sm: { title: "text-xl",  sub: "text-[9px]",  spacing: "tracking-[0.3em]" },
    md: { title: "text-3xl", sub: "text-[10px]", spacing: "tracking-[0.35em]" },
    lg: { title: "text-4xl", sub: "text-xs",     spacing: "tracking-[0.4em]" },
  };
  const s = sizes[size];

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <span
        className={`font-halis font-medium ${s.title} text-warm-800 leading-none`}
        style={{ fontFamily: "HalisR, sans-serif" }}
      >
        YORKYS
      </span>
      <span
        className={`font-halis font-light ${s.sub} ${s.spacing} text-warm-500 uppercase leading-none`}
        style={{ fontFamily: "HalisR, sans-serif" }}
      >
        Brunch
      </span>
    </div>
  );
}
