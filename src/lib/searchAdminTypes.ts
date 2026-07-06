export interface SynonymGroup {
  id?: string;
  synonyms: string[];
}

export interface SearchSetting {
  key: string;
  value: string;
  description?: string | null;
}

export interface IndexStats {
  numberOfDocuments?: number | null;
  isIndexing?: boolean | null;
  fieldDistribution?: Record<string, number> | null;
  [key: string]: unknown;
}
