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

export function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
