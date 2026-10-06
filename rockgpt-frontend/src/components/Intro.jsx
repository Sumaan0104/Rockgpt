import React, { useState, useEffect, useRef } from "react";
import Logo from "./Logo.jsx";

const LETTERS = "ROCKGPT".split("");

export default function Intro({ onFinish }) {
  const [done, setDone] = useState(false);
  const [removed, setRemoved] = useState(false);
  const completedRef = useRef(false);

  const finishIntro = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      sessionStorage.setItem("rockgpt_intro_played", "true");
    } catch {}
    setDone(true);
    setTimeout(() => {
      setRemoved(true);
      if (onFinish) onFinish();
    }, 800);
  };

  useEffect(() => {
    // Check if intro has already run in this session
    try {
      if (sessionStorage.getItem("rockgpt_intro_played") === "true") {
        setRemoved(true);
        if (onFinish) onFinish();
        return;
      }
    } catch {}

    const timer = setTimeout(() => {
      finishIntro();
    }, 4400);

    return () => clearTimeout(timer);
  }, []);

  if (removed) return null;

  return (
    <div
      id="intro"
      className={done ? "done" : ""}
      onClick={finishIntro}
      role="button"
      tabIndex={0}
      aria-label="Skip introduction"
    >
      <div id="iLogo">
        <Logo intro />
      </div>

      <div id="word">
        {LETTERS.map((letter, i) => (
          <span
            key={i}
            style={{ animationDelay: `${2.5 + i * 0.08}s` }}
          >
            {letter}
          </span>
        ))}
      </div>

      <div className="bar" />
    </div>
  );
}
