"use client";

/**
 * コンポーネントギャラリー（開発用・本番導線からはリンクなし）
 * Figma スクリーンショットとの目視突き合わせ用。Step3-Bで作成し、以降のStepで
 * 追加されたコンポーネント（Header旧版・OrderHeader・CartItemRow等）を随時追記している。
 * 認証等のガードは無いので取り扱い注意。
 */
import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import Header from "@/components/Header";
import OrderHeader from "@/components/ui/OrderHeader";
import HeaderIconButton from "@/components/ui/HeaderIconButton";
import CategoryTag, { type TagColor } from "@/components/ui/CategoryTag";
import { Tab, TabNav } from "@/components/ui/Tab";
import { FilterBar } from "@/components/ui/FilterBar";
import QuantityStepper from "@/components/ui/QuantityStepper";
import { MenuCard, MenuCardWide } from "@/components/ui/MenuCard";
import { MenuCarousel, MenuCarouselWide, RecommendCarousel } from "@/components/ui/MenuCarousel";
import RecommendCard from "@/components/ui/RecommendCard";
import CartItemRow from "@/components/ui/CartItemRow";
import MenuCategoryCard from "@/components/ui/MenuCategoryCard";
import SeeMoreButton from "@/components/ui/SeeMoreButton";
import { AddToCartButton, CartButton, BackButton, LinkButton } from "@/components/ui/Buttons";
import BottomViewCartBar from "@/components/ui/BottomViewCartBar";
import { Video16x9, Video9x16 } from "@/components/ui/VideoBlock";
import ModalCloseButton from "@/components/ui/ModalCloseButton";
import OptionCard from "@/components/ui/OptionCard";
import InfoRow from "@/components/ui/InfoRow";
import NavItem from "@/components/admin/nav/NavItem";
import NavSidebar from "@/components/admin/nav/NavSidebar";
import StatusBadge, { type StatusBadgeState } from "@/components/admin/StatusBadge";
import PrinterHealthCard from "@/components/admin/print/PrinterHealthCard";
import PrintJobRowCard from "@/components/admin/print/PrintJobRowCard";
import { describePrinterHealth, type PrinterHealthView, type PrintJobRow } from "@/lib/printStatus";
import StaffCallChip from "@/components/admin/StaffCallChip";
import OrderCard, { type OrderCardItem } from "@/components/admin/kitchen/OrderCard";
import TableChip from "@/components/admin/register/TableChip";
import OrderGroupHeader from "@/components/admin/register/OrderGroupHeader";
import BillCard, { type BillCardItem } from "@/components/admin/register/BillCard";
import { asset } from "@/lib/siteConfig";
import CheckoutConfirmAlert from "@/components/admin/register/CheckoutConfirmAlert";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import AdminMenuRow from "@/components/admin/menu/AdminMenuRow";
import TagSelectField from "@/components/admin/menu/TagSelectField";
import MediaUploaderField from "@/components/admin/menu/MediaUploaderField";
import SettingsSection from "@/components/admin/settings/SettingsSection";
import VideoSlotField from "@/components/admin/settings/VideoSlotField";
import BackgroundSlotField from "@/components/admin/settings/BackgroundSlotField";
import DisplayTabs, { type DisplayTabId } from "@/components/admin/display/DisplayTabs";
import type { StoreMedia } from "@/lib/storeMedia";
import MenuPreviewCard from "@/components/admin/menu/MenuPreviewCard";
import CategoryRow from "@/components/admin/category/CategoryRow";
import ColorSwatchPicker from "@/components/admin/category/ColorSwatchPicker";
import PickupCard, { type PickupItem } from "@/components/admin/takeout/PickupCard";
import { useCartStore } from "@/lib/store";
import { menuItems, type MenuItem } from "@/lib/menu";
import { SUBCATEGORY_LABEL } from "@/lib/categoryLabels";
import type { ApiCategory, ApiMediaItem } from "@/lib/api";

const ICONS: IconName[] = [
  "crown", "sliders", "chevron-down", "cart", "arrow-left",
  "menu", "close", "return", "bell", "bag", "map-pin",
  "clock", "phone", "water-drop", "card",
  "dashboard", "flame", "receipt", "list", "bowl", "grip", "edit", "check", "plus",
];

const SAMPLE_BILL_ITEMS: BillCardItem[] = [
  { id: "1", name: "パンケーキ プレーン", quantity: 2, unitPrice: 980, isTakeout: false },
  { id: "2", name: "マスカルポーネ&エスプレッソ", quantity: 1, unitPrice: 1200, isTakeout: false },
  { id: "3", name: "自家製レモネード", quantity: 1, unitPrice: 580, isTakeout: true },
];

const STATUS_BADGE_STATES: StatusBadgeState[] = ["pending", "cooking", "done", "served", "pickedUp"];

const SAMPLE_PICKUP_ITEMS: PickupItem[] = [
  { id: "1", name: "パンケーキ プレーン", quantity: 1 },
  { id: "2", name: "アイスコーヒー", quantity: 2 },
];

const SAMPLE_ORDER_ITEMS: OrderCardItem[] = [
  { orderItemId: "1", name: "パンケーキ プレーン", quantity: 2, cookingStatus: "cooking", isTakeoutItem: false },
  { orderItemId: "2", name: "アイスコーヒー", quantity: 1, cookingStatus: "done", isTakeoutItem: false },
  { orderItemId: "3", name: "フレンチフライ", quantity: 1, cookingStatus: "pending", isTakeoutItem: true },
];

const TAG_COLORS: TagColor[] = [
  "yellow", "orange", "pink", "red", "green",
  "teal", "blue", "purple", "brown", "gray",
];

const sampleItem: MenuItem = {
  ...menuItems[0],
  name: "スフレパンケーキ プレーン",
  price: 980,
  tag: "人気",
};

const sampleCat: ApiCategory = {
  id: "dev",
  slug: "pancake",
  name: "パンケーキ",
  caption: "PANCAKE",
  description: "これがYORKYSの原点！看板メニュー",
  en_size: "large",
  jp_size: "small",
  image_url: asset("/images/pancake/p1.webp"),
  display_order: 1,
  tag_color: "yellow",
};

const sampleVideo = [
  { type: "image" as const, url: "/images/pancake/p1.webp" },
  { type: "video" as const, url: "/images/hero/background.mp4" },
];

/* ── 印刷状況（/admin/print）のサンプル ──
   時刻は固定値から逆算する。Date.now() を直に使うと再描画のたびに
   「◯分前」が動いてFigmaとの突き合わせがしづらくなるため */
const SAMPLE_PRINT_NOW = new Date("2026-08-20T12:00:00+09:00").getTime();
const minutesAgo = (m: number) => new Date(SAMPLE_PRINT_NOW - m * 60_000).toISOString();

const SAMPLE_PRINTER_HEALTH: Record<PrinterHealthView["health"], PrinterHealthView> = {
  ok:      describePrinterHealth({ lastSeenAt: minutesAgo(0),  lastStatusAt: null, statusNote: null },       SAMPLE_PRINT_NOW),
  warning: describePrinterHealth({ lastSeenAt: minutesAgo(0),  lastStatusAt: null, statusNote: "用紙切れ" }, SAMPLE_PRINT_NOW),
  offline: describePrinterHealth({ lastSeenAt: minutesAgo(12), lastStatusAt: null, statusNote: null },       SAMPLE_PRINT_NOW),
  unknown: describePrinterHealth(null, SAMPLE_PRINT_NOW),
};

const SAMPLE_PRINT_JOBS: PrintJobRow[] = [
  { id: "s1", status: "pending",  seq: 1, attempts: 0, lastError: null,
    createdAt: minutesAgo(1),  tableLabel: "テーブル A-1", pickupNo: 3, orderType: "dine_in" },
  { id: "s2", status: "printing", seq: 2, attempts: 1, lastError: null,
    createdAt: minutesAgo(2),  tableLabel: "カウンター L-1", pickupNo: 4, orderType: "dine_in" },
  { id: "s3", status: "failed",   seq: 1, attempts: 5, lastError: "用紙切れ",
    createdAt: minutesAgo(9),  tableLabel: null, pickupNo: 7, orderType: "takeout" },
  { id: "s4", status: "done",     seq: 3, attempts: 1, lastError: null,
    createdAt: minutesAgo(35), tableLabel: "テーブル A-5", pickupNo: 2, orderType: "dine_in" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-[40px]">
      <h2 className="type-en-label text-text-tertiary mb-[12px]">{title}</h2>
      {children}
    </section>
  );
}

function ToggleSwitchDemo() {
  const [on, setOn] = useState(true);
  return <ToggleSwitch on={on} onClick={() => setOn((v) => !v)} ariaLabel="デモ用トグル" />;
}

function TagSelectFieldDemo() {
  const [tag, setTag] = useState("人気");
  return <TagSelectField value={tag} onChange={setTag} />;
}

const DEMO_MEDIA: StoreMedia = {
  enabled: true,
  url: "/images/hero/background.mp4",
  posterUrl: "/images/pancake/p1.webp",
  updatedAt: "2026-08-03T14:32:00+09:00",
  backgroundType: "video",
  backgroundColor: null,
  imageUrl: null,
};

function VideoSlotFieldDemo() {
  const [media, setMedia] = useState<StoreMedia>(DEMO_MEDIA);
  return (
    <SettingsSection
      title="① 注文ホームのヒーロー動画"
      description="メニュー一覧の先頭に、横長の帯として出ます。"
    >
      <VideoSlotField
        slot="order_hero"
        toggleLabel="注文ホームに動画を表示する"
        notes={[
          "16:9（横長）に自動でトリミングされます。上下が切れないよう、16:9で書き出した動画をアップロードしてください。",
          "推奨: 1920×1080（16:9）・15秒以内・mp4",
          "音声は再生されません。",
          "アップロードした動画は自動的に圧縮されます（最大1280×720・mp4）。元のファイルは保存されません。",
        ]}
        fit="cover-16x9"
        media={media}
        onToggle={(enabled) => setMedia((m) => ({ ...m, enabled }))}
        onUploaded={({ url, posterUrl }) => setMedia((m) => ({ ...m, url, posterUrl }))}
        onRequestDelete={() => setMedia((m) => ({ ...m, url: null, posterUrl: null }))}
      />
    </SettingsSection>
  );
}

/** 表示設定 > 動画設定 の2枚目。色 / 画像 / 動画 の切り替えと、文字色の自動判定を確認する */
function BackgroundSlotFieldDemo() {
  const [media, setMedia] = useState<StoreMedia>({
    ...DEMO_MEDIA,
    backgroundType: "color",
    backgroundColor: "#2F3D34", // design-qa-allow: パレット（lib/backgroundColor.ts）の「ダークグリーン」。ギャラリーの初期値
  });
  return (
    <SettingsSection
      title="② 二次元コード着地画面の背景"
      description="お客様が二次元コードを読み取って最初に開く画面の、背景いっぱいに出ます。"
    >
      <BackgroundSlotField
        slot="landing_background"
        toggleLabel="着地画面に背景を表示する"
        notes={{
          color: [
            "画面全体がこの色一色で塗られます。写真や動画より軽く、通信が弱い店舗でも確実に表示されます。",
            "文字とロゴの色は、選んだ色の明るさに合わせて自動で切り替わります（明るい色 → 黒い文字 / 暗い色 → 白い文字）。",
            "カスタムでは HEX（#RRGGBB）で自由に指定できます。",
          ],
          image: ["文字とロゴは白で表示されます。暗めの写真をご用意ください。"],
          video: ["文字とロゴは白で表示されます。暗めの映像をご用意ください。"],
        }}
        fit="keep-aspect"
        media={media}
        onToggle={(enabled) => setMedia((m) => ({ ...m, enabled }))}
        onChangeType={(backgroundType) => setMedia((m) => ({ ...m, backgroundType }))}
        onChangeColor={(backgroundColor) => setMedia((m) => ({ ...m, backgroundColor }))}
        onUploadedVideo={({ url, posterUrl }) => setMedia((m) => ({ ...m, url, posterUrl }))}
        onUploadedImage={({ url }) => setMedia((m) => ({ ...m, imageUrl: url }))}
        onRequestDeleteVideo={() => setMedia((m) => ({ ...m, url: null, posterUrl: null }))}
        onRequestDeleteImage={() => setMedia((m) => ({ ...m, imageUrl: null }))}
      />
    </SettingsSection>
  );
}

/** 表示設定のタブ。SPは等分、PCは左寄せ */
function DisplayTabsDemo() {
  const [tab, setTab] = useState<DisplayTabId>("video");
  return <DisplayTabs active={tab} onSelect={setTab} />;
}

function MediaUploaderFieldDemo() {
  const [media, setMedia] = useState<ApiMediaItem[]>(sampleVideo);
  return (
    <div className="max-w-[400px]">
      <MediaUploaderField
        media={media}
        imageCount={media.filter((m) => m.type === "image").length}
        videoCount={media.filter((m) => m.type === "video").length}
        maxImages={5}
        maxVideos={1}
        uploading={false}
        onAddFile={() => {}}
        onRemove={(idx) => setMedia((m) => m.filter((_, i) => i !== idx))}
        onMove={(from, to) => {
          setMedia((m) => {
            const next = [...m];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
          });
        }}
      />
    </div>
  );
}

function AdminMenuRowDemo() {
  const [available, setAvailable] = useState(true);
  return (
    <AdminMenuRow
      name="スフレパンケーキ プレーン"
      categoryLabel="パンケーキ"
      price={980}
      thumbnailUrl="/images/pancake/p1.webp"
      available={available}
      toggling={false}
      onToggleAvailable={() => setAvailable((v) => !v)}
      onEdit={() => {}}
    />
  );
}

function ColorSwatchPickerDemo() {
  const [color, setColor] = useState<TagColor>("yellow");
  return <ColorSwatchPicker value={color} onChange={setColor} />;
}

function CheckoutConfirmAlertDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="type-jp-caption px-[12px] py-[6px] rounded-full bg-bg-tertiary text-text-primary"
      >
        開く
      </button>
      <CheckoutConfirmAlert
        open={open}
        table="TABLE 4"
        amount={3720}
        confirming={false}
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

export default function UiGalleryPage() {
  const [qty, setQty] = useState(0);
  const [qty2, setQty2] = useState(2);
  const [tabId, setTabId] = useState("recommend");
  const [chips, setChips] = useState<string[]>(["allergy"]);
  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const cartCount = useCartStore((s) => s.totalItems());

  return (
    <div className="mx-auto max-w-md min-h-screen bg-bg-primary px-[16px] py-[32px] pb-[120px]">
      <h1 className="type-jp-heading-l text-text-primary mb-[24px]">UI Gallery</h1>

      <Section title="Header（旧デザイン、components/Header.tsx）">
        <div className="flex flex-col gap-[12px] -mx-[16px]">
          <div className="relative overflow-hidden h-[64px] border-b border-border-divider">
            <Header mode="home" />
          </div>
          <div className="relative overflow-hidden h-[64px] border-b border-border-divider">
            <Header mode="sub" title="パンケーキ" />
          </div>
        </div>
      </Section>

      <Section title="OrderHeader（新デザイン、components/ui/OrderHeader.tsx）">
        <div className="flex flex-col gap-[12px] -mx-[16px]">
          <div className="relative overflow-hidden h-[76px] border-b border-border-divider">
            <OrderHeader />
          </div>
          <div className="relative overflow-hidden h-[76px] border-b border-border-divider">
            <OrderHeader variant="close" />
          </div>
        </div>
      </Section>

      <Section title="HeaderIconButton">
        <div className="flex gap-[16px]">
          <HeaderIconButton icon="menu" onClick={() => {}} />
          <HeaderIconButton icon="close" onClick={() => {}} />
        </div>
      </Section>

      <Section title={`Icon x${ICONS.length}`}>
        <div className="flex flex-wrap gap-[12px]">
          {ICONS.map((n) => (
            <div key={n} className="flex flex-col items-center gap-[4px] w-[52px]">
              <Icon name={n} className="w-4 h-4 text-text-primary" />
              <span className="text-[9px] text-text-tertiary">{n}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tab / TabNav">
        <div className="flex gap-[16px] mb-[8px]">
          <Tab label="Active" active />
          <Tab label="Inactive" active={false} />
        </div>
        <div className="-mx-[16px]">
          <TabNav
            tabs={[
              { id: "recommend", label: "おすすめ" },
              { id: "pancake", label: "パンケーキ" },
              { id: "crepe", label: "クレープ" },
              { id: "side", label: "サイド" },
              { id: "drink", label: "ドリンク" },
            ]}
            activeId={tabId}
            onSelect={setTabId}
          />
        </div>
      </Section>

      <Section title="FilterBar">
        <div className="-mx-[16px]">
          <FilterBar
            chips={[
              { id: "allergy", label: "アレルギー" },
              { id: "dislike", label: "ニガテな食材" },
              { id: "pickup", label: "受け取り方法" },
            ]}
            selectedIds={chips}
            onToggle={(id) =>
              setChips((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
          />
        </div>
      </Section>

      <Section title="CategoryTag x10">
        <div className="flex flex-wrap gap-[8px]">
          {TAG_COLORS.map((c) => (
            <CategoryTag key={c} label="パンケーキ" color={c} />
          ))}
        </div>
      </Section>

      <Section title="QuantityStepper (Empty / Active)">
        <div className="flex gap-[40px]">
          <QuantityStepper count={qty} onIncrement={() => setQty(qty + 1)} onDecrement={() => setQty(Math.max(0, qty - 1))} />
          <QuantityStepper count={qty2} onIncrement={() => setQty2(qty2 + 1)} onDecrement={() => setQty2(Math.max(0, qty2 - 1))} />
        </div>
      </Section>

      <Section title="MenuCard (171)">
        <MenuCard
          item={sampleItem}
          quantity={qty}
          onIncrement={() => setQty(qty + 1)}
          onDecrement={() => setQty(Math.max(0, qty - 1))}
          onClick={() => {}}
        />
      </Section>

      <Section title="MenuCarousel (MenuCard x3)">
        <div className="-mx-[16px]">
          <MenuCarousel>
            {menuItems.slice(0, 3).map((m) => (
              <MenuCard key={m.id} item={{ ...m, tag: m.tag }} quantity={0} onIncrement={() => {}} onDecrement={() => {}} />
            ))}
          </MenuCarousel>
        </div>
      </Section>

      <Section title="MenuCardWide (300) in Carousel">
        <div className="-mx-[16px]">
          <MenuCarouselWide>
            {menuItems.slice(0, 2).map((m) => (
              <MenuCardWide key={m.id} item={{ ...m, tag: "人気" }} quantity={0} onIncrement={() => {}} onDecrement={() => {}} />
            ))}
          </MenuCarouselWide>
        </div>
      </Section>

      <Section title="RecommendCard in Carousel">
        <div className="-mx-[16px]">
          <RecommendCarousel>
            {menuItems.slice(0, 2).map((m) => (
              <RecommendCard key={m.id} item={m} />
            ))}
          </RecommendCarousel>
        </div>
      </Section>

      <Section title="MenuCategoryCard (Large x2 / Small x3)">
        <div className="grid grid-cols-2 gap-[8px] mb-[8px]">
          <MenuCategoryCard category={sampleCat} size="large" href="/order/pancake" />
          <MenuCategoryCard category={{ ...sampleCat, slug: "eggs_benedict", name: "エッグベネディクト" }} size="large" href="/order/eggs_benedict" />
        </div>
        <div className="flex gap-[8px]">
          <MenuCategoryCard category={{ ...sampleCat, slug: "fritter", name: "フリッター" }} size="small" href="/order/fritter" />
          <MenuCategoryCard category={{ ...sampleCat, slug: "burger", name: "バーガー" }} size="small" href="/order/burger" />
          <MenuCategoryCard category={{ ...sampleCat, slug: "lunch", name: "ランチ" }} size="small" href="/order/lunch" />
        </div>
      </Section>

      <Section title="SeeMoreButton">
        <SeeMoreButton label="パンケーキをもっと見る" href="/order/pancake" />
      </Section>

      <Section title="Buttons">
        <div className="flex flex-col gap-[16px] items-start">
          <AddToCartButton label="カートに入れる" onClick={() => {}} className="max-w-[260px]" />
          <div className="flex gap-[16px] items-center">
            <CartButton count={12} onClick={() => {}} />
            <BackButton onClick={() => {}} />
            <ModalCloseButton onClick={() => {}} />
          </div>
          <div className="grid grid-cols-2 gap-[16px] w-full">
            <LinkButton icon="return" label="トップへ戻る" href="/order" />
            <LinkButton icon="bell" label="スタッフを呼ぶ" onClick={() => {}} />
            <LinkButton icon="bag" label="テイクアウト" href="/order/takeout" />
            <LinkButton icon="map-pin" label="店舗情報" onClick={() => {}} />
          </div>
        </div>
      </Section>

      <Section title="OptionCard">
        <div className="flex flex-col gap-[12px]">
          <OptionCard icon="water-drop" label="お水をください" onClick={() => {}} />
          <OptionCard icon="card" label="お会計をお願いします" onClick={() => {}} />
          <OptionCard icon="bell" label="スタッフを呼ぶ" onClick={() => {}} disabled trailing={<span className="type-jp-label text-text-tertiary">送信済み</span>} />
        </div>
      </Section>

      <Section title="InfoRow">
        <div className="flex flex-col gap-[20px]">
          <InfoRow icon="map-pin" label="住所" value="兵庫県西宮市霞町5-44 ビンテージ夙川2F" />
          <InfoRow icon="clock" label="営業時間" value="11:00 - 21:00（L.O. 20:30）" />
          <InfoRow icon="phone" label="電話番号" value="0798-42-8289" />
        </div>
      </Section>

      <Section title="Video 16:9 / 9:16">
        <div className="-mx-[16px] mb-[16px]">
          <Video16x9 media={sampleVideo} />
        </div>
        <div className="px-[8px]">
          <Video9x16 media={sampleVideo} />
        </div>
      </Section>

      <Section title="CartItemRow（app/cart用）">
        <div className="flex flex-col gap-[12px]">
          <CartItemRow
            image={sampleItem.image}
            categoryLabel={SUBCATEGORY_LABEL[sampleItem.subcategory] ?? sampleItem.subcategory}
            categoryColor="yellow"
            name={sampleItem.name}
            price={sampleItem.price}
            quantity={2}
            onIncrement={() => {}}
            onDecrement={() => {}}
            onRemove={() => {}}
          />
          <CartItemRow
            image=""
            categoryLabel="エッグベネディクト"
            categoryColor="pink"
            name="アボカドとベーコンのエッグベネディクト スペシャル（長い商品名の省略確認用）"
            price={1580}
            quantity={1}
            onIncrement={() => {}}
            onDecrement={() => {}}
            onRemove={() => {}}
          />
        </div>
      </Section>

      <Section title="BottomViewCartBar">
        <p className="type-jp-caption text-text-secondary mb-[8px]">
          カートが空の間は非表示（ページ下部固定で実際に表示されます。実カートと状態を共有するので注意）
        </p>
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={() => addItem(sampleItem, 1)}
            className="type-jp-caption px-[12px] py-[6px] rounded-full bg-bg-tertiary text-text-primary"
          >
            モック商品をカートに追加
          </button>
          <button
            type="button"
            onClick={() => clearCart()}
            className="type-jp-caption px-[12px] py-[6px] rounded-full bg-bg-tertiary text-text-primary"
          >
            カートを空にする
          </button>
          <span className="type-jp-caption text-text-secondary">現在: {cartCount}点</span>
        </div>
      </Section>

      <Section title="── スタッフ管理画面（Step3-I）──">
        <p className="type-jp-caption text-text-secondary">
          Nav Sidebar v2 / Nav Drawer / Order Card 等。/adminはログイン必須のためここで目視確認する。
        </p>
      </Section>

      <Section title="NavSidebar v2（丸ごと）">
        <p className="type-jp-caption text-text-secondary mb-[8px]">
          このページのpathnameでは/admin配下に一致しないためActive項目は出ません（構造確認用）
        </p>
        <div className="border border-border-divider" style={{ height: 500 }}>
          <NavSidebar role="manager" onLogout={() => {}} />
        </div>
      </Section>

      <Section title="NavItem（Active / Inactive）">
        <div className="flex flex-col gap-[8px] w-[220px] bg-surface-white p-[8px]">
          <NavItem icon="flame" label="厨房" active onClick={() => {}} />
          <NavItem icon="receipt" label="レジ" active={false} onClick={() => {}} />
        </div>
      </Section>

      <Section title="StatusBadge x5">
        <div className="flex flex-wrap gap-[8px]">
          {STATUS_BADGE_STATES.map((s) => (
            <StatusBadge key={s} state={s} />
          ))}
        </div>
      </Section>

      <Section title="StaffCallChip（Waiting / Acknowledged）">
        <div className="flex flex-col gap-[8px] items-start">
          <StaffCallChip table="TABLE 4" message="お水をください" elapsed="2分" state="waiting" onAction={() => {}} />
          <StaffCallChip table="TABLE 7" message="スタッフを呼ぶ" elapsed="4分" state="acknowledged" onAction={() => {}} />
        </div>
      </Section>

      <Section title="OrderCard（Normal / Warning / Urgent）">
        <div className="flex flex-col gap-[16px] max-w-[400px]">
          <OrderCard
            table="TABLE 4" elapsed="5分経過" isTakeout={false} urgency="normal"
            items={SAMPLE_ORDER_ITEMS} allDone={false} hasUnacknowledged
            onAcknowledge={() => {}} onItemClick={() => {}} onComplete={() => {}}
          />
          <OrderCard
            table="TABLE 7" elapsed="12分経過" isTakeout={false} urgency="warning"
            items={SAMPLE_ORDER_ITEMS} allDone={false} hasUnacknowledged={false}
            onAcknowledge={() => {}} onItemClick={() => {}} onComplete={() => {}}
          />
          <OrderCard
            table="TAKEOUT" elapsed="24分経過" isTakeout urgency="urgent"
            items={SAMPLE_ORDER_ITEMS.map((i) => ({ ...i, cookingStatus: "done" as const }))}
            allDone hasUnacknowledged={false}
            onAcknowledge={() => {}} onItemClick={() => {}} onComplete={() => {}}
          />
        </div>
      </Section>

      <Section title="── レジ画面（Step3-J）──">
        <p className="type-jp-caption text-text-secondary">Table Chip / Bill Card / Checkout Confirm Alert</p>
      </Section>

      <Section title="TableChip（Default / Selected / ServedDot）">
        <div className="flex gap-[8px] flex-wrap">
          <TableChip label="TABLE 2" selected={false} onClick={() => {}} />
          <TableChip label="TABLE 4" selected onClick={() => {}} />
          <TableChip label="TABLE 7" selected={false} showServedDot onClick={() => {}} />
          {/* design-qa-allow: 受渡番号のサンプル文字列。色ではない */}
          <TableChip label="🛍 #a1b2c3" selected={false} onClick={() => {}} />
        </div>
      </Section>

      <Section title="OrderGroupHeader（店内 / テイクアウト）">
        <div className="flex gap-[8px]">
          <OrderGroupHeader type="dine-in" />
          <OrderGroupHeader type="takeout" />
        </div>
      </Section>

      <Section title="BillCard">
        <div className="max-w-[400px]">
          <BillCard items={SAMPLE_BILL_ITEMS} subtotal={3382} tax={338} total={3720} />
        </div>
      </Section>

      <Section title="CheckoutConfirmAlert">
        <CheckoutConfirmAlertDemo />
      </Section>

      {/* ── Step3-K: Menu Management ── */}
      <Section title="ToggleSwitch（On / Off）">
        <ToggleSwitchDemo />
      </Section>

      <Section title="AdminMenuRow（PC=トグル / SP=編集ボタン。幅を狭めてSP表示を確認）">
        <div className="max-w-[500px]">
          <AdminMenuRowDemo />
        </div>
      </Section>

      <Section title="TagSelectField">
        <div className="max-w-[400px]">
          <TagSelectFieldDemo />
        </div>
      </Section>

      <Section title="MediaUploaderField">
        <MediaUploaderFieldDemo />
      </Section>

      <Section title="DisplayTabs（表示設定のタブ）">
        <div className="max-w-[560px] border border-border-divider">
          <DisplayTabsDemo />
        </div>
      </Section>

      <Section title="SettingsSection + VideoSlotField（表示設定 > 動画設定 ①）">
        <div className="max-w-[560px]">
          <VideoSlotFieldDemo />
        </div>
      </Section>

      <Section title="SettingsSection + BackgroundSlotField（表示設定 > 動画設定 ②）">
        <p className="type-jp-caption text-text-secondary mb-[8px]">
          セグメントで 色 / 画像 / 動画 を切り替える。「色」ではプレビューのロゴと文字色が
          背景の明るさで自動的に入れ替わる（暗い色 → 白、明るい色 → 黒）。
        </p>
        <div className="max-w-[560px]">
          <BackgroundSlotFieldDemo />
        </div>
      </Section>

      <Section title="MenuPreviewCard">
        <MenuPreviewCard
          name="スフレパンケーキ プレーン"
          price="980"
          tag="人気"
          categoryLabel={sampleCat.name}
          categoryColor={sampleCat.tag_color}
          imageUrl="/images/pancake/p1.webp"
        />
      </Section>

      {/* ── Step3-L: Categories Management ── */}
      <Section title="CategoryRow（PC=表示順バッジ / SP=編集ボタン。幅を狭めてSP表示を確認）">
        <div className="flex flex-col gap-[16px]">
          <CategoryRow
            name="パンケーキ"
            slug="pancake"
            thumbnailUrl="/images/pancake/p1.webp"
            tagColor="yellow"
            displayOrder={1}
            onEdit={() => {}}
          />
          <div className="max-w-[500px]">
            <CategoryRow
              name="エッグベネディクト（長いカテゴリ名の省略確認用）"
              slug="eggs_benedict"
              thumbnailUrl={null}
              tagColor="pink"
              displayOrder={2}
              onEdit={() => {}}
            />
          </div>
        </div>
      </Section>

      <Section title="ColorSwatchPicker">
        <div className="max-w-[400px]">
          <ColorSwatchPickerDemo />
        </div>
      </Section>

      {/* ── Step3-M: Takeout Pickup ── */}
      <Section title="PickupCard">
        <div className="max-w-[400px]">
          <PickupCard
            pickupNumber="#01"
            elapsed="8分経過"
            items={SAMPLE_PICKUP_ITEMS}
            completing={false}
            onComplete={() => {}}
          />
        </div>
      </Section>

      {/* ── 厨房プリンタ: 印刷状況（/admin/print） ── */}
      <Section title="PrinterHealthCard">
        <div className="max-w-[560px] flex flex-col gap-[var(--space-12)]">
          {(["ok", "warning", "offline", "unknown"] as const).map((h) => (
            <PrinterHealthCard key={h} view={SAMPLE_PRINTER_HEALTH[h]} />
          ))}
        </div>
      </Section>

      <Section title="PrintJobRowCard">
        <ul className="max-w-[560px] flex flex-col gap-[var(--space-8)]">
          {SAMPLE_PRINT_JOBS.map((job) => (
            <PrintJobRowCard
              key={job.id}
              job={job}
              now={SAMPLE_PRINT_NOW}
              requeueing={false}
              onRequeue={() => {}}
            />
          ))}
        </ul>
      </Section>

      <BottomViewCartBar />
    </div>
  );
}
