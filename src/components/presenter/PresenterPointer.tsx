"use client";

import { useEffect, useRef } from "react";
import styles from "./PresenterPointer.module.css";

interface PresenterPointerProps {
  /** Glow color for the laser dot and particles; the dot core stays white for contrast on any slide. */
  color: string;
}

const PARTICLE_COUNT = 12;
const BURST_CLEANUP_MS = 800;

/**
 * Laser-pointer cursor + click particle burst for presenter mode.
 * Pointer tracking and burst elements are driven imperatively (refs + direct
 * DOM writes) so 60fps mousemove never triggers React re-renders.
 */
export function PresenterPointer({ color }: PresenterPointerProps): React.JSX.Element {
  const overlayRef = useRef<HTMLDivElement>(null);
  const laserRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const laser = laserRef.current;
    if (!overlay || !laser) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // laserHidden only masks the pre-first-move state (dot parked at 0,0);
    // once the pointer moves the laser stays visible permanently.
    const handlePointerMove = (event: PointerEvent): void => {
      laser.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      laser.classList.remove(styles.laserHidden);
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (reducedMotion.matches) return;

      const burst = document.createElement("div");
      burst.className = styles.burst;
      burst.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
        const distance = 50 + Math.random() * 70;
        const size = 5 + Math.random() * 5;
        const particle = document.createElement("span");
        particle.className = styles.particle;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
        particle.style.animationDuration = `${400 + Math.random() * 200}ms`;
        burst.appendChild(particle);
      }

      overlay.appendChild(burst);
      // No timer bookkeeping: firing after unmount just removes a detached node.
      setTimeout(() => burst.remove(), BURST_CLEANUP_MS);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      style={{ "--pointer-color": color } as React.CSSProperties}
      aria-hidden="true"
    >
      <div ref={laserRef} className={`${styles.laser} ${styles.laserHidden}`} />
    </div>
  );
}
