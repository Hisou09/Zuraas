import { Chrome } from "../../components/Chrome";
import { catalog } from "../../data/catalog";
import type { CSSProperties } from "react";

export function generateStaticParams() {
  return catalog.map((item) => ({ id: item.id }));
}

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = catalog.find((entry) => entry.id === id) ?? catalog[0];
  const isAnime = item.type === "anime";
  const similar = catalog.filter((entry) => entry.type === item.type && entry.id !== item.id).slice(0, 7);
  const total = isAnime ? Math.min(item.episodes ?? 12, 12) : Math.min(item.chapters ?? 12, 12);
  const description = isAnime
    ? "Энэхүү бүтээл нь хүч, нөхөрлөл, сонголтын үнэ цэнийг харуулсан адал явдалт түүх. Шинэ анги бүр Монгол хадмалтайгаар нэмэгдэнэ."
    : "Өнгөрсөн амьдралын алдаа, шинэ боломж хоёрын дунд гол дүр өөрийн хувь тавиланг дахин бичнэ. Монгол орчуулгатай бүлгүүдийг дарааллаар нь уншаарай.";

  return <Chrome><main className="detail-page">
    <section className="title-hero" style={{ "--hero-image": `url(${item.image})` } as CSSProperties}>
      <div className="title-backdrop" /><div className="title-gradient" />
      <div className="title-intro"><img src={item.image} alt={`${item.title} cover`} /><div><small>{item.originalTitle}</small><h1>{item.title}</h1><div className="title-stats"><b>{Math.round(item.rating * 10)}%</b><b>{item.year}</b><b>{item.status}</b></div><p>{description}</p><div className="title-actions"><button>▶ &nbsp; {isAnime ? "Одоо үзэх" : "Одоо унших"}</button><button aria-label="Миний санд нэмэх">＋</button><button aria-label="Хуваалцах">⌘</button><span>MGL</span></div></div></div>
    </section>

    {isAnime && <section className="relations"><div className="detail-heading"><h2>Холбоотой бүтээл</h2><button>Бүгдийг үзэх</button></div><div className="relation-grid">{similar.slice(0,3).map((entry) => <a href={`/title/${entry.id}`} key={entry.id}><img src={entry.image} alt="" /><div><small>SIDE_STORY</small><b>{entry.title}</b><span>SPECIAL</span></div></a>)}</div></section>}

    <div className="detail-columns">
      <section className="entries"><div className="detail-heading"><h2>{isAnime ? "Ангиуд" : "Бүлгүүд"}</h2><label><span>⌕</span><input placeholder={isAnime ? "Анги хайх..." : "Бүлэг хайх..."} /></label></div>
        {isAnime ? <div className="episode-list">{Array.from({ length: total }, (_, i) => total - i).slice(0,6).map((number) => <a href="#player" key={number}><div className="episode-thumb"><img src={item.image} alt="" /><span>Ep {number}</span></div><div><b>Episode {number}</b><p>Монгол хадмалтай анги.</p><small>▣ &nbsp; {40 + number * 3} views</small></div></a>)}</div>
        : <div className="chapter-table">{Array.from({ length: total }, (_, i) => i + 1).map((number) => <a href="#reader" key={number}><span>{number}</span><b>Chapter {number}</b><small>Унших →</small></a>)}</div>}
      </section>

      <aside className="detail-side"><h2>Бусад</h2><div className="info-box"><small>Төрөл</small><div>{item.genres.map((genre) => <span key={genre}>{genre}</span>)}</div><small>Статус</small><div><span>{item.status}</span><span>{item.year}</span></div><small>Бусад нэр</small><div><span>{item.originalTitle}</span></div></div><div className="discussion-title"><h2>Хэлэлцүүлэг ›</h2><button>＋ Үүсгэх</button></div><div className="discussion">Шинэ хэлэлцүүлэг эхлүүлэх</div></aside>
    </div>

    {!isAnime && <section className="characters"><div className="detail-heading"><h2>Дүрүүд</h2><button>Бүгдийг үзэх</button></div><div className="character-grid">{["Гол дүр","Туслах дүр","Багш","Өрсөлдөгч","Холбоотон","Нууцлаг дүр"].map((role,i) => <div key={role}><img src={similar[i % similar.length]?.image ?? item.image} alt="" /><span><b>{role}</b><small>{i === 0 ? "Main" : "Supporting"}</small></span></div>)}</div></section>}

    <section className="more-like"><div className="detail-heading"><h2>Төстэй бүтээлүүд</h2></div><div className="mini-row">{similar.map((entry) => <a href={`/title/${entry.id}`} key={entry.id}><img src={entry.image} alt="" /><b>{entry.title}</b><span>{entry.status}</span></a>)}</div></section>
  </main></Chrome>;
}
