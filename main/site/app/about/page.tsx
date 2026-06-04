"use client";

import { useRouter } from "next/navigation";
import styles from "./about.module.css";

export default function About() {
  const router = useRouter();

  return (
    <main className={styles.screen}>
      <h1 className={`pixel ${styles.title}`}>
        <span className={`blink ${styles.star}`}>*</span> about{" "}
        <span className={`blink ${styles.star}`}>*</span>
      </h1>

      <div className={styles.content}>
        <p className={styles.tagline}>
          ai bots that actually play minecraft with you.
        </p>

        <p className={styles.description}>
          not just stand there. not just follow you around. actually play like
          fight, build, craft, cook, grind, talk. like a real player, but it
          never logs off.
        </p>

        <div className={styles.features}>
          <p>
            <span className={styles.label}>talks</span> - real conversations in
            chat, not just commands
          </p>
          <p>
            <span className={styles.label}>walks</span> - follows you, navigates
            on its own
          </p>
          <p>
            <span className={styles.label}>fights</span> - alongside you or
            against you (yes really)
          </p>
          <p>
            <span className={styles.label}>crafts</span> - tell it what you
            need, it figures out the recipe
          </p>
          <p>
            <span className={styles.label}>cooks</span> - so you stop dying of
            hunger mid-build
          </p>
          <p>
            <span className={styles.label}>grinds</span> - send it off to farm
            while you do other stuff
          </p>
          <p>
            <span className={styles.label}>builds</span> - describe something
            and watch it happen
          </p>
        </div>
      </div>

      <button className={`pixel ${styles.back}`} onClick={() => router.push("/")}>
        <span className={styles.heart}>♥</span> back
      </button>

      <footer className={styles.footer}>
        <span className="blink">*</span> apache 2.0 license
      </footer>
    </main>
  );
}
