"use client";

import {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  useRef,
} from "react";

const DRAG_THRESHOLD_PX = 5;

export function useHorizontalDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const drag = useRef({
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  const onPointerDown = (event: ReactPointerEvent<T>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;

    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<T>) => {
    if (drag.current.pointerId !== event.pointerId) return;

    const distance = event.clientX - drag.current.startX;
    if (Math.abs(distance) >= DRAG_THRESHOLD_PX) {
      drag.current.moved = true;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    if (!drag.current.moved) return;

    event.preventDefault();
    event.currentTarget.scrollLeft =
      drag.current.startScrollLeft - distance;
  };

  const finishDrag = (event: ReactPointerEvent<T>) => {
    if (drag.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current.pointerId = -1;
  };

  const onClickCapture = (event: ReactMouseEvent<T>) => {
    if (!drag.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current.moved = false;
  };

  return {
    ref,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onClickCapture,
  };
}
