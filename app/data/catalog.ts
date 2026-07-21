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
  createdAt?: string;
  latestAt?: string;
};

export const catalog: CatalogItem[] = [
  { id:"smoking", title:"Smoking Behind the Supermarket with You", originalTitle:"Super no Ura de Yani Suu Futari", type:"anime", status:"On-Going", year:2026, episodes:12, rating:8.5, genres:["Comedy","Romance"], image:"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx186312-TLuDDasq9PQH.jpg" },
  { id:"tanya", title:"Saga of Tanya the Evil Season 2", originalTitle:"Youjo Senki II", type:"anime", status:"On-Going", year:2026, episodes:12, rating:8.7, genres:["Action","Fantasy"], image:"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx135866-8WIVXWso8qFD.jpg" },
  { id:"bleach", title:"BLEACH: Thousand-Year Blood War", originalTitle:"BLEACH: Sennen Kessen-hen", type:"anime", status:"TBA", year:2026, episodes:13, rating:9.1, genres:["Action","Supernatural"], image:"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx269-d2GmRkJbMopq.png" },
  { id:"chainsmoker", title:"Chainsmoker Cat", originalTitle:"Chainsmoker Cat", type:"anime", status:"On-Going", year:2026, episodes:12, rating:8.2, genres:["Comedy","Slice of Life"], image:"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx199408-ocRWG4pRWl8f.png" },
  { id:"black-torch-anime", title:"BLACK TORCH", originalTitle:"Black Torch", type:"anime", status:"On-Going", year:2026, episodes:12, rating:8.8, genres:["Action","Supernatural"], image:"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195600-moI0UFArtOme.jpg" },
  { id:"madoka", title:"Puella Magi Madoka Magica the Movie", originalTitle:"Walpurgisnacht: Rising", type:"anime", status:"TBA", year:2026, episodes:1, rating:8.9, genres:["Drama","Fantasy"], image:"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-hTeZ1GlhL0Rr.jpg" },
  { id:"polar", title:"You and I Are Polar Opposites Season 2", originalTitle:"Seihantai na Kimi to Boku 2", type:"anime", status:"On-Going", year:2026, episodes:13, rating:8.4, genres:["Romance","Comedy"], image:"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx210031-TppgcHZh46LY.jpg" },
  { id:"love-you", title:"I Want to Love You Till Your Dying Day", originalTitle:"Kimi ga Shinu made Koi wo Shitai", type:"anime", status:"On-Going", year:2026, episodes:13, rating:8.6, genres:["Drama","Romance"], image:"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx202269-7KNj8s2fSsJJ.jpg" },
  { id:"sparks", title:"Sparks of Tomorrow", originalTitle:"Ashita no Hibana", type:"anime", status:"On-Going", year:2026, episodes:13, rating:8.3, genres:["Action","Fantasy"], image:"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx182205-q2AeO1owuQbO.jpg" },
  { id:"skeleton", title:"Skeleton Knight in Another World Season 2", originalTitle:"Gaikotsu Kishi-sama II", type:"anime", status:"On-Going", year:2026, episodes:12, rating:8.1, genres:["Isekai","Fantasy"], image:"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx185542-6a9LCWlLHa0T.jpg" },
  { id:"mercenary", title:"The Regressed Mercenary Has a Plan", originalTitle:"Hoegwihan Yongbyeongeun Da Gyehoegi Itda", type:"manhwa", status:"On-Going", year:2025, chapters:83, rating:9.0, genres:["Action","Fantasy"], image:"https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx119257-WLz5q4Py6q9P.jpg" },
  { id:"regression", title:"Absolute Regression", originalTitle:"Jeoldaehoegwi", type:"manhwa", status:"On-Going", year:2025, chapters:71, rating:9.2, genres:["Martial Arts","Fantasy"], image:"https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx117010-AvlAhKAa6dYJ.jpg" },
  { id:"dandadan", title:"Dandadan", originalTitle:"Dandadan", type:"manga", status:"On-Going", year:2025, chapters:189, rating:9.1, genres:["Action","Comedy"], image:"https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx131586-2ETMdDiOH7vy.jpg" },
  { id:"world-after-fall", title:"The World After the Fall", originalTitle:"Myeolmang Ihu-ui Segye", type:"manhwa", status:"On-Going", year:2025, chapters:172, rating:8.9, genres:["Action","Fantasy"], image:"https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx146870-p2qpHVdPdwf5.jpg" },
  { id:"novels-extra", title:"The Novel's Extra", originalTitle:"Soseol Sok Extra", type:"manhwa", status:"On-Going", year:2025, chapters:121, rating:8.8, genres:["Action","School"], image:"https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx143624-rZRkCVNj4c3h.jpg" },
  { id:"shepherd", title:"The Shepherd Wizard", originalTitle:"Yangchigi Mabeopsa", type:"manhwa", status:"On-Going", year:2025, chapters:94, rating:8.6, genres:["Fantasy","Adventure"], image:"https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx85143-5vQY1ErASlG9.jpg" },
  { id:"entomologist", title:"The Sichuan Tang Clan’s Entomologist", originalTitle:"Sachondangga-ui Paribeolle", type:"manhwa", status:"On-Going", year:2026, chapters:57, rating:8.7, genres:["Martial Arts","Comedy"], image:"https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx87170-PKs5nnpWwM9f.jpg" },
  { id:"eminence", title:"The Eminence in Shadow", originalTitle:"Kage no Jitsuryokusha ni Naritakute", type:"manga", status:"On-Going", year:2025, chapters:79, rating:8.9, genres:["Action","Comedy"], image:"https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx98270-k5QqdNzheKAm.jpg" },
  { id:"max-level", title:"The Max Level Hero Strikes Back!", originalTitle:"Mallep Yeongung-nim Kkeseo Gwihwan Hasinda", type:"manhwa", status:"On-Going", year:2025, chapters:201, rating:8.5, genres:["Action","Fantasy"], image:"https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx113108-X2jWykIYUgGp.jpg" },
  { id:"baskerville", title:"Revenge of the Baskerville Bloodhound", originalTitle:"Cheolhyeolgeomga Sanyanggae-ui Hoegwi", type:"manhwa", status:"On-Going", year:2025, chapters:102, rating:9.0, genres:["Action","Revenge"], image:"https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx145367-vWmLPJuOjMGz.jpg" }
];
