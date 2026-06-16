"use client";
// A dark-mode button. It toggles a `dark` class on <html>; the CSS then fades in
// a darkening overlay over the background (see .dark-overlay in globals.css).
// The choice is saved in localStorage so it sticks between visits.

import { useEffect, useState } from "react";

export default function DarkToggle() {
  const [dark, setDark] = useState(false);

  // On first load, restore the saved preference.
  useEffect(() => {
    const saved = localStorage.getItem("dark") === "1";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("dark", next ? "1" : "0");
  }

  return (
    <button type="button" onClick={toggle} className="dark-toggle" aria-pressed={dark}>
      {dark ? "⬤ Brighter" : "⏾ Darker"}
    </button>
  );
}
