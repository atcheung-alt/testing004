"use client";

import { useEffect, useRef } from "react";

const CLIPS = {
  dashboard: { src: "/media/bg-dashboard.mp4", poster: "/media/bg-dashboard.jpg" },
  bookings: { src: "/media/bg-bookings.mp4", poster: "/media/bg-bookings.jpg" },
  massage: { src: "/media/bg-massage.mp4", poster: "/media/bg-massage.jpg" },
} as const;

/** Real loop behind one page. Stays on the poster when motion is turned off. */
export default function PageVideo({
  clip,
  children,
}: {
  clip: keyof typeof CLIPS;
  children: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const file = CLIPS[clip];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const off = document.documentElement.dataset.animations === "off";
    if (reduce || off) {
      video.pause();
      return;
    }
    video.playbackRate = 0.85;
    video.play().catch(() => {});
  }, []);

  return (
    <>
      <div className="page-video" aria-hidden="true">
        <video ref={videoRef} autoPlay muted loop playsInline poster={file.poster}>
          <source src={file.src} type="video/mp4" />
        </video>
      </div>
      <div className="page-video-content">{children}</div>
    </>
  );
}
