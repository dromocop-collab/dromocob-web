"use client";

import { useEffect } from "react";

export default function ConsoleMute() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const _err = console.error;
    const _warn = console.warn;

    const shouldMute = (args: any[]) => {
      const s = args.map(String).join(" ");
      return s.includes("Permissions policy violation") && s.includes("unload is not allowed");
    };

    console.error = (...args: any[]) => (shouldMute(args) ? undefined : _err(...args));
    console.warn = (...args: any[]) => (shouldMute(args) ? undefined : _warn(...args));

    return () => {
      console.error = _err;
      console.warn = _warn;
    };
  }, []);

  return null;
}