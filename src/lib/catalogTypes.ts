export type ContentUom = 'G' | 'KG' | 'ML' | 'L' | 'PCS';
export type BadgeCategory = 'CLAIM' | 'HANDLING' | 'DIET';
export type TemperatureBand = 'AMBIENT' | 'CHILLED' | 'FROZEN';

export interface ProductContentDto {
  amount: number;
  uom: ContentUom;
  multipackCount?: number | null;
}

export interface ProductContentWriteDto {
  amount: number;
  uom: ContentUom;
  multipackCount?: number;
}

export interface CategoryResponse {
  id: number;
  name: string;
  description?: string | null;
  parentId?: number | null;
  slug: string;
  displayOrder: number;
  isActive: boolean;
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryTreeNode extends CategoryResponse {
  children?: CategoryTreeNode[];
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  parentId?: number | null;
  slug: string;
  displayOrder: number;
  isActive?: boolean;
  imageUrl?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  slug?: string;
  displayOrder?: number;
  isActive?: boolean;
  imageUrl?: string;
  parentId?: number | null;
  clearParent?: boolean;
}

export interface NutritionRowDto {
  nutrient: string;
  value: string;
  unit?: string;
}

export interface StorageDetailsDto {
  instructions?: string;
  shelfLife?: string;
  /** ISO date YYYY-MM-DD */
  useByDate?: string;
  temperatureBand?: TemperatureBand;
}

export interface NutritionDetailsDto {
  servingSize?: string;
  rows?: NutritionRowDto[];
}

export interface ProductDetailsDto {
  version: number;
  about?: string;
  storage?: StorageDetailsDto;
  nutrition?: NutritionDetailsDto;
}

export interface ResolvedBadgeDto {
  code: string;
  label: string;
  category?: string;
  iconKey?: string;
  isActive?: boolean;
}

export interface BadgeResponse {
  code: string;
  label: string;
  category: BadgeCategory;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBadgeRequest {
  code: string;
  label: string;
  category: BadgeCategory;
  iconKey: string;
  sortOrder?: number;
}

export interface UpdateBadgeRequest {
  code?: string;
  label?: string;
  category?: BadgeCategory;
  iconKey?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ProductResponse {
  id: number;
  sku: string;
  groupId?: string | null;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  categoryId: number;
  categoryName?: string | null;
  brand?: string | null;
  basePrice: number;
  content?: ProductContentDto | null;
  images?: string[] | null;
  tags?: string | null;
  isActive?: boolean | null;
  availableQuantity?: number | null;
  slug?: string | null;
  weightGrams?: number | null;
  barcode?: string | null;
  searchKeywords?: string | null;
  searchPriority?: number | null;
  isBestseller?: boolean | null;
  orderCount?: number | null;
  badges?: ResolvedBadgeDto[] | null;
  details?: ProductDetailsDto | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductSyncItem {
  sku?: string;
  productId?: number;
  groupId?: string;
  name: string;
  description?: string;
  shortDescription?: string;
  categoryId: number;
  brand?: string;
  basePrice: number;
  content: ProductContentWriteDto;
  images?: string[];
  tags?: string;
  isActive?: boolean;
  slug?: string;
  weightGrams?: number;
  barcode?: string;
  badgeCodes?: string[];
  details?: ProductDetailsDto;
  searchKeywords?: string;
  searchPriority?: number;
  isBestseller?: boolean;
  orderCount?: number;
}

export interface BulkSyncRequest {
  items: ProductSyncItem[];
}

export interface BulkSyncItemResult {
  sku?: string;
  status: string;
  operation?: string;
  productId?: number;
  errorMessage?: string;
  errorCode?: string;
}

export interface BulkSyncResponse {
  totalItems: number;
  successCount: number;
  failureCount: number;
  processingTimeMs: number;
  results: BulkSyncItemResult[];
}

export interface PagedProductResponse {
  content: ProductResponse[];
  meta: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
  };
}

export const CONTENT_UOM_OPTIONS: { value: ContentUom; label: string }[] = [
  { value: 'G', label: 'Grams (G)' },
  { value: 'KG', label: 'Kilograms (KG)' },
  { value: 'ML', label: 'Millilitres (ML)' },
  { value: 'L', label: 'Litres (L)' },
  { value: 'PCS', label: 'Pieces (PCS)' }
];

export const BADGE_CATEGORY_OPTIONS: { value: BadgeCategory; label: string }[] = [
  { value: 'CLAIM', label: 'Claim (e.g. Organic, Fresh)' },
  { value: 'HANDLING', label: 'Handling (e.g. Fragile, Keep cold)' },
  { value: 'DIET', label: 'Diet (e.g. Vegan, Gluten-free)' }
];

export const TEMPERATURE_BAND_OPTIONS: { value: TemperatureBand; label: string }[] = [
  { value: 'AMBIENT', label: 'Ambient' },
  { value: 'CHILLED', label: 'Chilled' },
  { value: 'FROZEN', label: 'Frozen' }
];

// ── Barcode generator ──────────────────────────────────────────────────────

export type BarcodeFormat = 'EAN13' | 'CODE128';

export interface GenerateBarcodeRequest {
  /** Product name, e.g. "Tomato" */
  name: string;
  /** Content specification */
  content: {
    amount: number;
    uom: ContentUom;
    multipackCount?: number | null;
  };
  categoryId?: number | null;
  format?: BarcodeFormat;
}

export interface BarcodeEntryResponse {
  id: number;
  barcode: string;
  format: BarcodeFormat;
  /** Human-readable label, e.g. "Tomato 500G" */
  productName: string;
  contentAmount: number;
  contentUom: ContentUom;
  multipackCount?: number | null;
  categoryId?: number | null;
  createdAt?: string;
}

export interface PagedBarcodeResponse {
  content: BarcodeEntryResponse[];
  totalElements: number;
  page: number;
  size: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Banners ────────────────────────────────────────────────────────────────

/** Must match BannerActionType enum in the backend. */
export type BannerActionType = 'CATEGORY_LIST' | 'PRODUCT_LIST';

export interface BannerResponse {
  id: number;
  slug: string;
  title: string;
  imageUrl: string;
  actionType: BannerActionType;
  actionItemIds: number[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBannerRequest {
  slug: string;
  title: string;
  imageUrl: string;
  actionType: BannerActionType;
  actionItemIds: number[];
  isActive?: boolean;
}

export interface UpdateBannerRequest {
  slug: string;
  title: string;
  imageUrl: string;
  actionType: BannerActionType;
  actionItemIds: number[];
  isActive: boolean;
}

// ── Banner Slots ───────────────────────────────────────────────────────────

export interface SlotBannerItem {
  bannerId: number;
  rank: number;
  banner: BannerResponse;
}

export interface BannerSlotResponse {
  id: number;
  name: string;
  slug: string;
  /** Days of week: 0=Sun 1=Mon … 6=Sat (Africa/Lusaka local) */
  daysOfWeek: number[];
  startTime: string; // "HH:mm:ss" CAT local
  endTime: string;   // "HH:mm:ss" CAT local
  priority: number;
  isActive: boolean;
  banners: SlotBannerItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBannerSlotRequest {
  name: string;
  slug: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateBannerSlotRequest {
  name: string;
  slug: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  priority: number;
  isActive: boolean;
}

export interface AssignBannerToSlotRequest {
  bannerId: number;
  rank: number;
}

export interface ReorderBannerSlotRequest {
  items: { bannerId: number; rank: number }[];
}

export const BANNER_ACTION_TYPE_OPTIONS: { value: BannerActionType; label: string }[] = [
  { value: 'CATEGORY_LIST', label: 'Category List — open filtered product listing by categories' },
  { value: 'PRODUCT_LIST', label: 'Product List — open specific products by ID' }
];

export const DAY_LABELS: { value: number; short: string; long: string }[] = [
  { value: 0, short: 'Sun', long: 'Sunday' },
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' }
];

export function formatDaysOfWeek(days: number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'No days';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join(',') === '1,2,3,4,5') return 'Mon – Fri';
  if (sorted.join(',') === '0,6') return 'Weekends';
  return sorted.map((d) => DAY_LABELS[d]?.short ?? d).join(', ');
}

export function slugifyBannerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
