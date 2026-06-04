"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./start.module.css";

export default function Start() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("25565");
  const [version, setVersion] = useState("1.20.4");
  const [botName, setBotName] = useState("temmeihBot");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const steps = [
    { label: "server ip", value: ip, setter: setIp, placeholder: "localhost" },
    { label: "port", value: port, setter: setPort, placeholder: "25565" },
    { label: "minecraft version", value: version, setter: setVersion, placeholder: "1.20.4" },
    { label: "bot name", value: botName, setter: setBotName, placeholder: "temmeihBot" },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleConnect();
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setStatus("connecting...");
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, port: parseInt(port), version, botName }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("bot joined! it will leave in 5 minutes.");
      } else {
        setStatus("failed: " + data.error);
      }
    } catch (e) {
      setStatus("connection error");
    }
    setLoading(false);
  };

  const current = steps[step];

  return (
    <main className={styles.screen}>
      <h1 className={`pixel ${styles.title}`}>
        <span className={`blink ${styles.star}`}>*</span> setup{" "}
        <span className={`blink ${styles.star}`}>*</span>
      </h1>

      {!status ? (
        <div className={styles.form}>
          <p className={styles.stepLabel}>step {step + 1} of {steps.length}</p>
          <label className={styles.label}>{current.label}</label>
          <input
            className={styles.input}
            type="text"
            value={current.value}
            onChange={(e) => current.setter(e.target.value)}
            placeholder={current.placeholder}
            autoFocus
          />
          <div className={styles.buttons}>
            {step > 0 && (
              <button className={`pixel ${styles.btn}`} onClick={() => setStep(step - 1)}>
                back
              </button>
            )}
            <button className={`pixel ${styles.btn} ${styles.primary}`} onClick={handleNext} disabled={loading}>
              {step === steps.length - 1 ? "connect" : "next"}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.status}>
          <p className={styles.statusText}>{status}</p>
          <button className={`pixel ${styles.btn}`} onClick={() => router.push("/")}>
            back to home
          </button>
        </div>
      )}

      <footer className={styles.footer}>
        <span className="blink">*</span> demo mode - bot stays for 5 minutes
      </footer>
    </main>
  );
}
