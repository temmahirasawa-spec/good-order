"use client";

/**
 * 表示設定（旧「店舗設定」）。
 *
 * タブは2つ。
 *   動画設定     … お客様側2か所の見せ方。2枚目は色 / 画像 / 動画 を切り替えられる
 *   ベストセラー … メニュー管理のモーダルから移設したもの（新機能ではない）
 *
 * 動画設定の保存は操作のたびに即時（＝明示的な「保存」ボタンは置かない）。
 * トグル・タイプ切替・色選択は楽観的更新で、失敗したときだけ元に戻す（CLAUDE.md 4章）。
 * ベストセラーだけは「保存する」を押したときにまとめて保存する（並び順を1件ずつ
 * 保存すると途中経過がお客様側に出るため。モーダル時代からの挙動を変えていない）。
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import SettingsSection from "@/components/admin/settings/SettingsSection";
import VideoSlotField from "@/components/admin/settings/VideoSlotField";
import BackgroundSlotField from "@/components/admin/settings/BackgroundSlotField";
import DisplayTabs, { type DisplayTabId } from "@/components/admin/display/DisplayTabs";
import BestSellerPanel, {
  type BestSellerCandidate,
} from "@/components/admin/display/BestSellerPanel";
import { fetchCategories, type ApiCategory } from "@/lib/api";
import {
  fetchBestSellerSetting,
  saveBestSellerSetting,
  type BestSellerSetting,
} from "@/lib/bestSellers";
import {
  fetchStoreMedia,
  saveStoreMedia,
  type BackgroundType,
  type StoreMedia,
  type StoreMediaInput,
  type StoreMediaMap,
  type StoreMediaSlot,
} from "@/lib/storeMedia";
import { DEFAULT_BACKGROUND_COLOR } from "@/lib/backgroundColor";
import { deleteUploadedMedia, type UploadedMedia } from "@/lib/storage";

/* ── 1枚目（注文ホームのヒーロー動画）の文言 ──
   /order は16:9の枠に object-cover（components/ui/VideoBlock.tsx）。 */
const ORDER_HERO_NOTES = [
  "16:9（横長）に自動でトリミングされます。上下が切れないよう、16:9で書き出した動画をアップロードしてください。",
  "推奨: 1920×1080（16:9）・15秒以内・mp4",
  "音声は再生されません。",
  "アップロードした動画は自動的に圧縮されます（最大1280×720・mp4）。元のファイルは保存されません。",
];

/* ── 2枚目（着地画面の背景）の文言 ──
   / は画面全体に object-cover（components/top/TopScreen.tsx）。
   タイプごとに切り取られ方も注意点も違うので、共通化しない。 */
const LANDING_NOTES: Record<BackgroundType, string[]> = {
  color: [
    "画面全体がこの色一色で塗られます。写真や動画より軽く、通信が弱い店舗でも確実に表示されます。",
    "文字とロゴの色は、選んだ色の明るさに合わせて自動で切り替わります（明るい色 → 黒い文字 / 暗い色 → 白い文字）。",
    "カスタムでは HEX（#RRGGBB）で自由に指定できます。",
  ],
  image: [
    "画面いっぱいに敷かれ、端末の縦横比に合わせて拡大されるため、上下または左右が切れます。見せたいものは中央に寄せてください。",
    "推奨: 縦長（9:16）・1080×1920px 以上・jpg / png",
    "文字とロゴは白で表示されます。暗めの写真をご用意ください。",
    "アップロードした画像は自動的に圧縮されます（長辺1440px以内・WebP）。元のファイルは保存されません。",
  ],
  video: [
    "お客様の端末の画面いっぱいに敷かれます。画面の縦横比に合わせて拡大されるため、上下または左右が大きく切れます。見せたいものは中央に寄せてください。",
    "推奨: 縦長（9:16）・15秒以内・mp4",
    "文字とロゴは白で表示されます。暗めの映像をご用意ください。",
    "音声は再生されません。",
    "アップロードした動画は自動的に圧縮されます（長辺1280px以内・mp4）。縦横比は元のまま保たれます。",
  ],
};

/** 削除確認ダイアログの対象 */
type DeleteTarget =
  | { slot: StoreMediaSlot; kind: "video" }
  | { slot: StoreMediaSlot; kind: "image" };

export default function DisplaySettingsPage() {
  const [tab, setTab] = useState<DisplayTabId>("video");

  const [mediaMap, setMediaMap] = useState<StoreMediaMap | null>(null);
  const [savingSlot, setSavingSlot] = useState<StoreMediaSlot | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const [bestSeller, setBestSeller] = useState<BestSellerSetting | null>(null);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [candidates, setCandidates] = useState<BestSellerCandidate[]>([]);

  useEffect(() => {
    void (async () => setMediaMap(await fetchStoreMedia()))();
  }, []);

  /* ベストセラーの選択肢はメニュー管理と同じ取り方（カテゴリ＋商品一覧）。
     読めなくても画面は開けておく（空の状態から設定し直せる）。 */
  useEffect(() => {
    void (async () => {
      try {
        const [cats, rawItems] = await Promise.all([
          fetchCategories(),
          supabase
            .from("menu_items")
            .select("id, category_id, name, image_url, is_takeout, display_order")
            .order("display_order")
            .then(({ data }) => data ?? []),
        ]);
        setCategories(cats);
        const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? "—";
        setCandidates(
          rawItems.map((i) => ({
            id: i.id as string,
            name: i.name as string,
            categoryId: (i.category_id as string) ?? null,
            categoryName: i.is_takeout ? "テイクアウト" : catName((i.category_id as string) ?? ""),
            thumbnailUrl: (i.image_url as string) ?? null,
          }))
        );
      } catch (e) {
        console.error("[display] menu fetch failed:", e);
      }
      try {
        setBestSeller(await fetchBestSellerSetting());
      } catch (e) {
        console.error("[display] best seller fetch failed:", e);
        setBestSeller({ enabled: true, itemIds: [] });
      }
    })();
  }, []);

  /**
   * 1スロットを保存する。
   * @param orphanOnFailure 保存に失敗したときに掃除する、直前にアップロードしたオブジェクト
   */
  const persist = async (
    slot: StoreMediaSlot,
    patch: Partial<StoreMediaInput>,
    orphanOnFailure: UploadedMedia[] = []
  ) => {
    if (!mediaMap) return;
    const prev = mediaMap[slot];
    const next: StoreMediaInput = {
      enabled: prev.enabled,
      url: prev.url,
      posterUrl: prev.posterUrl,
      backgroundType: prev.backgroundType,
      backgroundColor: prev.backgroundColor,
      imageUrl: prev.imageUrl,
      ...patch,
    };

    // 楽観的更新：先にローカルを書き換える
    setSaveError(null);
    setMediaMap((m) =>
      m ? { ...m, [slot]: { ...next, updatedAt: new Date().toISOString() } } : m
    );
    setSavingSlot(slot);

    try {
      await saveStoreMedia(slot, next);

      /* 保存が通ってから、参照されなくなった旧オブジェクトを消す。
         先に消すと、保存に失敗したときお客様側が見ているURLが死ぬ。
         public/ 配下の相対パス（初期データ）は Storage に無いので
         deleteUploadedMedia 側で自動的に対象外になる。 */
      const stale: UploadedMedia[] = [];
      if (prev.url && prev.url !== next.url) stale.push({ type: "video", url: prev.url });
      if (prev.posterUrl && prev.posterUrl !== next.posterUrl) {
        stale.push({ type: "image", url: prev.posterUrl });
      }
      if (prev.imageUrl && prev.imageUrl !== next.imageUrl) {
        stale.push({ type: "image", url: prev.imageUrl });
      }
      if (stale.length > 0) void deleteUploadedMedia(stale);
    } catch (err) {
      // ロールバック
      setMediaMap((m) => (m ? { ...m, [slot]: prev } : m));
      setSaveError("保存できませんでした。通信環境をご確認のうえ、もう一度お試しください。");
      console.error("[display] save failed:", err);
      if (orphanOnFailure.length > 0) void deleteUploadedMedia(orphanOnFailure);
    } finally {
      setSavingSlot(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const t = deleteTarget;
    setDeleteTarget(null);
    await persist(
      t.slot,
      t.kind === "video" ? { url: null, posterUrl: null } : { imageUrl: null }
    );
  };

  const hero: StoreMedia | null = mediaMap?.order_hero ?? null;
  const landing: StoreMedia | null = mediaMap?.landing_background ?? null;

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar title="表示設定" onMenuClick={openDrawer} />
          <DisplayTabs active={tab} onSelect={setTab} />

          <main className="flex-1 overflow-y-auto bg-bg-secondary">
            {/* 横のパディングはメニュー管理と同じ SP16 / PC24 */}
            <div className="flex flex-col gap-[var(--space-16)] px-[var(--space-16)] lg:px-[var(--space-24)] py-[var(--space-20)] lg:py-[var(--space-24)]">
              {saveError && (
                <div className="bg-status-urgent-subtle rounded-[var(--radius-lg)] px-[var(--space-20)] py-[var(--space-16)] type-jp-body text-status-urgent">
                  {saveError}
                </div>
              )}

              {tab === "video" ? (
                <>
                  <p className="type-jp-caption text-text-secondary">
                    お客様が最初に見る2つの画面の動画を差し替えます。動画を消したいだけのときは、削除ではなく表示のオフをお使いください。
                  </p>

                  <SettingsSection
                    title="① 注文ホームのヒーロー動画"
                    description="メニュー一覧の先頭に、横長の帯として出ます。"
                  >
                    {!hero ? (
                      <div className="flex flex-col gap-[var(--space-12)] w-full">
                        <div className="skeleton h-4 w-1/3" />
                        <div className="skeleton h-[48px] w-full" />
                        <div className="skeleton h-[80px] w-[80px]" />
                      </div>
                    ) : (
                      <VideoSlotField
                        slot="order_hero"
                        toggleLabel="注文ホームに動画を表示する"
                        notes={ORDER_HERO_NOTES}
                        fit="cover-16x9"
                        media={hero}
                        disabled={savingSlot !== null}
                        onToggle={(enabled) => void persist("order_hero", { enabled })}
                        onUploaded={({ url, posterUrl }) =>
                          void persist("order_hero", { url, posterUrl }, [
                            { type: "video", url },
                            ...(posterUrl ? [{ type: "image" as const, url: posterUrl }] : []),
                          ])
                        }
                        onRequestDelete={() =>
                          setDeleteTarget({ slot: "order_hero", kind: "video" })
                        }
                      />
                    )}
                  </SettingsSection>

                  <SettingsSection
                    title="② 二次元コード着地画面の背景"
                    description="お客様が二次元コードを読み取って最初に開く画面の、背景いっぱいに出ます。"
                  >
                    {!landing ? (
                      <div className="flex flex-col gap-[var(--space-12)] w-full">
                        <div className="skeleton h-4 w-1/3" />
                        <div className="skeleton h-[48px] w-full" />
                        <div className="skeleton h-[80px] w-[80px]" />
                      </div>
                    ) : (
                      <BackgroundSlotField
                        slot="landing_background"
                        toggleLabel="着地画面に背景を表示する"
                        notes={LANDING_NOTES}
                        fit="keep-aspect"
                        media={landing}
                        disabled={savingSlot !== null}
                        onToggle={(enabled) => void persist("landing_background", { enabled })}
                        onChangeType={(backgroundType) =>
                          void persist("landing_background", {
                            backgroundType,
                            /* 色を一度も選んでいない状態で「色」に切り替えたら既定色を入れる。
                               null のままだと保存はできるが、店舗には何色になったか分からない */
                            backgroundColor:
                              backgroundType === "color" && !landing.backgroundColor
                                ? DEFAULT_BACKGROUND_COLOR
                                : landing.backgroundColor,
                          })
                        }
                        onChangeColor={(backgroundColor) =>
                          void persist("landing_background", { backgroundColor })
                        }
                        onUploadedVideo={({ url, posterUrl }) =>
                          void persist("landing_background", { url, posterUrl }, [
                            { type: "video", url },
                            ...(posterUrl ? [{ type: "image" as const, url: posterUrl }] : []),
                          ])
                        }
                        onUploadedImage={({ url }) =>
                          void persist("landing_background", { imageUrl: url }, [
                            { type: "image", url },
                          ])
                        }
                        onRequestDeleteVideo={() =>
                          setDeleteTarget({ slot: "landing_background", kind: "video" })
                        }
                        onRequestDeleteImage={() =>
                          setDeleteTarget({ slot: "landing_background", kind: "image" })
                        }
                      />
                    )}
                  </SettingsSection>
                </>
              ) : (
                <>
                  <p className="type-jp-caption text-text-secondary">
                    注文ホームの最上部に出る「ベストセラー」の中身を設定します。ここで選んだ商品が、選んだ順番のまま横スライドで表示されます。
                  </p>

                  <SettingsSection
                    title="ベストセラーに出す商品"
                    description="並べた順番のまま、注文ホームの最上部に横スライドで表示されます。"
                  >
                    <BestSellerPanel
                      setting={bestSeller}
                      candidates={candidates}
                      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                      onSave={async (next) => {
                        await saveBestSellerSetting(next);
                        setBestSeller(next);
                      }}
                    />
                  </SettingsSection>
                </>
              )}
            </div>
          </main>

          {/* ── 削除確認ダイアログ（メニュー管理の削除確認と同じ器） ── */}
          {deleteTarget && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-[var(--space-16)]"
              onClick={() => setDeleteTarget(null)}
            >
              <div
                className="bg-surface-white flex flex-col gap-[var(--space-20)] items-start p-[var(--space-24)] rounded-[var(--radius-lg)] w-full max-w-[342px] lg:max-w-[400px]"
                style={{ boxShadow: "var(--shadow-float)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-[var(--space-8)] items-start text-center w-full">
                  <p className="type-jp-heading-m text-text-primary w-full">
                    {deleteTarget.kind === "video" ? "動画を削除しますか？" : "画像を削除しますか？"}
                  </p>
                  <p className="type-jp-body-small text-text-secondary w-full">
                    削除するとお客様側の画面から
                    {deleteTarget.kind === "video" ? "動画" : "画像"}
                    が消えます。この操作は取り消せません。
                    <br />
                    一時的に隠したいだけの場合は、表示のトグルをオフにしてください。
                  </p>
                </div>
                <div className="flex gap-[var(--space-12)] items-start w-full">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 border border-border py-[var(--space-16)] rounded-[var(--radius-full)] type-jp-heading-s text-text-secondary"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={savingSlot !== null}
                    className="flex-1 bg-status-urgent disabled:opacity-50 py-[var(--space-16)] rounded-[var(--radius-full)] type-jp-heading-s text-text-inverse"
                  >
                    削除する
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AdminPageShell>
  );
}
