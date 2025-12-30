export type PartyItem = {
  classList: string[];
  title?: string;
};

export type Listing = {
  id: string;
  dataCentre?: string;
  dataPfCategory?: string;
  duty?: {
    classList: string[];
    title: string;
  };
  creator?: string;
  creatorLodestoneSearchUrl?: string;
  creatorLodestoneUrl?: string;
  creatorAchievementUrl?: string;
  creatorUltimateClears?: string[];
  creatorUltimateClearsStatus?: "ok" | "private_or_unavailable" | "error";
  requirements: string[];
  description: string;
  party: PartyItem[];
};
