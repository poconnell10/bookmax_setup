"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TraqraOption = {
  value: string;
  label: string;
  desc?: string;
};

export function TraqraSelect({
  id,
  value,
  options,
  placeholder,
  ariaLabel,
  listLabel,
  onChange,
}: {
  id: string;
  value: string;
  options: TraqraOption[];
  placeholder: string;
  ariaLabel?: string;
  listLabel?: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((item) => item.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options;
    }
    return options.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.desc || "").toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`tsel${open ? " open" : ""}`} id={id}>
      <button
        type="button"
        className="trig"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => {
          setOpen((next) => !next);
          setQuery("");
        }}
      >
        <span className={`val${selected ? "" : " ph"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className="menu">
          <div className="msearch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={query}
              placeholder={`Search ${options.length} options…`}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="mscroll" role="listbox" aria-label={listLabel || "Property management systems"}>
            {filtered.length === 0 ? (
              <div className="mempty">No match for “{query}”</div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={item.value === value}
                  className={`mi${item.value === value ? " on" : ""}`}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <svg className="tk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="mt">
                    <b>{item.label}</b>
                    {item.desc ? <i>{item.desc}</i> : null}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
