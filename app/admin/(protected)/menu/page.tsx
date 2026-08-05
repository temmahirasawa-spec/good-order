"use client";

/**
 * メニュー管理画面（Step3-K、Figma: Menu Management / メニュー管理
 * — PC: Template / Menu Management 1180x820、SP: Menu Management — Mobile 390 +
 * Menu Item Editing — Mobile 390）
 * 商品の追加・編集・並び替え・公開設定のロジックは既存のまま。見た目のみ新デザインに差し替え。
 *
 * Figmaとの既知の差分（ユーザー確認済み事項含む）:
 * - カテゴリーフィルタータブは新Figmaに存在しないが、既存の実運用機能のため維持し
 *   見た目だけ新トークンに合わせた。
 * - 表示順（display_order）の並び替えは PC=⠿ドラッグ / SP=▲▼ボタン。
 *   **カテゴリー・テイクアウトで絞り込んでいるときだけ**行える（「すべて」ではUIごと非表示）。
 * - 削除機能はFigmaに配置が無いため、編集パネルのヘッダーに削除アイコンとして
 *   配置した（新規作成時は非表示）。
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useDragReorder } from "@/hooks/useDragReorder";
import { fetchCategories, type ApiCategory, type ApiMenuItem, type ApiMediaItem } from "@/lib/api";
import { uploadMenuImage, uploadMenuVideo, deleteUploadedMedia } from "@/lib/storage";
import {
  inspectImage,
  compressImage,
  formatBytes,
  COMPRESS_MAX_EDGE,
  COMPRESS_MAX_BYTES,
  type ImageInfo,
} from "@/lib/imageCompression";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import AdminMenuRow from "@/components/admin/menu/AdminMenuRow";
import TagSelectField from "@/components/admin/menu/TagSelectField";
import MediaUploaderField from "@/components/admin/menu/MediaUploaderField";
import MenuPreviewCard from "@/components/admin/menu/MenuPreviewCard";
/* ベストセラー設定は表示設定（/admin/display）の「ベストセラー」タブに移設した。
   この画面からは扱わないので、関連の import と state はここには無い。 */
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import { Icon } from "@/components/Icon";

/* カテゴリーslugと衝突しないフィルター用の番兵。
   テイクアウトはカテゴリーではなく「提供形態」の軸なので別扱いにする。 */
const TAKEOUT_FILTER = "__takeout__";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_IMAGES = 5;
const MAX_VIDEOS = 1;

/* calories/serving_time_min は表示・編集どちらにも使われない未使用フィールドのため
   このページのフェッチ・型からは除外する（DBカラム・他ページの共有型はそのまま） */
type AdminMenuItem = Omit<ApiMenuItem, "calories" | "serving_time_min"> & { category_slug: string };
type MediaItem = ApiMediaItem;

/* ── フォーム状態 ── */
interface FormState {
  category_id: string;
  name: string;
  description: string;
  price: string;
  media: MediaItem[];       // 並び順付きメディア。先頭 = 一覧カバー
  tag: string;
  is_available: boolean;
  is_takeout: boolean;
  display_order: string;
}
const EMPTY_FORM: FormState = {
  category_id: "", name: "", description: "", price: "",
  media: [], tag: "",
  is_available: true, is_takeout: false, display_order: "99",
};

/* ── DB カラムから MediaItem[] を構築（media_order 優先・legacy fallback） ── */
function buildMediaFromRow(item: AdminMenuItem): MediaItem[] {
  const raw = (item.media_order ?? []).filter(
    (m) => m && typeof m.url === "string" && m.url.length > 0
  );
  if (raw.length > 0) return raw;
  const images = [item.image_url, ...(item.additional_images ?? [])].filter(
    (s): s is string => typeof s === "string" && s.length > 0
  );
  const out: MediaItem[] = images.map((url) => ({ type: "image", url }));
  if (item.video_url) out.push({ type: "video", url: item.video_url });
  return out;
}

export default function AdminMenuPage() {
  const [categories,    setCategories]    = useState<ApiCategory[]>([]);
  const [items,         setItems]         = useState<AdminMenuItem[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [filterSlug,    setFilterSlug]    = useState("all");
  const [panelOpen,     setPanelOpen]     = useState(false);
  const [editItem,      setEditItem]      = useState<AdminMenuItem | null>(null);
  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [form,          setForm]          = useState<FormState>(EMPTY_FORM);
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [imgUploading,  setImgUploading]  = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [toggling,      setToggling]      = useState<string | null>(null);
  const [compressPrompt, setCompressPrompt] = useState<{
    file: File;
    info: ImageInfo;
  } | null>(null);
  const [compressToast, setCompressToast] = useState<{
    before: ImageInfo;
    after: ImageInfo;
  } | null>(null);

  /* ── Storage との整合を取るための持ち物（パネル1回ぶん） ──
     ファイルは選んだ瞬間にアップロードするので、Storage と DB のどちらが先に
     動くかで壊れ方が変わる。**DBを正として、Storageは後から追従させる**:
     - このパネルで新しく上げたぶん（＝まだどこからも参照されていない）
       → 保存せず閉じたら消す。残すと孤児になる
     - もともと保存されていたぶんを外した場合
       → 保存が通ってから消す。先に消すとキャンセルしたときに
         DBの参照だけが残って画像が壊れる */
  const sessionUploads   = useRef<MediaItem[]>([]);
  const pendingDeletions = useRef<MediaItem[]>([]);

  /* ── データ取得 ── */
  const loadAll = async () => {
    setLoading(true);
    try {
      const [cats, rawItems] = await Promise.all([
        fetchCategories(),
        supabase
          .from("menu_items")
          .select(
            "id, category_id, name, description, price, image_url, additional_images, video_url, media_order, tag, is_available, is_takeout, display_order"
          )
          .order("display_order")
          .then(({ data }) => data ?? []),
      ]);

      setCategories(cats);

      const catMap = Object.fromEntries(cats.map((c) => [c.id, c.slug]));
      setItems(
        rawItems.map((r) => ({
          ...r,
          category_slug: catMap[r.category_id] ?? "",
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("admin-menu-items")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── フィルタ ──
     テイクアウト商品は category_id が NULL なのでどのカテゴリーにも該当しない。
     専用チップで絞れないと店内メニューに埋もれて実質たどり着けないため、
     「提供形態」の軸として独立したフィルターを用意する。 */
  const displayed =
    filterSlug === "all"
      ? items
      : filterSlug === TAKEOUT_FILTER
        ? items.filter((i) => i.is_takeout)
        : items.filter((i) => i.category_id === categories.find((c) => c.slug === filterSlug)?.id);

  /* ── 並び替え（display_order を1リクエストで永続化。PC=⠿ドラッグ / SP=▲▼）──
     **絞り込み中だけ**並び替えられる。トップページはカテゴリーごとに横並びで出るので、
     店舗側が調整したいのは「そのカテゴリーの中での並び」であって全商品の通し順ではない。
     「すべて」で許すと80品の中から目的の2品を隣接させる操作になり非現実的なので、
     UIごと隠している（display_order はグローバルな単一列のまま。
     絞り込み中の並び替えは「掴んだ行をドロップ先のグローバル位置へ移す」だけなので
     他カテゴリーの相対順序は保たれる）。 */
  const reorderEnabled = filterSlug !== "all";
  const persistOrder = useCallback(
    async (changed: { id: string; display_order: number }[]) => {
      const { error } = await supabase.rpc("reorder_menu_items", { p_items: changed });
      if (error) throw error;
    },
    []
  );
  const { bindingsFor, moveToTarget } = useDragReorder<AdminMenuItem>({
    items,
    setItems,
    persist: persistOrder,
    disabled: !reorderEnabled,
  });

  /* SPの▲▼は「表示中の隣の行」と入れ替える。全件配列の隣ではないので
     絞り込み中でも見たままの順序で動く */
  const moveBindings = (index: number) => {
    if (!reorderEnabled) return undefined;
    return {
      up:   () => { if (index > 0) moveToTarget(displayed[index].id, displayed[index - 1].id); },
      down: () => { if (index < displayed.length - 1) moveToTarget(displayed[index].id, displayed[index + 1].id); },
      isFirst: index === 0,
      isLast: index === displayed.length - 1,
    };
  };

  /* ── パネルを開く ──
     初期値は「いま見ているフィルター」に合わせる。
     旧 /admin/takeout を統合したので、テイクアウト商品の追加はこの画面の
     テイクアウトフィルター＋＜新規追加＞が入口になる。そこで作った商品が
     追加直後にリストから消える（＝is_takeout が false のまま保存される）のを防ぐため、
     テイクアウトフィルター中はトグルONかつカテゴリーなしを既定にする。 */
  /* パネルを開くたびに前回の持ち越しを捨てる（開き直しで二重に消さないため） */
  const resetStorageBookkeeping = () => {
    sessionUploads.current   = [];
    pendingDeletions.current = [];
  };

  const openCreate = () => {
    setEditItem(null);
    resetStorageBookkeeping();
    const isTakeoutFilter = filterSlug === TAKEOUT_FILTER;
    setForm({
      ...EMPTY_FORM,
      is_takeout: isTakeoutFilter,
      category_id: isTakeoutFilter
        ? ""
        : (categories.find((c) => c.slug === filterSlug)?.id ?? categories[0]?.id ?? ""),
    });
    setPanelOpen(true);
  };

  const openEdit = (item: AdminMenuItem) => {
    setEditItem(item);
    resetStorageBookkeeping();
    setForm({
      category_id:     item.category_id ?? "",
      name:            item.name,
      description:     item.description ?? "",
      price:           String(item.price),
      media:           buildMediaFromRow(item),
      tag:             item.tag ?? "",
      is_available:    item.is_available,
      is_takeout:      item.is_takeout,
      display_order:   String(item.display_order),
    });
    setPanelOpen(true);
  };

  /* 保存せずに閉じる（×・キャンセル・背景クリック）。
     このパネルで上げたぶんはどこからも参照されないので Storage から消す。
     外したつもりの既存メディアは**消さない**（DBの参照が残ったままなので）。 */
  const cancelPanel = () => {
    const orphans = sessionUploads.current;
    resetStorageBookkeeping();
    setPanelOpen(false);
    setEditItem(null);
    if (orphans.length > 0) void deleteUploadedMedia(orphans);
  };

  /* 保存・削除が済んだあとに閉じる。上げたぶんは本採用なので消さない */
  const closePanel = () => {
    resetStorageBookkeeping();
    setPanelOpen(false);
    setEditItem(null);
  };

  /* ── メディア操作 ── */
  const imageCount = form.media.filter((m) => m.type === "image").length;
  const videoCount = form.media.filter((m) => m.type === "video").length;

  const uploadAndAppendImage = async (
    file: File,
    info: { before?: ImageInfo; after?: ImageInfo }
  ) => {
    setImgUploading(true);
    try {
      const ext  = file.name.split(".").pop() ?? "jpg";
      const path = `menu/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url  = await uploadMenuImage(file, path);
      sessionUploads.current.push({ type: "image", url });
      setForm((f) => ({ ...f, media: [...f.media, { type: "image", url }] }));
      if (info.before && info.after) {
        setCompressToast({ before: info.before, after: info.after });
        setTimeout(() => setCompressToast(null), 4500);
      }
    } catch (err) {
      alert("画像のアップロードに失敗しました: " + String(err));
    } finally {
      setImgUploading(false);
    }
  };

  const handleAddImageFile = async (file: File) => {
    if (imageCount >= MAX_IMAGES) {
      alert(`画像は ${MAX_IMAGES} 枚までです。`);
      return;
    }
    try {
      const { width, height, size, needsCompression } = await inspectImage(file);
      if (!needsCompression) {
        // 小さい画像はそのままアップロード
        await uploadAndAppendImage(file, {});
        return;
      }
      // 圧縮するか確認（カスタムモーダル）
      setCompressPrompt({ file, info: { width, height, size } });
    } catch (err) {
      alert("画像の読み込みに失敗しました: " + String(err));
    }
  };

  const acceptCompression = async () => {
    if (!compressPrompt) return;
    const { file } = compressPrompt;
    setCompressPrompt(null);
    setImgUploading(true);
    try {
      const result = await compressImage(file);
      await uploadAndAppendImage(result.file, {
        before: result.before,
        after:  result.after,
      });
    } catch (err) {
      alert("画像の圧縮に失敗しました: " + String(err));
      setImgUploading(false);
    }
  };

  /* 「そのまま」= 縮めたくない、という意思表示。寸法は保ったまま WebP には
     変換しておく（元が PNG だと数MBのまま客側の一覧に載ってしまうため）。
     変換自体に失敗したら元ファイルをそのまま上げてアップロードは通す。 */
  const declineCompression = async () => {
    if (!compressPrompt) return;
    const { file } = compressPrompt;
    setCompressPrompt(null);
    setImgUploading(true);
    try {
      const result = await compressImage(file, { resize: false });
      await uploadAndAppendImage(result.file, {
        before: result.before,
        after:  result.after,
      });
    } catch {
      await uploadAndAppendImage(file, {});
    }
  };

  const handleAddVideoFile = async (file: File) => {
    if (videoCount >= MAX_VIDEOS) {
      alert("動画は 1 本までです。");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      alert("動画ファイルが 50MB を超えています。短い動画にするか圧縮してください。");
      return;
    }
    setVideoUploading(true);
    try {
      const path = `menu/${Date.now()}-${file.name}`;
      const url  = await uploadMenuVideo(file, path);
      sessionUploads.current.push({ type: "video", url });
      setForm((f) => ({ ...f, media: [...f.media, { type: "video", url }] }));
    } catch (err) {
      alert("動画のアップロードに失敗しました: " + String(err));
    } finally {
      setVideoUploading(false);
    }
  };

  /* Figmaのタイル型アップローダーは追加口が1つのため、選択ファイルのMIMEタイプで
     既存の画像/動画それぞれのアップロードフローへ振り分ける */
  const handleAddMediaFile = (file: File) => {
    if (file.type.startsWith("video/")) {
      handleAddVideoFile(file);
    } else {
      handleAddImageFile(file);
    }
  };

  const handleRemoveMedia = (idx: number) => {
    const target = form.media[idx];
    setForm((f) => ({ ...f, media: f.media.filter((_, i) => i !== idx) }));
    if (!target) return;

    const uploadedHere = sessionUploads.current.findIndex((m) => m.url === target.url);
    if (uploadedHere !== -1) {
      // このパネルで上げたぶん。DBはまだ知らないので、その場で消してよい
      sessionUploads.current.splice(uploadedHere, 1);
      void deleteUploadedMedia([target]);
      return;
    }
    // もともと保存されていたぶん。ここで消すと、キャンセルされたときに
    // DBの参照だけが残って画像が壊れる。保存が通ってから消す
    pendingDeletions.current.push(target);
  };

  const moveMedia = (from: number, to: number) => {
    if (from === to) return;
    setForm((f) => {
      const next = [...f.media];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...f, media: next };
    });
  };

  /* ── フォーム送信 ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseInt(form.price);
    if (isNaN(price) || price <= 0) { alert("価格を正しく入力してください"); return; }

    setSaving(true);
    try {
      // media_order を正として、legacy カラムも同期
      const images = form.media.filter((m) => m.type === "image").map((m) => m.url);
      const video  = form.media.find((m) => m.type === "video")?.url ?? null;
      const payload = {
        // 未選択（テイクアウト商品）は空文字ではなく NULL で保存する
        category_id:       form.category_id || null,
        name:              form.name,
        description:       form.description || null,
        price,
        image_url:         images[0] ?? null,
        additional_images: images.slice(1),
        video_url:         video,
        media_order:       form.media,
        tag:               form.tag || null,
        is_available:      form.is_available,
        is_takeout:        form.is_takeout,
        display_order:     parseInt(form.display_order) || 99,
      };

      if (editItem) {
        const { error } = await supabase
          .from("menu_items")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { data: store } = await supabase.from("stores").select("id").single();
        if (!store) throw new Error("店舗データが見つかりません");

        const { error } = await supabase.from("menu_items").insert({
          ...payload,
          store_id: store.id,
        });
        if (error) throw error;
      }

      // DBが新しいメディア一覧を指したので、外されたぶんを Storage から消す。
      // 保存より前にやるとキャンセル時に参照だけが残るため、必ずこの順番で。
      // 失敗しても保存は成功しているので、ユーザー操作はブロックしない。
      const removed = pendingDeletions.current;
      closePanel();
      if (removed.length > 0) void deleteUploadedMedia(removed);
      await loadAll();
    } catch (err) {
      alert("保存に失敗しました: " + String(err));
    } finally {
      setSaving(false);
    }
  };

  /* ── 削除 ── */
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("menu_items").delete().eq("id", deleteId);
      if (error) throw error;
      setDeleteId(null);
      // 商品ごと消えるので、このパネルで上げたぶんは確実に孤児になる。
      // （もともと保存されていた画像の掃除は別件。ここでは触らない）
      const orphans = sessionUploads.current;
      closePanel();
      if (orphans.length > 0) void deleteUploadedMedia(orphans);
      await loadAll();
    } catch (err) {
      alert("削除に失敗しました: " + String(err));
    } finally {
      setDeleting(false);
    }
  };

  /* ── 公開フラグ切替 ── */
  const handleToggleAvailable = async (item: AdminMenuItem) => {
    setToggling(item.id);
    try {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_available: !item.is_available })
        .eq("id", item.id);
      if (error) throw error;
      await loadAll();
    } finally {
      setToggling(null);
    }
  };

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  const selectedCategory = categories.find((c) => c.id === form.category_id);
  const previewImageUrl = form.media.find((m) => m.type === "image")?.url ?? null;

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar
            title="メニュー管理"
            onMenuClick={openDrawer}
            action={
              <div className="flex gap-[var(--space-8)] items-center shrink-0">
              {/* 「ベストセラーの設定」ボタンはここから外した。
                  表示設定（/admin/display）の「ベストセラー」タブに移設している。 */}
              <button
                type="button"
                onClick={openCreate}
                className="bg-accent-primary rounded-[var(--radius-full)] shrink-0 flex items-center justify-center size-[44px] lg:size-auto lg:px-[var(--space-16)] lg:py-[10px]"
              >
                <span className="lg:hidden font-jp font-bold text-[17px] leading-[1.4] tracking-[0.17px] text-text-primary">
                  ＋
                </span>
                <span className="hidden lg:inline font-jp font-bold text-[14px] leading-[1.6] tracking-[0.14px] text-text-primary whitespace-nowrap">
                  ＋ 新規追加
                </span>
              </button>
              </div>
            }
          />

          <main className="flex-1 overflow-y-auto flex flex-col">
            {/* ── ヒント文言（PC/SPでFigma記載の文言が異なる）
                main が flex-col + overflow-y-auto のため、shrink-0 を付けないと
                下の一覧（flex-1）に押し潰されて高さが欠ける ── */}
            {/* 「すべて」表示中は並び替えできないので、ヒント自体を出さない */}
            {reorderEnabled && (
              <p className="hidden lg:block shrink-0 px-[var(--space-24)] py-[var(--space-4)] type-jp-caption text-text-tertiary">
                {filterSlug === TAKEOUT_FILTER
                  ? "⠿ をドラッグして並び替えると、テイクアウト画面での表示順が変わります"
                  : "⠿ をドラッグして並び替えると、メニュー画面での表示順が変わります"}
              </p>
            )}
            <p className="lg:hidden shrink-0 px-[var(--space-16)] pt-[var(--space-20)] pb-[var(--space-12)] type-jp-caption text-text-secondary">
              {!reorderEnabled
                ? "編集ボタンから表示・非表示の切り替えができます。"
                : filterSlug === TAKEOUT_FILTER
                  ? "▲▼ で並び替えると、テイクアウト画面での表示順が変わります。編集ボタンから表示・非表示の切り替えができます。"
                  : "▲▼ で並び替えると、メニュー画面での表示順が変わります。編集ボタンから表示・非表示の切り替えができます。"}
            </p>

            {/* ── フィルター行（すべて → テイクアウト → 各カテゴリー）
                テイクアウトを2番目に置くのは、カテゴリーではなく「提供形態」の別軸だと
                示すためと、SP幅(390px)でも横スクロールせず常に見える位置に収めるため。
                shrink-0 が無いと一覧に押し潰されてチップが1/3しか見えなくなる ── */}
            <div
              className="flex shrink-0 gap-[var(--space-8)] overflow-x-auto px-[var(--space-16)] lg:px-[var(--space-24)] pb-[var(--space-12)]"
              style={{ scrollbarWidth: "none" }}
            >
              <button
                type="button"
                onClick={() => setFilterSlug("all")}
                className={`shrink-0 px-[14px] py-[var(--space-8)] rounded-[var(--radius-full)] type-jp-body whitespace-nowrap ${
                  filterSlug === "all"
                    ? "bg-surface-ink text-text-inverse"
                    : "bg-bg-tertiary text-text-primary"
                }`}
              >
                すべて
              </button>
              <button
                type="button"
                onClick={() => setFilterSlug(TAKEOUT_FILTER)}
                className={`shrink-0 flex gap-[6px] items-center px-[14px] py-[var(--space-8)] rounded-[var(--radius-full)] type-jp-body whitespace-nowrap ${
                  filterSlug === TAKEOUT_FILTER
                    ? "bg-surface-ink text-text-inverse"
                    : "bg-bg-tertiary text-text-primary"
                }`}
              >
                <Icon name="bag" className="shrink-0 w-3.5 h-3.5" />
                テイクアウト
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFilterSlug(cat.slug)}
                  className={`shrink-0 px-[14px] py-[var(--space-8)] rounded-[var(--radius-full)] type-jp-body whitespace-nowrap ${
                    filterSlug === cat.slug
                      ? "bg-surface-ink text-text-inverse"
                      : "bg-bg-tertiary text-text-primary"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* ── メニューアイテム一覧 ── */}
            <div className="flex-1 px-[var(--space-16)] lg:px-[var(--space-24)] pb-[var(--space-20)] lg:pb-[var(--space-24)]">
              {loading ? (
                <div className="flex flex-col gap-[var(--space-8)]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-bg-tertiary rounded-[var(--radius-sm)] h-[64px] animate-pulse" />
                  ))}
                </div>
              ) : displayed.length === 0 ? (
                <div className="text-center py-20 type-jp-body text-text-tertiary">
                  このカテゴリーにメニューはありません
                </div>
              ) : (
                displayed.map((item, idx) => (
                  <AdminMenuRow
                    key={item.id}
                    name={item.name}
                    categoryLabel={item.is_takeout ? "🛍 テイクアウト" : catName(item.category_id ?? "")}
                    price={item.price}
                    thumbnailUrl={item.image_url}
                    available={item.is_available}
                    toggling={toggling === item.id}
                    onToggleAvailable={() => handleToggleAvailable(item)}
                    onEdit={() => openEdit(item)}
                    dimmed={!item.is_available}
                    reorder={reorderEnabled ? bindingsFor(item.id) : undefined}
                    move={moveBindings(idx)}
                  />
                ))
              )}
            </div>
          </main>

          {/* ── 編集/追加パネル（PC: 右420pxスライド＋プレビュー／SP: フルスクリーン） ── */}
          {panelOpen && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/40 hidden lg:block" onClick={cancelPanel} />
              <div
                className="relative bg-surface-white flex flex-col w-full h-full lg:w-[420px] overflow-hidden"
                style={{ boxShadow: "var(--shadow-float)" }}
              >
                {/* ヘッダー */}
                <div className="border-b border-border-divider flex items-center justify-between px-[var(--space-20)] lg:px-[var(--space-24)] pt-[var(--space-20)] pb-[var(--space-16)] shrink-0">
                  <h2 className="type-jp-heading-m text-text-primary">
                    {editItem ? "商品を編集" : "商品を追加"}
                  </h2>
                  <div className="flex gap-[var(--space-8)] items-center">
                    {editItem && (
                      <button
                        type="button"
                        onClick={() => setDeleteId(editItem.id)}
                        aria-label="削除"
                        className="bg-bg-tertiary flex items-center justify-center rounded-full size-[36px]"
                      >
                        <Icon name="trash" className="w-4 h-4 text-status-urgent" />
                      </button>
                    )}
                    <ModalCloseButton onClick={cancelPanel} />
                  </div>
                </div>

                {/* フォーム */}
                <form
                  id="menu-form"
                  onSubmit={handleSubmit}
                  className="flex-1 overflow-y-auto flex flex-col gap-[var(--space-20)] px-[var(--space-20)] lg:px-[var(--space-24)] py-[var(--space-20)]"
                >
                  {/* プレビュー（PCのみ） */}
                  <div className="hidden lg:flex flex-col gap-[var(--space-8)] w-full">
                    <p className="type-jp-caption-bold text-text-tertiary">
                      プレビュー（この見た目で公開されます）
                    </p>
                    <div className="flex items-center justify-center py-[var(--space-16)] rounded-[var(--radius-md)] w-full">
                      <MenuPreviewCard
                        name={form.name}
                        price={form.price}
                        tag={form.tag}
                        categoryLabel={selectedCategory?.name ?? ""}
                        categoryColor={selectedCategory?.tag_color ?? "yellow"}
                        imageUrl={previewImageUrl}
                      />
                    </div>
                  </div>

                  {/* カテゴリー
                      テイクアウト商品は category_id が NULL 可（supabase/takeout.sql で
                      NOT NULL を外している）ため、「テイクアウト対象にする」がONのときだけ
                      必須を外す。店内商品はこれまで通り必須。 */}
                  <div className="flex flex-col gap-[var(--space-4)] w-full">
                    <label className="type-jp-caption-bold text-text-primary">
                      カテゴリー{" "}
                      {form.is_takeout ? (
                        <span className="type-jp-label text-text-tertiary">（テイクアウト商品は任意）</span>
                      ) : (
                        <span className="text-status-urgent">*</span>
                      )}
                    </label>
                    <div className="relative w-full">
                      <select
                        value={form.category_id}
                        required={!form.is_takeout}
                        onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                        className="appearance-none w-full h-[44px] bg-surface-white border border-border rounded-[var(--radius-sm)] px-[var(--space-12)] type-jp-body text-text-primary"
                      >
                        <option value="">
                          {form.is_takeout ? "なし（テイクアウト専用）" : "選択してください"}
                        </option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <Icon
                        name="chevron-down"
                        className="pointer-events-none absolute right-[var(--space-12)] top-1/2 -translate-y-1/2 w-4 h-4 text-text-primary"
                      />
                    </div>
                  </div>

                  {/* 品名 */}
                  <div className="flex flex-col gap-[var(--space-4)] w-full">
                    <label className="type-jp-caption-bold text-text-primary">
                      品名 <span className="text-status-urgent">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      required
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="プレーンパンケーキ"
                      className="w-full h-[44px] bg-surface-white border border-border rounded-[var(--radius-sm)] px-[var(--space-12)] type-jp-body text-text-primary"
                    />
                  </div>

                  {/* 説明文 */}
                  <div className="flex flex-col gap-[var(--space-4)] w-full">
                    <label className="type-jp-caption-bold text-text-primary">説明文</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="ふわふわの生地にバターとメープルシロップを添えた、シンプルながら絶品のパンケーキです。"
                      rows={3}
                      className="w-full h-[90px] bg-surface-white border border-border rounded-[var(--radius-sm)] p-[var(--space-12)] type-jp-body text-text-primary resize-none"
                    />
                  </div>

                  {/* 価格 */}
                  <div className="flex flex-col gap-[var(--space-4)] w-full">
                    <label className="type-jp-caption-bold text-text-primary">
                      価格 <span className="text-status-urgent">*</span>
                    </label>
                    <input
                      type="number"
                      value={form.price}
                      required
                      min={1}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder="1200"
                      className="w-full h-[44px] bg-surface-white border border-border rounded-[var(--radius-sm)] px-[var(--space-12)] type-jp-body text-text-primary"
                    />
                  </div>

                  {/* タグ */}
                  <TagSelectField
                    value={form.tag}
                    onChange={(tag) => setForm((f) => ({ ...f, tag }))}
                  />

                  {/* メディア */}
                  <MediaUploaderField
                    media={form.media}
                    imageCount={imageCount}
                    videoCount={videoCount}
                    maxImages={MAX_IMAGES}
                    maxVideos={MAX_VIDEOS}
                    uploading={imgUploading || videoUploading}
                    onAddFile={handleAddMediaFile}
                    onRemove={handleRemoveMedia}
                    onMove={moveMedia}
                  />

                  {/* 公開設定 */}
                  <div className="flex items-center justify-between w-full">
                    <p className="type-jp-caption-bold text-text-primary">
                      公開する（注文画面に表示されます）
                    </p>
                    <ToggleSwitch
                      on={form.is_available}
                      onClick={() => setForm((f) => ({ ...f, is_available: !f.is_available }))}
                      ariaLabel="公開する"
                    />
                  </div>

                  {/* テイクアウト対象 */}
                  <div className="flex items-center justify-between w-full">
                    <p className="type-jp-caption-bold text-text-primary">
                      テイクアウト対象にする（レジのテイクアウト注文に表示されます）
                    </p>
                    <ToggleSwitch
                      on={form.is_takeout}
                      onClick={() => setForm((f) => ({ ...f, is_takeout: !f.is_takeout }))}
                      ariaLabel="テイクアウト対象にする"
                    />
                  </div>

                  {/* 表示順 */}
                  <div className="flex flex-col gap-[var(--space-4)] w-full">
                    <label className="type-jp-caption-bold text-text-primary">表示順</label>
                    <input
                      type="number"
                      value={form.display_order}
                      min={1}
                      onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
                      className="w-full h-[44px] bg-surface-white border border-border rounded-[var(--radius-sm)] px-[var(--space-12)] type-jp-body text-text-primary"
                    />
                  </div>
                </form>

                {/* フッター */}
                <div className="border-t border-border-divider flex gap-[var(--space-12)] px-[var(--space-20)] lg:px-[var(--space-24)] py-[var(--space-16)] shrink-0">
                  <button
                    type="button"
                    onClick={cancelPanel}
                    className="flex-1 h-[48px] border border-border rounded-[var(--radius-full)] font-jp font-bold text-[15px] leading-[1.45] tracking-[0.01em] text-text-secondary"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    form="menu-form"
                    disabled={saving || imgUploading || videoUploading}
                    className="flex-1 h-[48px] bg-surface-ink disabled:opacity-60 rounded-[var(--radius-full)] font-jp font-bold text-[15px] leading-[1.45] tracking-[0.01em] text-text-inverse"
                  >
                    {saving ? "保存中…" : "保存する"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 圧縮確認ダイアログ ── */}
          {compressPrompt && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-[var(--space-16)]" onClick={declineCompression}>
              <div
                className="bg-surface-white flex flex-col gap-[var(--space-16)] p-[var(--space-24)] rounded-[var(--radius-lg)] w-full max-w-[342px]"
                style={{ boxShadow: "var(--shadow-float)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-[var(--space-8)]">
                  <h3 className="type-jp-heading-m text-text-primary">画像を圧縮しますか？</h3>
                  <p className="type-jp-body text-text-secondary">
                    画像が大きいため、アップロード前に圧縮することを推奨します。
                  </p>
                  <p className="type-jp-caption text-text-tertiary">
                    現在: {compressPrompt.info.width}×{compressPrompt.info.height}px ・ {formatBytes(compressPrompt.info.size)}
                    <br />
                    目安: 長辺 {COMPRESS_MAX_EDGE}px 以内 ・ {formatBytes(COMPRESS_MAX_BYTES)} 以内（WebP）
                  </p>
                </div>
                <div className="flex gap-[var(--space-12)]">
                  <button
                    type="button"
                    onClick={declineCompression}
                    className="flex-1 h-[48px] border border-border rounded-[var(--radius-full)] type-jp-heading-s text-text-secondary"
                  >
                    そのまま
                  </button>
                  <button
                    type="button"
                    onClick={acceptCompression}
                    className="flex-1 h-[48px] bg-surface-ink rounded-[var(--radius-full)] type-jp-heading-s text-text-inverse"
                  >
                    圧縮する
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 圧縮完了トースト ── */}
          {compressToast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-surface-ink/85 text-text-inverse type-jp-caption px-[var(--space-16)] py-[var(--space-8)] rounded-[var(--radius-full)] shadow-[var(--shadow-float)] pointer-events-none">
              {compressToast.before.width}×{compressToast.before.height} →{" "}
              {compressToast.after.width}×{compressToast.after.height}
              <span className="mx-1.5 text-text-inverse/50">·</span>
              {formatBytes(compressToast.before.size)} →{" "}
              {formatBytes(compressToast.after.size)}
              {" "}
              <span className="text-status-success">
                （−{Math.max(0, Math.round((1 - compressToast.after.size / Math.max(compressToast.before.size, 1)) * 100))}%）
              </span>
            </div>
          )}

          {/* ── 削除確認ダイアログ ── */}
          {deleteId && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-[var(--space-16)]" onClick={() => setDeleteId(null)}>
              <div
                className="bg-surface-white flex flex-col gap-[var(--space-20)] items-start p-[var(--space-24)] rounded-[var(--radius-lg)] w-full max-w-[342px] lg:max-w-[400px]"
                style={{ boxShadow: "var(--shadow-float)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-[var(--space-8)] items-start text-center w-full">
                  <p className="type-jp-heading-m text-text-primary w-full">メニューを削除しますか？</p>
                  <p className="type-jp-body-small text-text-secondary w-full">
                    この操作は取り消せません。
                  </p>
                </div>
                <div className="flex gap-[var(--space-12)] items-start w-full">
                  <button
                    type="button"
                    onClick={() => setDeleteId(null)}
                    className="flex-1 border border-border py-[var(--space-16)] rounded-[var(--radius-full)] type-jp-heading-s text-text-secondary"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 bg-status-urgent disabled:opacity-50 py-[var(--space-16)] rounded-[var(--radius-full)] type-jp-heading-s text-text-inverse"
                  >
                    {deleting ? "削除中…" : "削除する"}
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
