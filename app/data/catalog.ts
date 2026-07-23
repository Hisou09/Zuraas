export type CatalogItem = {
  id: string;
  title: string;
  originalTitle: string;
  type: "anime" | "manhwa" | "manga";
  status: string;
  year: number;
  episodes?: number;
  chapters?: number;
  rating: number;
  genres: string[];
  image: string;
  bannerImage?: string;
  description?: string;
  anilistId?: number;
  createdAt?: string;
  latestAt?: string;
};

// The catalogue is populated exclusively from PostgreSQL. Keeping this empty
// prevents removed demo titles from returning on a fresh local setup or deploy.
export const catalog: CatalogItem[] = [];
