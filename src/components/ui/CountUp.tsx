import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

export default function CountUp({
  value,
  duration = 1.2,
  format,
}: {
  value: number;
  duration?: number;
  format?: (v: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const controls = animate(prevValue.current, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value, duration]);

  const rounded = Math.round(display);
  return <>{format ? format(rounded) : rounded.toLocaleString("ru-RU")}</>;
}
