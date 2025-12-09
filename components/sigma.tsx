"use client";

import { Accessibility } from "accessibility";

export default function Sigma() {
  const instance = new Accessibility();
  return (
    <button
      onClick={() => {
        instance.menuInterface.increaseText();
      }}
    >
      click me
    </button>
  );
}
