"use client";

import { useEffect, useState } from "react";
import styles from "./home.module.css";

const MENU = [
  { label: "START", href: "/start" },
  { label: "ABOUT", href: "/about" },
  { label: "GITHUB", href: "https://github.com/Ichate/TemmeihAI" },
];

const TAGLINE = "ai bots that actually play minecraft with you.";

export default function Home() {
  const [selected, setSelected] = useState(0);
  const [typed, setTyped] = useState("");


  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTyped(TAGLINE.slice(0, i));
      if (i >= TAGLINE.length) clearInterval(id);
    }, 45);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") setSelected((s) => (s + 1) % MENU.length);
      if (e.key === "ArrowUp")
        setSelected((s) => (s - 1 + MENU.length) % MENU.length);
      if (e.key === "Enter") go(MENU[selected]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const go = (item: (typeof MENU)[number]) => {
    if (item.label === "START" || item.label === "ABOUT") {
      alert("coming soon");
      return;
    }
    
    if (item.href.startsWith("http")) {
      window.open(item.href, "_blank");
    } else {
      window.location.href = item.href;
    }
  };

  return (
    <main className={styles.screen}>
      <h1 className={`pixel ${styles.title}`}>
        <span className={`blink ${styles.star}`}>*</span> temmeihAI{" "}
        <span className={`blink ${styles.star}`}>*</span>
      </h1>

      <p className={styles.tagline}>
        {typed}
        <span className="blink">_</span>
      </p>

      <nav className={styles.menu}>
        {MENU.map((item, i) => (
          <button
            key={item.label}
            className={`pixel ${styles.item} ${
              selected === i ? styles.active : ""
            }`}
            onMouseEnter={() => setSelected(i)}
            onClick={() => go(item)}
          >
            <span className={styles.heart}>
              {selected === i ? "♥" : "\u00A0"}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      <footer className={styles.footer}>
        <span className="blink">*</span> press enter to wake the bot
      </footer>
    </main>
  );
}
