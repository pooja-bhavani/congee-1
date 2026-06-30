"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { Photo } from "@/lib/api";

type ReelPhoto = Photo & { line: string };

export function Reel({
  title,
  photos,
  onClose,
}: {
  title: string;
  photos: ReelPhoto[];
  onClose: () => void;
}) {
  const [i, setI] = useState(-1); // -1 = title card
  const DURATION = 4800;

  useEffect(() => {
    const t = setTimeout(() => {
      setI((x) => (x + 1 > photos.length - 1 ? x : x + 1));
    }, i === -1 ? 2600 : DURATION);
    return () => clearTimeout(t);
  }, [i, photos.length]);

  const photo = i >= 0 ? photos[i] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black"
    >
      {/* Progress segments */}
      <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-3">
        {photos.map((_, idx) => (
          <div key={idx} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full bg-white"
              style={{ width: i > idx ? "100%" : i === idx ? "100%" : "0%", transition: i === idx ? `width ${DURATION}ms linear` : "none" }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={onClose}
        className="absolute right-4 top-6 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-4 w-4" />
      </button>

      <AnimatePresence mode="wait">
        {i === -1 ? (
          <motion.div
            key="title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full items-center justify-center"
          >
            <div className="text-center">
              <p className="mb-3 text-xs uppercase tracking-[0.4em] text-ember">A Memory Reel</p>
              <h1 className="font-serif text-5xl text-cream md:text-7xl">{title}</h1>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={photo!.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo!.url} alt={photo!.line} className="kenburns h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />
            <div className="absolute inset-x-0 bottom-0 p-8 md:p-16">
              <motion.p
                key={photo!.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.3 }}
                className="mx-auto max-w-3xl text-center font-serif text-3xl leading-snug text-cream md:text-5xl"
              >
                {photo!.line}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
