"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { type ApiMenuItem, type ApiMediaItem } from "@/lib/api";
import {
  uploadMenuImage,
  uploadMenuVideo,
  deleteMenuVideo,
  extractVideoStoragePath,
} from "@/lib/storage";
import {
  inspectImage,
  compressImage,
  formatBytes,
  type ImageInfo,
} from "@/lib/imageCompression";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_IMAGES = 5;
const MAX_VIDEOS = 1;
const STORE_ID   = "10000000-0000-0000-0000-000000000001";

type AdminMenuItem = ApiMenuItem;
type MediaItem = ApiMediaItem;

interface FormState {
  name: string;
  description: string;
  price: string;
  media: MediaItem[];
  is_available: boolean;
  display_order: string;
}
const EMPTY_FORM: FormState = {
  name: "", description: "", price: "",
  media: [],
  is_available: true, display_order: "99",
};

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

export default function AdminTakeoutPage() {
  const [items,        setItems]        = useState<AdminMenuItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [editItem,     setEditItem]     = useState<AdminMenuItem | null>(null);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [form,         setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [toggling,     setToggling]     = useState<string | null>(null);
  const [dragIdx,      setDragIdx]      = useState<number | null>(null);
  const [dragOverIdx,  setDragOverIdx]  = useState<number | null>(null);
  const [compressPrompt, setCompressPrompt] = useState<{
    file: File;
    info: ImageInfo;
  } | null>(null);
  const [compressToast, setCompressToast] = useState<{
    before: ImageInfo;
    after: ImageInfo;
  } | null>(null);
  const imgFileRef   = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("menu_items")
        .select("id, category_id, name, description, price, image_url, additional_images, video_url, media_order, tag, calories, serving_time_min, is_available, is_takeout, display_order")
        .eq("is_takeout", true)
        .order("display_order");
      setItems((data ?? []) as AdminMenuItem[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("admin-takeout")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setPanelOpen(true);
  };

  const openEdit = (item: AdminMenuItem) => {
    setEditItem(item);
    setForm({
      name:          item.name,
      description:   item.description ?? "",
      price:         String(item.price),
      media:         buildMediaFromRow(item),
      is_available:  item.is_available,
      display_order: String(item.display_order),
    });
    setPanelOpen(true);
  };

  const closePanel = () => { setPanelOpen(false); setEditItem(null); };

  /* ── メディア操作 ── */
  const imageCount = form.media.filter((m) => m.type === "image").length;
  const videoCount = form.media.filter((m) => m.type === "video").length;

  const uploadAndAppendImage = async (file: File, info: { before?: ImageInfo; after?: ImageInfo }) => {
    setImgUploading(true);
    try {
      const ext  = file.name.split(".").pop() ?? "jpg";
      const path = `menu/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url  = await uploadMenuImage(file, path);
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

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (imageCount >= MAX_IMAGES) {
      alert(`画像は ${MAX_IMAGES} 枚までです。`);
      return;
    }
    try {
      const { width, height, size, needsCompression } = await inspectImage(file);
      if (!needsCompression) {
        await uploadAndAppendImage(file, {});
        return;
      }
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
      const r = await compressImage(file);
      await uploadAndAppendImage(r.file, { before: r.before, after: r.after });
    } catch (err) {
      alert("画像の圧縮に失敗しました: " + String(err));
      setImgUploading(false);
    }
  };

  const declineCompression = async () => {
    if (!compressPrompt) return;
    const { file } = compressPrompt;
    setCompressPrompt(null);
    await uploadAndAppendImage(file, {});
  };

  const handleAddVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoCount >= MAX_VIDEOS) {
      alert("動画は 1 本までです。");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      alert("動画ファイルが 50MB を超えています。");
      e.target.value = "";
      return;
    }
    setVideoUploading(true);
    try {
      const path = `menu/${Date.now()}-${file.name}`;
      const url  = await uploadMenuVideo(file, path);
      setForm((f) => ({ ...f, media: [...f.media, { type: "video", url }] }));
    } catch (err) {
      alert("動画のアップロードに失敗しました: " + String(err));
    } finally {
      setVideoUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveMedia = async (idx: number) => {
    const target = form.media[idx];
    setForm((f) => ({ ...f, media: f.media.filter((_, i) => i !== idx) }));
    if (target?.type === "video") {
      try {
        await deleteMenuVideo(extractVideoStoragePath(target.url));
      } catch (err) {
        console.warn("[admin/takeout] video storage delete failed:", err);
      }
    }
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

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };
  const onDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) setDragOverIdx(idx);
  };
  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIdx;
    setDragIdx(null);
    setDragOverIdx(null);
    if (from === null || from === idx) return;
    moveMedia(from, idx);
  };

  /* ── 保存 ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseInt(form.price);
    if (isNaN(price) || price <= 0) { alert("価格を正しく入力してください"); return; }

    setSaving(true);
    try {
      const images = form.media.filter((m) => m.type === "image").map((m) => m.url);
      const video  = form.media.find((m) => m.type === "video")?.url ?? null;
      const payload = {
        name:              form.name,
        description:       form.description || null,
        price,
        image_url:         images[0] ?? null,
        additional_images: images.slice(1),
        video_url:         video,
        media_order:       form.media,
        is_takeout:        true,       // 強制
        category_id:       null,       // テイクアウトはカテゴリなし
        is_available:      form.is_available,
        display_order:     parseInt(form.display_order) || 99,
      };

      if (editItem) {
        const { error } = await supabase
          .from("menu_items")
          .update(payload)
          .eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").insert({
          ...payload,
          store_id: STORE_ID,
        });
        if (error) throw error;
      }
      closePanel();
      await loadAll();
    } catch (err) {
      alert("保存に失敗しました: " + String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("menu_items").delete().eq("id", deleteId);
      if (error) throw error;
      setDeleteId(null);
      await loadAll();
    } catch (err) {
      alert("削除に失敗しました: " + String(err));
    } finally {
      setDeleting(false);
    }
  };

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

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">テイクアウトメニュー管理</h1>
          <p className="text-xs text-gray-400 mt-0.5">{items.length}件</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          追加
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          まだテイクアウトメニューがありません。
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm transition-opacity ${
                !item.is_available ? "opacity-50" : ""
              }`}
            >
              <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">🛍</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">🛍 テイクアウト</p>
                <p className="text-sm font-semibold text-warm-700">¥{item.price.toLocaleString()}</p>
              </div>
              <button
                onClick={() => handleToggleAvailable(item)}
                disabled={toggling === item.id}
                className={`shrink-0 relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  item.is_available ? "bg-warm-500" : "bg-gray-300"
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                    item.is_available ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => openEdit(item)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-warm-700 hover:bg-warm-50 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeleteId(item.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── スライドパネル ── */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={closePanel} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editItem ? "テイクアウトメニュー編集" : "テイクアウトメニュー追加"}
              </h2>
              <button
                onClick={closePanel}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            <form
              id="takeout-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
            >
              {/* メディア（DnD） */}
              <div>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">メディア</label>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      画像 {imageCount}/{MAX_IMAGES} 枚・動画 {videoCount}/{MAX_VIDEOS} 本
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-400">ドラッグで並び替え</p>
                </div>

                {form.media.length === 0 ? (
                  <div className="w-full rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 py-10 text-gray-400 text-xs">
                    画像か動画を追加してください
                  </div>
                ) : (
                  <div className="space-y-2">
                    {form.media.map((m, idx) => {
                      const isCover = idx === 0;
                      const isDragTarget = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx;
                      return (
                        <div
                          key={`${m.type}-${m.url}-${idx}`}
                          draggable
                          onDragStart={onDragStart(idx)}
                          onDragOver={onDragOver(idx)}
                          onDragLeave={() => setDragOverIdx(null)}
                          onDrop={onDrop(idx)}
                          onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                          className={`relative flex items-center gap-3 p-2 rounded-2xl border transition-colors ${
                            isDragTarget ? "border-warm-500 bg-warm-50" : "border-gray-200 bg-white"
                          } ${dragIdx === idx ? "opacity-50" : ""}`}
                        >
                          <div className="shrink-0 w-5 flex items-center justify-center text-gray-300 cursor-grab active:cursor-grabbing">
                            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                              <circle cx="2" cy="3" r="1.2" /><circle cx="8" cy="3" r="1.2" />
                              <circle cx="2" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" />
                              <circle cx="2" cy="13" r="1.2" /><circle cx="8" cy="13" r="1.2" />
                            </svg>
                          </div>
                          <div
                            className="shrink-0 rounded-lg overflow-hidden bg-black"
                            style={{
                              width: m.type === "video" ? 96 : 72,
                              aspectRatio: m.type === "video" ? "16/9" : "4/3",
                            }}
                          >
                            {m.type === "video" ? (
                              // eslint-disable-next-line jsx-a11y/media-has-caption
                              <video src={m.url} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] font-medium text-gray-700">
                                {m.type === "video" ? "🎬 動画" : "🖼 画像"}
                              </span>
                              {isCover && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warm-700 text-white font-medium">
                                  カバー
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 truncate mt-0.5">{m.url}</p>
                          </div>
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button type="button" onClick={() => moveMedia(idx, idx - 1)} disabled={idx === 0} className="w-6 h-5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center">
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                            <button type="button" onClick={() => moveMedia(idx, idx + 1)} disabled={idx === form.media.length - 1} className="w-6 h-5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center">
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </button>
                          </div>
                          <button type="button" onClick={() => handleRemoveMedia(idx)} className="shrink-0 w-7 h-7 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center text-base leading-none">×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => !imgUploading && imgFileRef.current?.click()}
                    disabled={imgUploading || imageCount >= MAX_IMAGES}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-xs font-medium text-gray-600 hover:border-warm-400 hover:text-warm-700 hover:bg-warm-50 disabled:opacity-40 transition-colors"
                  >
                    {imgUploading
                      ? <span className="w-3.5 h-3.5 border-2 border-warm-300 border-t-warm-700 rounded-full animate-spin" />
                      : <span className="text-sm leading-none">＋</span>}
                    画像を追加
                  </button>
                  <button
                    type="button"
                    onClick={() => !videoUploading && videoFileRef.current?.click()}
                    disabled={videoUploading || videoCount >= MAX_VIDEOS}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-300 text-xs font-medium text-gray-600 hover:border-warm-400 hover:text-warm-700 hover:bg-warm-50 disabled:opacity-40 transition-colors"
                  >
                    {videoUploading
                      ? <span className="w-3.5 h-3.5 border-2 border-warm-300 border-t-warm-700 rounded-full animate-spin" />
                      : <span className="text-sm leading-none">＋</span>}
                    動画を追加
                  </button>
                </div>
                <input ref={imgFileRef} type="file" accept="image/*" onChange={handleAddImage} className="hidden" />
                <input ref={videoFileRef} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={handleAddVideo} className="hidden" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  商品名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  required
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="ブランチボックス"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-warm-400 focus:ring-2 focus:ring-warm-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">説明文</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-warm-400 focus:ring-2 focus:ring-warm-100 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  価格（円）<span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={form.price}
                  required
                  min={1}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-warm-400 focus:ring-2 focus:ring-warm-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">表示順</label>
                <input
                  type="number"
                  value={form.display_order}
                  min={1}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-warm-400 focus:ring-2 focus:ring-warm-100"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">公開する</p>
                  <p className="text-xs text-gray-400">オフにするとテイクアウト注文画面に表示されません</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_available: !f.is_available }))}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                    form.is_available ? "bg-warm-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                      form.is_available ? "left-6" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </form>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={closePanel}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                form="takeout-form"
                disabled={saving || imgUploading || videoUploading}
                className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-60 transition-colors"
              >
                {saving ? "保存中…" : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 圧縮確認 */}
      {compressPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40" onClick={declineCompression} />
          <div className="relative bg-white rounded-3xl px-6 py-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-gray-900 mb-2">画像を圧縮しますか？</h3>
            <p className="text-sm text-gray-500 mb-1">画像が大きいため、アップロード前に圧縮することを推奨します。</p>
            <p className="text-[11px] text-gray-400 mb-5">
              現在: {compressPrompt.info.width}×{compressPrompt.info.height}px ・ {formatBytes(compressPrompt.info.size)}
              <br />
              目安: 1200×800px 以内 ・ 100 KB 以内
            </p>
            <div className="flex gap-3">
              <button onClick={declineCompression} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">そのまま</button>
              <button onClick={acceptCompression} className="flex-1 py-3 rounded-xl bg-warm-700 text-white text-sm font-medium hover:bg-warm-800 transition-colors">圧縮する</button>
            </div>
          </div>
        </div>
      )}

      {compressToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-gray-900/85 text-white text-[11px] px-3.5 py-2 rounded-full shadow-lg pointer-events-none">
          {compressToast.before.width}×{compressToast.before.height} → {compressToast.after.width}×{compressToast.after.height}
          <span className="mx-1.5 text-white/50">·</span>
          {formatBytes(compressToast.before.size)} → {formatBytes(compressToast.after.size)}
          {" "}
          <span className="text-emerald-300">
            （−{Math.max(0, Math.round((1 - compressToast.after.size / Math.max(compressToast.before.size, 1)) * 100))}%）
          </span>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-3xl px-6 py-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-gray-900 mb-2">メニューを削除しますか？</h3>
            <p className="text-sm text-gray-500 mb-6">この操作は取り消せません。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">キャンセル</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 transition-colors">
                {deleting ? "削除中…" : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
