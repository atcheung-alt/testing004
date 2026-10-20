"use client";

import { useEffect, useRef } from "react";

/** Looping clip behind Dashboard, Bookings, and Massage. Stays still when motion is turned off. */
export default function PageVideo({ children }: { children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const off = document.documentElement.dataset.animations === "off";
    if (reduce || off) {
      video.pause();
      return;
    }
    video.play().catch(() => {});
  }, []);

  return (
    <>
      <div className="page-video" aria-hidden="true">
        <video ref={videoRef} autoPlay muted loop playsInline poster="/media/page-bg.jpg">
          <source src="/media/page-bg.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="page-video-content">{children}</div>
    </>
  );
}
