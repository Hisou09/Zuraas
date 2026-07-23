"use client";

import { ArrowLeft, Play } from "lucide-react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { invalidateCachedJson } from "../data/client-cache";
import "./anime-player.css";

type EpisodeItem = {
  number: number;
  href: string;
};

function getVideoType(url: string) {
  const source = url.toLowerCase();
  if (source.includes(".webm")) return "video/webm";
  if (source.includes(".m3u8")) return "application/x-mpegURL";
  if (source.includes(".ogg") || source.includes(".ogv")) return "video/ogg";
  return "video/mp4";
}

function VideoJsPlayer({ src, poster, title }: { src: string; poster: string; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const element = document.createElement("video-js");
    element.classList.add("vjs-big-play-centered", "zuraas-video-player", "zuraas-video-skin");
    element.setAttribute("aria-label", title);
    hostRef.current.appendChild(element);

    let disposed = false;
    let player: ReturnType<(typeof import("video.js"))["default"]> | null = null;
    void Promise.all([import("video.js/core.es.js"), import("video.js/dist/video-js.css")]).then(([module]) => {
      if (disposed) return;
      player = module.default(element, {
        autoplay: false,
        controls: true,
        responsive: true,
        fluid: false,
        playsinline: true,
        inactivityTimeout: 1200,
        preload: "metadata",
        poster,
        sources: [{ src, type: getVideoType(src) }],
        userActions: {
          click: false,
          doubleClick: false,
          hotkeys: false,
        },
        controlBar: {
          skipButtons: { backward: 10, forward: 10 },
          pictureInPictureToggle: false,
          remainingTimeDisplay: true,
          volumePanel: { inline: true },
        },
      });
      player.ready(() => {
        if (!player) return;

        const playerElement = player.el() as HTMLElement;
        playerElement.tabIndex = 0;

        const seekBy = (seconds: number) => {
          if (!player || player.isDisposed()) return;
          const currentTime = Number(player.currentTime()) || 0;
          const duration = Number(player.duration());
          const maximum = Number.isFinite(duration) && duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
          player.currentTime(Math.min(maximum, Math.max(0, currentTime + seconds)));
        };

        const isInteractiveControl = (target: EventTarget | null) =>
          target instanceof Element && Boolean(target.closest(
            ".vjs-control-bar, .vjs-menu, .vjs-modal-dialog, button, input, select, textarea, a",
          ));

        const isTypingTarget = (target: EventTarget | null) =>
          target instanceof Element && Boolean(target.closest(
            "input, select, textarea, [contenteditable='true']",
          ));

        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          if (isTypingTarget(event.target)) return;
          event.preventDefault();
          seekBy(event.key === "ArrowLeft" ? -10 : 10);
        };

        const seekFromPosition = (clientX: number) => {
          const bounds = playerElement.getBoundingClientRect();
          seekBy(clientX < bounds.left + bounds.width / 2 ? -10 : 10);
        };

        const togglePlayback = () => {
          if (!player || player.isDisposed()) return;
          if (player.paused()) void player.play()?.catch(() => null);
          else player.pause();
        };

        let ignoreClickUntil = 0;
        let singleTapTimer: ReturnType<typeof setTimeout> | null = null;
        let hideControlsTimer: ReturnType<typeof setTimeout> | null = null;

        const showControls = () => {
          if (!player || player.isDisposed()) return;
          player.userActive(true);
        };

        const hideControlsAfterPlaybackStarts = () => {
          if (hideControlsTimer) clearTimeout(hideControlsTimer);
          hideControlsTimer = setTimeout(() => {
            if (player && !player.isDisposed() && !player.paused()) player.userActive(false);
          }, 850);
        };

        const onClick = (event: MouseEvent) => {
          if (performance.now() < ignoreClickUntil || isInteractiveControl(event.target)) return;
          event.preventDefault();
          togglePlayback();
        };

        const onDoubleClick = (event: MouseEvent) => {
          if (isInteractiveControl(event.target)) return;
          event.preventDefault();
          event.stopPropagation();
          seekFromPosition(event.clientX);
        };

        let lastTapTime = 0;
        let lastTapSide = 0;
        const onPointerUp = (event: PointerEvent) => {
          if (event.pointerType === "mouse" || isInteractiveControl(event.target)) return;
          event.preventDefault();
          event.stopPropagation();
          ignoreClickUntil = performance.now() + 500;
          const bounds = playerElement.getBoundingClientRect();
          const side = event.clientX < bounds.left + bounds.width / 2 ? -1 : 1;
          const now = performance.now();

          if (side === lastTapSide && now - lastTapTime <= 340) {
            if (singleTapTimer) clearTimeout(singleTapTimer);
            singleTapTimer = null;
            seekBy(side * 10);
            showControls();
            hideControlsAfterPlaybackStarts();
            lastTapTime = 0;
            lastTapSide = 0;
            return;
          }

          lastTapTime = now;
          lastTapSide = side;
          if (singleTapTimer) clearTimeout(singleTapTimer);
          singleTapTimer = setTimeout(() => {
            togglePlayback();
            singleTapTimer = null;
            lastTapTime = 0;
            lastTapSide = 0;
          }, 340);
        };

        const onPlay = () => hideControlsAfterPlaybackStarts();
        const onPause = () => {
          if (hideControlsTimer) clearTimeout(hideControlsTimer);
          showControls();
        };

        document.addEventListener("keydown", onKeyDown);
        playerElement.addEventListener("click", onClick);
        playerElement.addEventListener("dblclick", onDoubleClick);
        playerElement.addEventListener("pointerup", onPointerUp);
        player.on("play", onPlay);
        player.on("pause", onPause);
        player.one("dispose", () => {
          if (singleTapTimer) clearTimeout(singleTapTimer);
          if (hideControlsTimer) clearTimeout(hideControlsTimer);
          document.removeEventListener("keydown", onKeyDown);
          playerElement.removeEventListener("click", onClick);
          playerElement.removeEventListener("dblclick", onDoubleClick);
          playerElement.removeEventListener("pointerup", onPointerUp);
          player?.off("play", onPlay);
          player?.off("pause", onPause);
        });
      });
    });

    return () => {
      disposed = true;
      if (player && !player.isDisposed()) player.dispose();
      else element.remove();
    };
  }, [poster, src, title]);

  return <div className="anime-video-shell anime-video-shell--polished">
    <div className="anime-video-host" ref={hostRef}/>
  </div>;
}

export function AnimePlayer({
  contentId,
  title,
  episode,
  videoUrl,
  poster,
  episodes,
}: {
  contentId: string;
  title: string;
  episode: number;
  videoUrl: string | null;
  poster: string;
  episodes: EpisodeItem[];
}) {
  const router = useRouter();
  const detailHref = `/title/${encodeURIComponent(contentId)}`;
  const leavePlayer = () => {
    const previous = window.sessionStorage.getItem("zuraas-previous-route");
    if (previous === detailHref) router.back();
    else router.replace(detailHref);
  };

  useEffect(() => {
    document.title = `${title} · Анги ${episode}`;
    void fetch("/api/app/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentId, progress: episode }),
      keepalive: true,
    }).then((response) => {
      if (response.ok) invalidateCachedJson("user-items:history");
    }).catch(() => null);
  }, [contentId, episode, title]);

  return <main className="anime-watch-page">
    <header className="anime-watch-header">
      <button type="button" onClick={leavePlayer} aria-label="Дэлгэрэнгүй хуудас руу буцах">
        <ArrowLeft size={21}/>
      </button>
      <div><b>{title}</b><small>Анги {episode}</small></div>
    </header>

    <div className="anime-watch-layout">
      <section className="anime-player-stage">
        {videoUrl
          ? <VideoJsPlayer src={videoUrl} poster={poster} title={`${title} · Анги ${episode}`}/>
          : <div className="anime-video-empty">
              <span><Play size={28}/></span>
              <h1>Бичлэг олдсонгүй</h1>
              <p>Энэ ангид видео файл нэмэгдээгүй байна.</p>
            </div>}
      </section>

      <aside className="anime-next-episode anime-episode-directory">
        <div className="anime-episode-directory-list">
          {episodes.map((item) => {
            const active = item.number === episode;
            const content = <>
              <span className="anime-next-poster">
                <img src={poster} alt=""/>
                <i><Play size={18} fill="currentColor"/></i>
                <em>EP {item.number}</em>
              </span>
              <div>
                <b>Анги {item.number}</b>
                <p>{title}</p>
                <span>{active ? "Одоо үзэж байна" : "Шууд үзэх"}</span>
              </div>
            </>;

            return active
              ? <div className="anime-episode-directory-item is-active" aria-current="page" key={item.number}>{content}</div>
              : <Link className="anime-episode-directory-item" href={item.href} replace key={item.number}>{content}</Link>;
          })}
        </div>
      </aside>
    </div>
  </main>;
}
