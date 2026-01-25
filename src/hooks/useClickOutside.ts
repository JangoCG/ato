import type { RefObject } from "react";
import { useEffect, useRef } from "react";

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onClickAway: (event: MouseEvent) => void,
  ignored?: RefObject<HTMLElement | null>,
) {
  const savedCallback = useRef(onClickAway);

  useEffect(() => {
    savedCallback.current = onClickAway;
  }, [onClickAway]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current == null || !(event.target instanceof HTMLElement)) {
        return;
      }
      const isIgnored = ignored?.current?.contains(event.target);
      const clickedOutside = !ref.current.contains(event.target);
      if (!isIgnored && clickedOutside) {
        savedCallback.current(event);
      }
    };
    document.addEventListener("mousedown", handler, { capture: true });
    document.addEventListener("contextmenu", handler, { capture: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("contextmenu", handler);
    };
  }, [ignored, ref]);
}
