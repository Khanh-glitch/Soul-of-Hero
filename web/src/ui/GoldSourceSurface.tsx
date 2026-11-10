import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import originalGoldStylesheet from '../../gold-authority/v2/src/index.css?inline';

/**
 * The Creator's Gold (2) design-system boundary.
 *
 * Survivor renders against the ENTIRE original Gold stylesheet. The shadow tree
 * prevents R12's .panel, .btn, .slot, .stage and other global CSS from changing
 * its layout, typography, shadows or animation. Only the four package imports
 * (Tailwind/fonts already loaded by the Veyra app entrypoint) are removed from
 * the runtime style tag, and :root tokens are bound to this shadow host.
 *
 * This is a presentation boundary, NOT a parallel engine or game.
 * React portal context and all original R12 api.act handlers are retained.
 */
const goldStyles = originalGoldStylesheet
  .replace(/^\s*@import\s+["'][^"']+["'];\s*$/gm, '')
  .replace(/:root\s*\{/, ':host {');

export function GoldSourceSurface({ children, zIndex = 45, passive = false, testId = 'gold-source-surface' }: { children: ReactNode; zIndex?: number; passive?: boolean; testId?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [portalMount, setPortalMount] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = goldStyles;
    root.appendChild(style);

    const mount = document.createElement('div');
    mount.className = 'gold-source-mount';
    mount.style.cssText = `position:absolute;inset:0;pointer-events:${passive ? 'none' : 'auto'}`;
    root.appendChild(mount);
    setPortalMount(mount);

    return () => {
      setPortalMount(null);
      mount.remove();
      style.remove();
    };
  }, [passive]);

  return (
    <div
      ref={hostRef}
      data-testid={testId}
      aria-label="Gold original authored interface"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex,
        pointerEvents: 'none',
        fontFamily: "'VT323', monospace",
        color: '#e9dfc6',
      }}
    >
      {portalMount && createPortal(children, portalMount)}
    </div>
  );
}
