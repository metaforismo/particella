"use client";

import { useCallback, useRef, type PointerEvent } from "react";

const TAP_TOLERANCE = 6;
const SNAP_DISTANCE = 48;

/** The handle lives inside the sheet it drags. */
const sheetOf = (event: PointerEvent<HTMLElement>) => event.currentTarget.closest<HTMLElement>("aside");

/**
 * Drag the bottom sheet by its handle. The height follows the finger without React re-renders,
 * then snaps open or closed. A movement under a few pixels counts as a tap and toggles.
 */
export function useSheetDrag(open: boolean, setOpen: (open: boolean) => void) {
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    const el = sheetOf(event);
    if (!el || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startHeight: el.getBoundingClientRect().height, moved: false };
    el.style.transition = "none";
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const el = sheetOf(event);
    const state = drag.current;
    if (!el || !state) return;
    const delta = state.startY - event.clientY;
    if (Math.abs(delta) > TAP_TOLERANCE) state.moved = true;
    if (!state.moved) return;
    const max = window.innerHeight - 80;
    el.style.height = `${Math.min(max, Math.max(120, state.startHeight + delta))}px`;
  }, []);

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const el = sheetOf(event);
      const state = drag.current;
      drag.current = null;
      if (!el || !state) return;
      el.style.transition = "";
      el.style.height = "";
      if (!state.moved) {
        setOpen(!open);
        return;
      }
      const delta = state.startY - event.clientY;
      if (delta > SNAP_DISTANCE) setOpen(true);
      else if (delta < -SNAP_DISTANCE) setOpen(false);
    },
    [open, setOpen],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}
