import Link from 'next/link';

export function Brand() {
  return <Link className="brand" href="/" aria-label="Santorini, inicio"><img src="/santorini-mark.png" alt="Santorini" /></Link>;
}
