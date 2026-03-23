"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MoveRight, PhoneCall } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const DEFAULT_ROTATING_WORDS = [
  "faster",
  "clearer",
  "smarter",
  "aligned",
  "traceable",
] as const;

export function RotatingHeroTitle({
  words,
  intervalMs = 2000,
  className,
}: {
  words: readonly string[];
  intervalMs?: number;
  className?: string;
}) {
  const [titleNumber, setTitleNumber] = useState(0);
  const [mounted, setMounted] = useState(false);
  const titles = useMemo(() => [...words], [words]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timeoutId = window.setTimeout(() => {
      setTitleNumber((n) => (n === titles.length - 1 ? 0 : n + 1));
    }, intervalMs);
    return () => window.clearTimeout(timeoutId);
  }, [titleNumber, titles, intervalMs, mounted]);

  /** Longest word in DEFAULT_ROTATING_WORDS — keeps width stable when children are position:absolute */
  const shellClass =
    "relative inline-flex min-h-[1.2em] min-w-[11ch] max-w-full flex-col items-center justify-center overflow-hidden text-center align-baseline md:min-h-[1.25em] md:pb-4 md:pt-1";

  if (!mounted) {
    return (
      <span className={cn(shellClass, className)}>
        <span className="font-display font-semibold text-brand">
          {titles[0] ?? ""}
        </span>
      </span>
    );
  }

  return (
    <span className={cn(shellClass, className)}>
      {titles.map((title, index) => (
        <motion.span
          key={title}
          className="absolute inset-x-0 top-0 font-display font-semibold text-brand"
          initial={false}
          transition={{ type: "spring", stiffness: 50 }}
          animate={
            titleNumber === index
              ? { y: 0, opacity: 1 }
              : {
                  y: titleNumber > index ? "-150%" : "150%",
                  opacity: 0,
                }
          }
        >
          {title}
        </motion.span>
      ))}
    </span>
  );
}

/** Standalone animated hero (full-width column layout) — SpecFlow themed. */
export function AnimatedHero() {
  const titles = useMemo(
    () => ["amazing", "new", "wonderful", "beautiful", "smart"] as const,
    []
  );
  const [titleNumber, setTitleNumber] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timeoutId = window.setTimeout(() => {
      setTitleNumber((n) => (n === titles.length - 1 ? 0 : n + 1));
    }, 2000);
    return () => window.clearTimeout(timeoutId);
  }, [titleNumber, titles, mounted]);

  return (
    <div className="w-full bg-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center gap-8 py-20 lg:py-40">
          <Button variant="secondary" size="sm" className="gap-2" asChild>
            <Link href="/features">
              Read our launch article <MoveRight className="h-4 w-4" />
            </Link>
          </Button>

          <div className="flex flex-col gap-4">
            <h1 className="max-w-2xl text-center font-display text-4xl font-normal tracking-tighter text-foreground md:text-6xl">
              <span className="text-brand">Build specs that feel&nbsp;</span>
              <span className="relative flex min-h-[1.2em] w-full justify-center overflow-hidden text-center md:min-h-[1.25em] md:pb-4 md:pt-1">
                {!mounted ? (
                  <span className="font-semibold text-brand">{titles[0]}</span>
                ) : (
                  titles.map((title, index) => (
                    <motion.span
                      key={title}
                      className="absolute font-semibold text-brand"
                      initial={false}
                      transition={{ type: "spring", stiffness: 50 }}
                      animate={
                        titleNumber === index
                          ? { y: 0, opacity: 1 }
                          : {
                              y: titleNumber > index ? "-150%" : "150%",
                              opacity: 0,
                            }
                      }
                    >
                      {title}
                    </motion.span>
                  ))
                )}
              </span>
            </h1>

            <p className="max-w-2xl text-center text-lg leading-relaxed tracking-tight text-muted-foreground md:text-xl">
              SpecFlow connects AI tools with your development workflow, uniting
              engineers and PMs to tackle key spec challenges — faster, together.
            </p>
          </div>

          <div className="flex flex-row flex-wrap justify-center gap-3">
            <Button size="lg" variant="outline" className="gap-2" asChild>
              <a href="mailto:hello@specflow.app">
                Jump on a call <PhoneCall className="h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" className="gap-2" asChild>
              <Link href="/login">
                Sign up here <MoveRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
