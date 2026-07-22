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

export const catalog: CatalogItem[] = [
  {
    id: "frieren-beyond-journeys-end", title: "Frieren: Beyond Journey’s End", originalTitle: "Sousou no Frieren", type: "anime", status: "Completed", year: 2023, episodes: 0, rating: 0,
    genres: ["Adventure", "Drama", "Fantasy"], anilistId: 154587,
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
    description: "The adventure is over, but life goes on for the elf mage Frieren. Decades after defeating the Demon King, she begins a new journey to understand the people whose lives pass so quickly beside her."
  },
  {
    id: "jujutsu-kaisen", title: "JUJUTSU KAISEN", originalTitle: "Jujutsu Kaisen", type: "anime", status: "Completed", year: 2020, episodes: 0, rating: 0,
    genres: ["Action", "Drama", "Supernatural"], anilistId: 113415,
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LHBAeoZDIsnF.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-jQBSkxWAAk83.jpg",
    description: "Yuji Itadori swallows a cursed object to save a friend and becomes the vessel of a terrifying curse. Guided by powerful sorcerers, he enters a school devoted to fighting supernatural threats."
  },
  {
    id: "demon-slayer", title: "Demon Slayer: Kimetsu no Yaiba", originalTitle: "Kimetsu no Yaiba", type: "anime", status: "Completed", year: 2019, episodes: 0, rating: 0,
    genres: ["Action", "Adventure", "Drama", "Fantasy", "Supernatural"], anilistId: 101922,
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-33MtJGsUSxga.jpg",
    description: "After his family is attacked by demons, Tanjiro becomes a demon slayer in the hope of turning his sister Nezuko back into a human."
  },
  {
    id: "attack-on-titan", title: "Attack on Titan", originalTitle: "Shingeki no Kyojin", type: "anime", status: "Completed", year: 2013, episodes: 0, rating: 0,
    genres: ["Action", "Drama", "Fantasy", "Mystery"], anilistId: 16498,
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/16498-8jpFCOcDmneX.jpg",
    description: "Humanity lives behind enormous walls to survive the Titans. When the walls fall, Eren Yeager vows to fight back and uncover the truth of their world."
  },
  {
    id: "one-punch-man-season-3", title: "One-Punch Man Season 3", originalTitle: "One Punch Man 3", type: "anime", status: "Completed", year: 2025, episodes: 0, rating: 0,
    genres: ["Action", "Comedy", "Sci-Fi", "Supernatural"], anilistId: 153800,
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx153800-8SpzdHOaZCoU.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/153800-bgkLxE9SHmUi.jpg",
    description: "Saitama returns as the Hero Association prepares to confront the Monster Association and the human monster Garou."
  },
  {
    id: "last-dungeon-boonies", title: "Suppose a Kid from the Last Dungeon Boonies moved to a starter town?", originalTitle: "Tatoeba Last Dungeon Mae no Mura no Shounen", type: "anime", status: "Completed", year: 2021, episodes: 0, rating: 0,
    genres: ["Adventure", "Comedy", "Fantasy"], anilistId: 112649,
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx112649-Wdcxo6cQZbhx.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/112649-jonCCVLHopXa.jpg",
    description: "Lloyd leaves his remote village to become an adventurer, unaware that growing up beside the world’s deadliest dungeon has made him extraordinarily powerful."
  },
  {
    id: "solo-leveling-manhwa", title: "Solo Leveling", originalTitle: "Na Honjaman Level Up", type: "manhwa", status: "Completed", year: 2018, chapters: 0, rating: 0,
    genres: ["Action", "Adventure", "Fantasy"], anilistId: 105398,
    image: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105398-b673Vt5ZSuz3.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/105398-4UrEhdqZukrg.jpg",
    description: "The weakest hunter, Sung Jin-Woo, is chosen by a mysterious system that allows him alone to level up and grow beyond every known limit."
  },
  {
    id: "dandadan-manga", title: "Dandadan", originalTitle: "Dandadan", type: "manga", status: "Ongoing", year: 2021, chapters: 0, rating: 0,
    genres: ["Action", "Comedy", "Drama", "Romance", "Sci-Fi", "Supernatural"], anilistId: 132029,
    image: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx132029-prGF4gePdSKv.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/132029-V1x9JAh3G8QK.jpg",
    description: "Momo believes in ghosts but not aliens, while Okarun believes in aliens but not ghosts. Their challenge to prove each other wrong becomes a wild supernatural adventure."
  },
  {
    id: "one-piece-manga", title: "One Piece", originalTitle: "ONE PIECE", type: "manga", status: "Ongoing", year: 1997, chapters: 0, rating: 0,
    genres: ["Action", "Adventure", "Comedy", "Fantasy"], anilistId: 30013,
    image: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-BeslEMqiPhlk.jpg",
    bannerImage: "https://s4.anilist.co/file/anilistcdn/media/manga/banner/30013-hbbRZqC5MjYh.jpg",
    description: "Monkey D. Luffy sets out across the seas to gather a crew, discover the legendary One Piece, and become King of the Pirates."
  },
  {
    id: "koigokoro-kyoumeichuu", title: "Koigokoro Kyoumeichuu", originalTitle: "恋心キョウメイ中", type: "manga", status: "Completed", year: 2009, chapters: 0, rating: 0,
    genres: ["Romance"], anilistId: 52991,
    image: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx52991-R089mV09fnOc.png",
    description: "A romance collection following Ritsuka, Kaze, and their changing relationships when a striking new teacher arrives."
  }
];
