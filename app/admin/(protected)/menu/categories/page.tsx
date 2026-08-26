"use client";

/**
 * カテゴリ管理画面（Step3-L、Figma: Categories Management / カテゴリ管理
 * — Category Row (Mobile) 429:2534 / Color Swatch Picker 306:1535）
 * categoriesテーブルのCRUD・スラッグ自動生成・Realtime更新のロジックは既存のまま。
 * 見た目のみ新デザインに差し替え。
 *
 * Figmaとの既知の差分（ユーザー確認済み事項含む）:
 * - ⠿ グリップのドラッグで表示順（display_order）を永続化する
 *   （hooks/useDragReorder.ts + supabase/list_reorder.sql）。
 * - 削除機能はFigmaに配置が無いため、編集パネルのヘッダーに削除アイコンとして
 *   配置した（新規作成時は非表示）。旧実装では一覧行に削除ボタンがあった。
 *
 * Step3-Lの不備修正: カテゴリ削除は menu_items.category_id が ON DELETE CASCADE の
 * ため該当カテゴリの商品が全件消える。削除自体はブロックしないが、確認ダイアログで
 * 実際の商品件数を出して警告する（件数取得が終わるまで削除ボタンは押せない）。
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { fetchCategories, type ApiCategory } from "@/lib/api";
import {
  uploadMenuImage,
  deleteMenuImage,
  deleteUploadedMedia,
  extractStoragePath,
} from "@/lib/storage";
import { compressImage } from "@/lib/imageCompression";
import { useDragReorder } from "@/hooks/useDragReorder";
import { type TagColor } from "@/components/ui/CategoryTag";
import AdminPageShell from "@/components/admin/AdminPageShell";
import TopBar from "@/components/admin/TopBar";
import CategoryRow from "@/components/admin/category/CategoryRow";
import ColorSwatchPicker from "@/components/admin/category/ColorSwatchPicker";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import { Icon } from "@/components/Icon";
import type { HeadingSize } from "@/lib/api";

/* ── フォーム状態 ── */
interface FormState {
  name: string;
  slug: string;
  /** カテゴリー名（英語）。お客様側の見出しに大きく出る。例: PANCAKE */
  caption: string;
  /** 説明文（40文字以内）。英語名の上に小さく出る */
  description: string;
  /** 英語名の文字サイズ */
  en_size: HeadingSize;
  /** 日本語名の文字サイズ */
  jp_size: HeadingSize;
  /** お客様側の並び。フードが先、ドリンクが後にまとまる */
  category_type: "food" | "drink";
  display_order: number;
  image_url: string;
  tag_color: TagColor;
}
const EMPTY_FORM: FormState = {
  name: "", slug: "", caption: "", description: "",
  // 既定値は、DB管理に移す前の見た目と同じ組み合わせ
  en_size: "large", jp_size: "small", category_type: "food",
  display_order: 99, image_url: "", tag_color: "yellow",
};

/** 説明文の上限。DB側にも CHECK 制約がある（supabase/category_heading.sql） */
const DESCRIPTION_MAX = 40;

const SIZE_OPTIONS: { value: HeadingSize; label: string }[] = [
  { value: "large",  label: "大" },
  { value: "medium", label: "中" },
  { value: "small",  label: "小" },
];

/** 見出しの文字サイズを選ぶ（大・中・小）。既存のデザイントークンに対応する */
function SizeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HeadingSize;
  onChange: (v: HeadingSize) => void;
}) {
  return (
    <div className="flex items-center gap-[var(--space-8)]">
      {label && <span className="type-jp-caption text-text-tertiary">{label}</span>}
      <div className="flex gap-[var(--space-4)]">
        {SIZE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={`h-[32px] min-w-[44px] px-[var(--space-12)] rounded-[var(--radius-sm)] border type-jp-caption-bold transition-colors ${
              value === opt.value
                ? "bg-text-primary text-surface-white border-transparent"
                : "bg-surface-white text-text-secondary border-border"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── 差し替えで参照されなくなったカテゴリ画像をStorageから削除する（best-effort） ── */
async function deleteReplacedCategoryImage(
  previousUrl: string | null,
  nextUrl: string | null
) {
  if (!previousUrl || previousUrl === nextUrl) return;
  const path = extractStoragePath(previousUrl);
  // Storage由来でないURL（初期データのローカル画像など）は対象外
  if (path === previousUrl) return;
  try {
    await deleteMenuImage(path);
  } catch (err) {
    console.warn("[admin/categories] 旧カテゴリ画像のStorage削除に失敗（無視）:", err);
  }
}

/* ── slug 自動生成 ── */
function toSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/* 削除確認ダイアログで出す「このカテゴリに属する商品の件数」の取得状態 */
type DeleteTarget = {
  category: ApiCategory;
  itemCount: number | null;   // null = 未取得
  countFailed: boolean;
};

export default function AdminCategoriesPage() {
  const [categories,   setCategories]   = useState<ApiCategory[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [editItem,     setEditItem]     = useState<ApiCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [form,         setForm]         = useState<FormState>(EMPTY_FORM);
  const [preview,      setPreview]      = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  /* このパネルで新しく上げた画像。保存されなければどこからも参照されないので、
     閉じるときに Storage から消す（放っておくと孤児オブジェクトが溜まる）。
     保存済みの旧画像を消すのは handleSubmit 側（deleteReplacedCategoryImage）。 */
  const sessionUpload = useRef<string | null>(null);

  /* ── データ取得 ── */
  const load = async () => {
    setLoading(true);
    try {
      setCategories(await fetchCategories());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-categories")
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── パネルを開く ── */
  const openCreate = () => {
    setEditItem(null);
    sessionUpload.current = null;
    setForm(EMPTY_FORM);
    setPreview(null);
    setPanelOpen(true);
  };

  const openEdit = (cat: ApiCategory) => {
    setEditItem(cat);
    sessionUpload.current = null;
    setForm({
      name:          cat.name,
      slug:          cat.slug,
      caption:       cat.caption ?? "",
      description:   cat.description ?? "",
      en_size:       cat.en_size ?? "large",
      jp_size:       cat.jp_size ?? "small",
      category_type: cat.category_type ?? "food",
      display_order: cat.display_order,
      image_url:     cat.image_url ?? "",
      tag_color:     cat.tag_color ?? "yellow",
    });
    setPreview(cat.image_url);
    setPanelOpen(true);
  };

  /* 保存せずに閉じる（×・キャンセル・背景クリック）。
     このパネルで上げた画像はDBがまだ知らないので Storage から消す。 */
  const cancelPanel = () => {
    const orphan = sessionUpload.current;
    sessionUpload.current = null;
    setPanelOpen(false);
    setEditItem(null);
    if (orphan) void deleteUploadedMedia([{ type: "image", url: orphan }]);
  };

  /* 保存・削除が済んだあとに閉じる。上げた画像は本採用なので消さない */
  const closePanel = () => {
    sessionUpload.current = null;
    setPanelOpen(false);
    setEditItem(null);
  };

  /* ── ⠿ ドラッグ並び替え（display_order を1リクエストで永続化） ── */
  const persistOrder = useCallback(
    async (changed: { id: string; display_order: number }[]) => {
      const { error } = await supabase.rpc("reorder_categories", { p_items: changed });
      if (error) throw error;
    },
    []
  );
  const { bindingsFor, moveToTarget } = useDragReorder<ApiCategory>({
    items: categories,
    setItems: setCategories,
    persist: persistOrder,
  });

  /* SPは▲▼で並び替える（スマホのドラッグは長押しメニューが出て実用に耐えないため）。
     カテゴリ管理は一覧が常に全件なので、メニュー管理と違って常時並び替え可能でよい */
  const moveBindings = (index: number) => ({
    up:   () => { if (index > 0) moveToTarget(categories[index].id, categories[index - 1].id); },
    down: () => { if (index < categories.length - 1) moveToTarget(categories[index].id, categories[index + 1].id); },
    isFirst: index === 0,
    isLast: index === categories.length - 1,
  });

  /* ── 画像アップロード ── */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setImgUploading(true);
    try {
      // カテゴリ画像は客側の一覧トップに並ぶので、確認を挟まず常に WebP へ落とす。
      // （商品画像と違って装飾用途で、原寸を残す理由がない）
      // 変換に失敗しても登録自体は通したいので、その場合は元ファイルを使う。
      const upload = await compressImage(file).then((r) => r.file).catch(() => file);
      const ext  = upload.name.split(".").pop() ?? "jpg";
      const path = `categories/${Date.now()}.${ext}`;
      const url  = await uploadMenuImage(upload, path);
      // 同じパネル内で選び直した場合、1枚前のアップロードは即座に孤児になる。
      // 保存を待つ理由が無いのでここで消す（DBはまだどちらも参照していない）
      const superseded = sessionUpload.current;
      sessionUpload.current = url;
      if (superseded && superseded !== url) {
        void deleteUploadedMedia([{ type: "image", url: superseded }]);
      }
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      alert("画像のアップロードに失敗しました: " + String(err));
    } finally {
      setImgUploading(false);
    }
  };

  /* ── フォーム送信 ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slug.trim()) { alert("スラッグを入力してください"); return; }
    setSaving(true);
    try {
      if (editItem) {
        const previousImageUrl = editItem.image_url;
        const { error } = await supabase
          .from("categories")
          .update({
            name:          form.name,
            slug:          form.slug,
            caption:       form.caption || null,
            description:   form.description || null,
            en_size:       form.en_size,
            jp_size:       form.jp_size,
            category_type: form.category_type,
            display_order: form.display_order,
            image_url:     form.image_url || null,
            tag_color:     form.tag_color,
          })
          .eq("id", editItem.id);
        if (error) throw error;

        // 画像を差し替えた場合、DBが新しい画像を指したあとで旧オブジェクトを
        // Storageから消す。保存前に消すとキャンセル時にDBの参照だけが残って
        // 画像が壊れるため、必ず保存成功後に行う。
        // 削除失敗はユーザー操作をブロックしない（警告ログのみ）。
        await deleteReplacedCategoryImage(previousImageUrl, form.image_url || null);
      } else {
        // store_id は固定（setup.sql の初期データに合わせる）
        const { data: store } = await supabase
          .from("stores")
          .select("id")
          .single();
        if (!store) throw new Error("店舗データが見つかりません");

        const { error } = await supabase.from("categories").insert({
          store_id:      store.id,
          name:          form.name,
          slug:          form.slug,
          caption:       form.caption || null,
          description:   form.description || null,
          en_size:       form.en_size,
          jp_size:       form.jp_size,
          category_type: form.category_type,
          display_order: form.display_order,
          image_url:     form.image_url || null,
          tag_color:     form.tag_color,
        });
        if (error) throw error;
      }
      closePanel();
      await load();
    } catch (err) {
      alert("保存に失敗しました: " + String(err));
    } finally {
      setSaving(false);
    }
  };

  /* ── 削除 ──
     menu_items.category_id は ON DELETE CASCADE。削除前に巻き添えになる商品の
     実件数を数えて確認ダイアログに出す（削除自体はブロックしない）。 */
  const openDelete = async (cat: ApiCategory) => {
    setDeleteTarget({ category: cat, itemCount: null, countFailed: false });
    const { count, error } = await supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("category_id", cat.id);
    setDeleteTarget((prev) =>
      prev && prev.category.id === cat.id
        ? { ...prev, itemCount: error ? null : count ?? 0, countFailed: Boolean(error) }
        : prev
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", deleteTarget.category.id);
      if (error) throw error;
      setDeleteTarget(null);
      // カテゴリごと消えるので、このパネルで上げた画像は確実に孤児になる
      cancelPanel();
      await load();
    } catch (err) {
      alert("削除に失敗しました: " + String(err));
    } finally {
      setDeleting(false);
    }
  };

  const deleteCounting = deleteTarget !== null && deleteTarget.itemCount === null && !deleteTarget.countFailed;

  return (
    <AdminPageShell>
      {({ openDrawer }) => (
        <>
          <TopBar
            title="カテゴリ管理"
            onMenuClick={openDrawer}
            action={
              <button
                type="button"
                onClick={openCreate}
                className="bg-accent-primary rounded-[var(--radius-full)] shrink-0 flex items-center justify-center size-[44px] lg:size-auto lg:px-[var(--space-16)] lg:py-[10px]"
              >
                <span className="lg:hidden font-jp font-bold text-[17px] leading-[1.4] tracking-[0.17px] text-text-primary">
                  ＋
                </span>
                <span className="hidden lg:inline font-jp font-bold text-[14px] leading-[1.6] tracking-[0.14px] text-text-primary whitespace-nowrap">
                  ＋ カテゴリ追加
                </span>
              </button>
            }
          />

          <main className="flex-1 overflow-y-auto flex flex-col">
            {/* ── ヒント文言（Figma: Hint Wrap 327:2131。PC/SPとも同一文言・句点なし） ── */}
            <p className="hidden lg:block px-[var(--space-24)] py-[var(--space-4)] type-jp-caption text-text-tertiary">
              ⠿ をドラッグして並び替えると、メニュー画面での表示順が変わります
            </p>
            <p className="lg:hidden px-[var(--space-16)] pt-[var(--space-20)] pb-[var(--space-12)] type-jp-caption text-text-secondary">
              ▲▼ で並び替えると、メニュー画面での表示順が変わります
            </p>

            {/* ── カテゴリ一覧（Figma: List Scroll 309:323 — PCは左右24・上8） ── */}
            <div className="flex-1 px-[var(--space-16)] lg:px-[var(--space-24)] lg:pt-[var(--space-8)] pb-[var(--space-20)] lg:pb-[var(--space-24)]">
              {loading ? (
                <div className="flex flex-col gap-[var(--space-8)]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-bg-tertiary rounded-[var(--radius-sm)] h-[56px] animate-pulse" />
                  ))}
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-20 type-jp-body text-text-tertiary">
                  カテゴリがまだありません
                </div>
              ) : (
                categories.map((cat, idx) => (
                  <CategoryRow
                    key={cat.id}
                    name={cat.name}
                    slug={cat.slug}
                    thumbnailUrl={cat.image_url}
                    tagColor={cat.tag_color ?? "yellow"}
                    categoryType={cat.category_type}
                    displayOrder={cat.display_order}
                    onEdit={() => openEdit(cat)}
                    reorder={bindingsFor(cat.id)}
                    move={moveBindings(idx)}
                  />
                ))
              )}
            </div>
          </main>

          {/* ── 編集/追加パネル（PC: 右420pxスライド／SP: フルスクリーン） ── */}
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
                    {editItem ? "カテゴリを編集" : "カテゴリを追加"}
                  </h2>
                  <div className="flex gap-[var(--space-8)] items-center">
                    {editItem && (
                      <button
                        type="button"
                        onClick={() => openDelete(editItem)}
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
                  id="cat-form"
                  onSubmit={handleSubmit}
                  className="flex-1 overflow-y-auto flex flex-col gap-[var(--space-20)] px-[var(--space-20)] lg:px-[var(--space-24)] py-[var(--space-20)]"
                >
                  {/* カテゴリ名 */}
                  <div className="flex flex-col gap-[var(--space-4)] w-full">
                    <label className="type-jp-caption-bold text-text-primary">
                      カテゴリ名（日本語）<span className="text-status-urgent">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      required
                      onChange={(e) => {
                        const name = e.target.value;
                        setForm((f) => ({
                          ...f,
                          name,
                          slug: editItem ? f.slug : toSlug(name),
                        }));
                      }}
                      placeholder="パンケーキ"
                      className="w-full h-[44px] bg-surface-white border border-border rounded-[var(--radius-sm)] px-[var(--space-12)] type-jp-body text-text-primary"
                    />
                    {/* 英語名と同じく、入力欄の直下に文字サイズを置く */}
                    <SizeSelect
                      label="文字サイズ"
                      value={form.jp_size}
                      onChange={(v) => setForm((f) => ({ ...f, jp_size: v }))}
                    />
                  </div>

                  {/* 区分（フード / ドリンク）
                      お客様側の並びを決める。フードが先、ドリンクが後にまとまる。 */}
                  <div className="flex flex-col gap-[var(--space-4)] w-full">
                    <label className="type-jp-caption-bold text-text-primary">区分</label>
                    <div className="flex gap-[var(--space-4)]">
                      {([
                        { value: "food",  label: "フード" },
                        { value: "drink", label: "ドリンク" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, category_type: opt.value }))}
                          aria-pressed={form.category_type === opt.value}
                          className={`h-[36px] px-[var(--space-16)] rounded-[var(--radius-sm)] border type-jp-caption-bold transition-colors ${
                            form.category_type === opt.value
                              ? "bg-text-primary text-surface-white border-transparent"
                              : "bg-surface-white text-text-secondary border-border"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="type-jp-caption text-text-tertiary">
                      お客様のメニュー画面で、フードが先・ドリンクが後にまとまって並びます。
                    </p>
                  </div>

                  {/* スラッグ */}
                  <div className="flex flex-col gap-[var(--space-4)] w-full">
                    <label className="type-jp-caption-bold text-text-primary">
                      スラッグ（URL）<span className="text-status-urgent">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.slug}
                      required
                      onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                      placeholder="pancake"
                      className="w-full h-[44px] bg-surface-white border border-border rounded-[var(--radius-sm)] px-[var(--space-12)] type-jp-body text-text-primary"
                    />
                    <p className="type-jp-label text-text-tertiary">
                      半角英数・アンダースコアのみ。URLに使用されます。
                    </p>
                  </div>

                  {/* カテゴリ名（英語）── お客様側の見出しに大きく出る */}
                  <div className="flex flex-col gap-[var(--space-4)] w-full">
                    <label className="type-jp-caption-bold text-text-primary">カテゴリ名（英語）</label>
                    <input
                      type="text"
                      value={form.caption}
                      onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
                      placeholder="PANCAKE"
                      className="w-full h-[44px] bg-surface-white border border-border rounded-[var(--radius-sm)] px-[var(--space-12)] type-jp-body text-text-primary"
                    />
                    <SizeSelect
                      label="文字サイズ"
                      value={form.en_size}
                      onChange={(v) => setForm((f) => ({ ...f, en_size: v }))}
                    />
                  </div>

                  {/* 説明文（40文字以内）── 英語名の上に小さく出る */}
                  <div className="flex flex-col gap-[var(--space-4)] w-full">
                    <div className="flex items-baseline justify-between">
                      <label className="type-jp-caption-bold text-text-primary">説明文</label>
                      <span
                        className={`type-jp-caption ${
                          form.description.length > DESCRIPTION_MAX
                            ? "text-status-urgent"
                            : "text-text-tertiary"
                        }`}
                      >
                        {form.description.length} / {DESCRIPTION_MAX}
                      </span>
                    </div>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="これがYORKYSの原点！看板メニュー"
                      rows={2}
                      maxLength={DESCRIPTION_MAX}
                      className="w-full h-[72px] bg-surface-white border border-border rounded-[var(--radius-sm)] p-[var(--space-12)] type-jp-body text-text-primary resize-none"
                    />
                  </div>

                  {/* カテゴリ画像（1枚のみ・圧縮モーダル無しの既存仕様のまま） */}
                  <div className="flex flex-col gap-[var(--space-8)] w-full">
                    <p className="type-jp-caption-bold text-text-primary">カテゴリ画像</p>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className={`relative bg-bg-tertiary flex items-center justify-center overflow-hidden rounded-[var(--radius-sm)] w-full aspect-[16/7] ${
                        preview ? "" : "border-[1.5px] border-border border-dashed"
                      }`}
                    >
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span className="type-jp-caption-bold text-text-tertiary">＋ 画像を選択</span>
                      )}
                      {imgUploading && (
                        <span className="absolute inset-0 bg-surface-white/70 flex items-center justify-center">
                          <span className="w-5 h-5 border-2 border-border border-t-text-primary rounded-full animate-spin" />
                        </span>
                      )}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <p className="type-jp-label text-text-tertiary">
                      1枚のみ。メニュー画面のカテゴリカードのカバーに使われます。
                    </p>
                  </div>

                  {/* タグの色 */}
                  <ColorSwatchPicker
                    value={form.tag_color}
                    onChange={(tag_color) => setForm((f) => ({ ...f, tag_color }))}
                  />

                  {/* 表示順 */}
                  <div className="flex flex-col gap-[var(--space-4)] w-full">
                    <label className="type-jp-caption-bold text-text-primary">表示順</label>
                    <input
                      type="number"
                      value={form.display_order}
                      min={1}
                      onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 99 }))}
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
                    form="cat-form"
                    disabled={saving || imgUploading}
                    className="flex-1 h-[48px] bg-surface-ink disabled:opacity-60 rounded-[var(--radius-full)] font-jp font-bold text-[15px] leading-[1.45] tracking-[0.01em] text-text-inverse"
                  >
                    {saving ? "保存中…" : "保存する"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 削除確認ダイアログ（巻き添えになる商品の実件数を表示） ── */}
          {deleteTarget && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-[var(--space-16)]"
              onClick={() => !deleting && setDeleteTarget(null)}
            >
              <div
                className="bg-surface-white flex flex-col gap-[var(--space-20)] items-start p-[var(--space-24)] rounded-[var(--radius-lg)] w-full max-w-[342px] lg:max-w-[400px]"
                style={{ boxShadow: "var(--shadow-float)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-[var(--space-8)] items-start text-center w-full">
                  <p className="type-jp-heading-m text-text-primary w-full">
                    「{deleteTarget.category.name}」を削除しますか？
                  </p>
                  <p className="type-jp-body-small text-text-secondary w-full">
                    {deleteCounting
                      ? "このカテゴリに属する商品の件数を確認しています…"
                      : deleteTarget.countFailed
                        ? "商品件数を取得できませんでした。このカテゴリに属する商品も全て削除されます。この操作は取り消せません。"
                        : deleteTarget.itemCount === 0
                          ? "このカテゴリに商品はありません。この操作は取り消せません。"
                          : `このカテゴリには${deleteTarget.itemCount}件の商品があります。削除すると商品も全て削除されます。この操作は取り消せません。`}
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
                    onClick={handleDelete}
                    disabled={deleting || deleteCounting}
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
