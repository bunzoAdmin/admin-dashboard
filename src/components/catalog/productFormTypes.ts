import type { ContentUom, NutritionRowDto, TemperatureBand } from '@/lib/catalogTypes';

export interface ProductFormState {
  name: string;
  brand: string;
  categoryId: string;
  basePrice: string;
  contentAmount: string;
  contentUom: ContentUom;
  multipackCount: string;
  description: string;
  shortDescription: string;
  slug: string;
  images: string;
  tags: string;
  weightGrams: string;
  groupId: string;
  isActive: boolean;
  searchKeywords: string;
  searchPriority: string;
  isBestseller: boolean;
  badgeCodes: string[];
  detailsAbout: string;
  storageInstructions: string;
  storageShelfLife: string;
  storageUseByDate: string;
  storageTemperatureBand: TemperatureBand | '';
  nutritionServingSize: string;
  nutritionRows: NutritionRowDto[];
}
