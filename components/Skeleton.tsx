export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} />;
}

/**
 * /order ホーム用のスケルトン（ヒーロー + カテゴリ × 2 + Top3）
 */
export function OrderHomeSkeleton() {
  return (
    <div className="space-y-7">
      {/* ヒーロー */}
      <div className="px-4">
        <Skeleton className="w-full" style={{ aspectRatio: "16/9", borderRadius: 14 }} />
      </div>
      {/* カテゴリ × 2 */}
      {[1, 2].map((i) => (
        <div key={i} className="px-5">
          <Skeleton className="h-5 w-32 mb-3" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex flex-col items-center gap-2" style={{ width: 100 }}>
                <Skeleton style={{ width: 100, height: 100, borderRadius: "9999px" }} />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        </div>
      ))}
      {/* Top 3 */}
      <div className="px-4">
        <Skeleton className="h-5 w-40 mb-3 ml-1" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 bg-white rounded-2xl p-3">
              <Skeleton style={{ width: 80, height: 80, borderRadius: 12 }} />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
