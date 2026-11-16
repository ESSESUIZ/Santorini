'use client';

import Image from 'next/image';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useState } from 'react';

export function TiltIsland() {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const [pressed, setPressed] = useState(false);
  const x = useSpring(pointerX, { stiffness: 170, damping: 19, mass: 0.72 });
  const y = useSpring(pointerY, { stiffness: 170, damping: 19, mass: 0.72 });
  const rotateX = useTransform(y, [-1, 1], [8, -8]);
  const rotateY = useTransform(x, [-1, 1], [-8, 8]);
  const shadeX = useTransform(x, [-1, 1], ['8%', '92%']);
  const shadeY = useTransform(y, [-1, 1], ['8%', '92%']);
  const lightX = useTransform(x, [-1, 1], ['88%', '12%']);
  const lightY = useTransform(y, [-1, 1], ['88%', '12%']);
  const shade = useMotionTemplate`radial-gradient(circle at ${shadeX} ${shadeY}, rgba(1, 7, 28, .42) 0%, rgba(1, 7, 28, .12) 24%, transparent 49%), radial-gradient(circle at ${lightX} ${lightY}, rgba(159, 195, 255, .34) 0%, transparent 46%)`;

  const reset = () => {
    pointerX.set(0);
    pointerY.set(0);
    setPressed(false);
  };

  return <div className="catalog-tilt-float" aria-hidden="true">
    <motion.div
      className="catalog-tilt-surface"
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      animate={{ scale: pressed && !reduceMotion ? 0.985 : 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      onPointerEnter={(event) => {
        if (!reduceMotion && event.pointerType !== 'touch') setPressed(true);
      }}
      onPointerMove={(event) => {
        if (reduceMotion || event.pointerType === 'touch') return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        const normalizedY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
        pointerX.set(Math.max(-1, Math.min(1, normalizedX)));
        pointerY.set(Math.max(-1, Math.min(1, normalizedY)));
      }}
      onPointerLeave={reset}
      onPointerCancel={reset}
    >
      <Image src="/santorini-island-clean.png" alt="" fill priority sizes="(max-width: 850px) 70vw, 42vw" />
      <motion.span className="catalog-tilt-shade" style={{ background: shade }} />
    </motion.div>
  </div>;
}
