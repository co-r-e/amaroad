"use client";

import styles from "./PresenterTextPopup.module.css";

interface PresenterTextPopupProps {
  text: string;
}

/** Scale the type down as the selection grows so it always fits on screen. */
function fontSizeFor(text: string): string {
  const length = [...text].length;
  if (length <= 20) return "7vw";
  if (length <= 60) return "5vw";
  if (length <= 140) return "3.6vw";
  return "2.6vw";
}

/** Fullscreen overlay that spotlights the presenter's selected text in large type. */
export function PresenterTextPopup({ text }: PresenterTextPopupProps): React.JSX.Element {
  return (
    <div className={styles.backdrop}>
      <p className={styles.text} style={{ fontSize: fontSizeFor(text) }}>
        {text}
      </p>
    </div>
  );
}
