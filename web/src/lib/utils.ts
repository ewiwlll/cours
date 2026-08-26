import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return 'Date inconnue';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatTimeWithHours(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatTimeMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

export type SoundType =
  | 'correct'
  | 'wrong'
  | 'reveal'
  | 'complete'
  | 'success'
  | 'click'
  | 'marker'
  | 'flip'
  | 'again'
  | 'hard'
  | 'good'
  | 'easy'
  | string;

export function playAudioFeedback(type: SoundType): void {
  if (typeof window === 'undefined' || !window.AudioContext) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'correct' || type === 'good' || type === 'easy') {
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'wrong' || type === 'again') {
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(200, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'reveal' || type === 'flip' || type === 'hard') {
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'complete' || type === 'success') {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'click' || type === 'marker') {
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch {
    // AudioContext blocked or not supported, ignore silently
  }
}

// Simple safe KaTeX inline/block renderer if katex is loaded in window
declare global {
  interface Window {
    katex?: {
      renderToString: (
        tex: string,
        options?: { displayMode?: boolean; throwOnError?: boolean }
      ) => string;
    };
  }
}

export function renderKatex(tex: string, displayMode: boolean = false): string {
  if (typeof window !== 'undefined' && window.katex) {
    try {
      return window.katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
      });
    } catch {
      return `<code class="bg-surface-elevated px-1.5 py-0.5 rounded text-accent-blue font-mono text-sm">${escapeHtml(tex)}</code>`;
    }
  }
  return `<code class="bg-surface-elevated px-1.5 py-0.5 rounded text-accent-blue font-mono text-sm">${escapeHtml(tex)}</code>`;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderMarkdown(content: string): string {
  if (!content) return '';

  let html = content;

  // Render display math $$ ... $$
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    return `<div class="my-3 overflow-x-auto text-center py-2 bg-surface-elevated/40 rounded-lg border border-border-subtle">${renderKatex(tex.trim(), true)}</div>`;
  });

  // Render inline math $ ... $
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, tex) => {
    return renderKatex(tex.trim(), false);
  });

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-zinc-100 mt-6 mb-2 tracking-tight">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold text-zinc-100 mt-8 mb-3 pb-1 border-b border-border-subtle tracking-tight flex items-center gap-2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-zinc-100 mt-8 mb-4 tracking-tight">$1</h1>');

  // GitHub-style callouts: > [!WARNING], > [!IMPORTANT], > [!NOTE], > [!TIP], > [!CAUTION]
  html = html.replace(
    /^>\s*\[!(WARNING|CAUTION|IMPORTANT|NOTE|TIP)\]\s*(?:\n|<br\s*\/?>)?([\s\S]*?)(?=(?:\n\s*\n|$))/gim,
    (_, type, body) => {
      const t = type.toUpperCase();
      const isWarn = t === 'WARNING' || t === 'CAUTION';
      const isTip = t === 'TIP' || t === 'NOTE';
      const borderColor = isWarn
        ? 'border-amber-500/50 bg-amber-500/10 text-amber-100'
        : isTip
        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100'
        : 'border-blue-500/50 bg-blue-500/10 text-blue-100';
      const badgeColor = isWarn
        ? 'text-amber-400 bg-amber-500/20'
        : isTip
        ? 'text-emerald-400 bg-emerald-500/20'
        : 'text-blue-400 bg-blue-500/20';
      const icon = isWarn ? '⚠️' : isTip ? '💡' : '📌';
      const title = isWarn ? "PIÈGE D'EXAMEN" : isTip ? 'POINT CLÉ' : 'IMPORTANT';
      const cleanBody = body.replace(/^>\s?/gm, '').trim();
      return `<div class="my-4 p-4 rounded-2xl border ${borderColor} space-y-2"><div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider ${badgeColor} font-mono">${icon} ${title}</div><div class="text-xs sm:text-sm leading-relaxed opacity-95">${cleanBody}</div></div>`;
    }
  );

  // Standard Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-2 border-accent-blue/60 pl-4 py-1 my-3 text-zinc-300 italic bg-surface-elevated/30 rounded-r">$1</blockquote>');

  // Bold and Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong class="font-bold text-zinc-100"><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold text-zinc-100">$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em class="italic text-zinc-300">$1</em>');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/gim, '<pre class="bg-surface-elevated p-4 rounded-xl text-xs font-mono text-zinc-200 overflow-x-auto border border-border my-4"><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/gim, '<code class="bg-surface-elevated text-accent-blue px-1.5 py-0.5 rounded text-xs font-mono border border-border-subtle">$1</code>');

  // Markdown tables: | A | B |\n|---|---|\n| C | D |
  html = html.replace(
    /((?:^\|[^\n]+\|\r?\n)+)/gm,
    (tableBlock) => {
      const lines = tableBlock.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return tableBlock;
      const headerLine = lines[0];
      const separatorLine = lines[1];
      if (!separatorLine.includes('-')) return tableBlock;
      const headers = headerLine.split('|').slice(1, -1).map((h) => h.trim());
      const bodyLines = lines.slice(2);
      let tableHtml = '<div class="my-4 overflow-x-auto rounded-2xl border border-border bg-surface-elevated/40"><table class="w-full text-left text-xs border-collapse">';
      tableHtml += '<thead><tr class="border-b border-border bg-surface-elevated text-zinc-200 font-bold">';
      headers.forEach((h) => {
        tableHtml += `<th class="p-3.5 text-xs font-semibold text-zinc-200">${h}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';
      bodyLines.forEach((bLine, rowIdx) => {
        const cells = bLine.split('|').slice(1, -1).map((c) => c.trim());
        const bg = rowIdx % 2 === 0 ? 'bg-surface/40' : 'bg-surface-elevated/20';
        tableHtml += `<tr class="border-b border-border/40 hover:bg-surface-elevated/60 transition-colors ${bg}">`;
        cells.forEach((c) => {
          tableHtml += `<td class="p-3.5 text-xs text-zinc-300 leading-relaxed">${c}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table></div>';
      return tableHtml;
    }
  );

  // Unordered lists
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc text-zinc-300 leading-relaxed">$1</li>');
  html = html.replace(/^\s*\*\s+(.*$)/gim, '<li class="ml-4 list-disc text-zinc-300 leading-relaxed">$1</li>');

  // Ordered lists
  html = html.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="ml-4 list-decimal text-zinc-300 leading-relaxed">$2</li>');

  // Wrap list items
  html = html.replace(/((?:<li class="ml-4 list-disc[^"]*">.*?<\/li>\n?)+)/g, '<ul class="space-y-1 my-3 pl-2">$1</ul>');
  html = html.replace(/((?:<li class="ml-4 list-decimal[^"]*">.*?<\/li>\n?)+)/g, '<ol class="space-y-1 my-3 pl-2">$1</ol>');

  // Paragraphs
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h1') ||
        trimmed.startsWith('<h2') ||
        trimmed.startsWith('<h3') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<pre') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<div') ||
        trimmed.startsWith('<table')
      ) {
        return trimmed;
      }
      return `<p class="text-sm text-zinc-300 leading-relaxed my-2.5">${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  return html;
}
