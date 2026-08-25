"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import { useState } from "react";
import ProjectBriefModal from "./ProjectBriefModal";
import s from "./ProjectStartButton.module.css";

type Props = {
  label?: string;
  className?: string;
  variant?: "light" | "gradient" | "outline";
  mode?: "website" | "mobile";
};

export default function ProjectStartButton({
  label = "Proje başlat",
  className = "",
  variant = "gradient",
  mode = "website",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`${s.button} ${s[variant]} ${className}`}
        onClick={() => setOpen(true)}
      >
        <Sparkles />
        <span>{label}</span>
        <ArrowUpRight />
      </button>
      <ProjectBriefModal open={open} onClose={() => setOpen(false)} mode={mode} />
    </>
  );
}
