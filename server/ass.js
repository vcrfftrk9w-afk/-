/**
 * Текстовые плашки рендерятся через libass: в этой сборке ffmpeg нет drawtext,
 * зато ass/subtitles есть — и он лучше справляется с кириллицей, обводкой,
 * переносами и анимацией появления.
 */

const POSITIONS = {
  top: 8,
  'top-left': 7,
  'top-right': 9,
  center: 5,
  'center-left': 4,
  'center-right': 6,
  bottom: 2,
  'bottom-left': 1,
  'bottom-right': 3,
};

export const TEXT_POSITIONS = Object.keys(POSITIONS);
export const TEXT_ANIMATIONS = ['none', 'fade', 'pop', 'slide-up', 'typewriter'];

const DEFAULT_FONT = process.env.CAPTION_FONT || 'DejaVu Sans';

/** #RRGGBB -> &HAABBGGRR (в ASS порядок байт обратный, а alpha — прозрачность). */
export function toAssColor(hex, alpha = 0) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  const rgb = m ? m[1] : 'ffffff';
  const r = rgb.slice(0, 2);
  const g = rgb.slice(2, 4);
  const b = rgb.slice(4, 6);
  const a = Math.round(Math.min(255, Math.max(0, alpha))).toString(16).padStart(2, '0');
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

/** Секунды -> 0:00:00.00 (ASS хранит сотые доли). */
export function toAssTime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const cs = Math.round((total - Math.floor(total)) * 100);
  const carry = cs === 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(carry ? s + 1 : s).padStart(2, '0')}.${String(carry ? 0 : cs).padStart(2, '0')}`;
}

/** Текст пользователя не должен превращаться в ASS-разметку. */
function escapeText(raw) {
  return String(raw ?? '')
    .replace(/\\/g, '∖')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .replace(/\r\n|\r|\n/g, '\\N');
}

/**
 * Якорь строки в кадре. Нужен анимациям, которые двигают текст:
 * \move работает в абсолютных координатах, а точкой привязки служит
 * тот же угол, что задан выравниванием стиля.
 */
function anchorPoint(overlay, frame, marginV) {
  const marginH = Math.round(frame.width * 0.06);
  const pos = String(overlay.position || 'bottom');
  const x = pos.endsWith('-left')
    ? marginH
    : pos.endsWith('-right')
      ? frame.width - marginH
      : Math.round(frame.width / 2);
  const y = pos.startsWith('top')
    ? marginV
    : pos.startsWith('center')
      ? Math.round(frame.height / 2)
      : frame.height - marginV;
  return { x, y };
}

/** Посимвольное проявление: каждый символ включается своим \t. */
function typewriterBody(text, durationMs) {
  const chars = [...String(text)];
  const visibleCount = Math.max(1, chars.filter((c) => c.trim()).length);
  const step = Math.max(20, Math.min(120, Math.round((durationMs * 0.6) / visibleCount)));
  let elapsed = 0;
  let out = '';
  for (const char of chars) {
    if (char === '\n' || char === '\r') { out += '\\N'; continue; }
    const at = elapsed;
    out += `{\\alpha&HFF&\\t(${at},${at + 1},\\alpha&H00&)}${escapeChar(char)}`;
    if (char.trim()) elapsed += step;
  }
  return out;
}

function escapeChar(char) {
  if (char === '{') return '(';
  if (char === '}') return ')';
  if (char === '\\') return '\u2216';
  return char;
}

function animationTag(overlay, frame, marginV) {
  const durationMs = Math.round(Math.max(0.2, (overlay.end - overlay.start) || 1) * 1000);
  const { x, y } = anchorPoint(overlay, frame, marginV);
  const shift = Math.max(24, Math.round(frame.height * 0.04));

  switch (overlay.animation) {
    case 'pop':
      return '{\\fad(0,120)\\fscx60\\fscy60\\t(0,220,\\fscx100\\fscy100)}';
    case 'slide-up':
      return `{\\fad(150,150)\\move(${x},${y + shift},${x},${y},0,320)}`;
    case 'typewriter':
      return `{\\fad(60,${Math.min(200, durationMs / 4)})}`;
    case 'none':
      return '';
    case 'fade':
    default:
      return '{\\fad(200,200)}';
  }
}

/**
 * Собирает .ass-файл для набора плашек.
 * @param {Array} overlays - {text, start, end, position, size, color, outlineColor, bold, animation}
 * @param {{width:number,height:number}} frame
 */
export function buildAss(overlays, frame) {
  const list = (overlays || []).filter((o) => String(o?.text || '').trim());
  const styles = new Map();
  const events = [];

  for (const [index, overlay] of list.entries()) {
    const size = Math.round(Number(overlay.size) || Math.round(frame.height * 0.045));
    const color = toAssColor(overlay.color || '#FFFFFF');
    const outlineColor = toAssColor(overlay.outlineColor || '#000000');
    const bold = overlay.bold === false ? 0 : -1;
    const align = POSITIONS[overlay.position] ?? POSITIONS.bottom;
    const outline = Math.max(0, Number(overlay.outline ?? Math.max(2, Math.round(size / 18))));
    const marginV = Math.round(Number(overlay.marginV ?? frame.height * 0.07));
    const marginH = Math.round(frame.width * 0.06);

    const key = [size, color, outlineColor, bold, align, outline, marginV].join('|');
    if (!styles.has(key)) {
      styles.set(key, {
        name: `s${styles.size}`,
        line: [
          `s${styles.size}`,
          overlay.font || DEFAULT_FONT,
          size,
          color,
          color,
          outlineColor,
          '&H96000000',
          bold,
          0, 0, 0,
          100, 100, 0, 0,
          1,                                  // BorderStyle: обводка
          outline.toFixed(1),
          Math.max(0, Number(overlay.shadow ?? 1)).toFixed(1),
          align,
          marginH, marginH, marginV,
          1,
        ].join(','),
      });
    }

    const style = styles.get(key);
    const start = Math.max(0, Number(overlay.start) || 0);
    const end = Math.max(start + 0.2, Number(overlay.end) || start + 2);
    const durationMs = Math.round(Math.max(0.2, end - start) * 1000);
    const body = overlay.animation === 'typewriter'
      ? typewriterBody(overlay.text, durationMs)
      : escapeText(overlay.text);
    events.push(
      `Dialogue: ${index},${toAssTime(start)},${toAssTime(end)},${style.name},,0,0,0,,${animationTag(overlay, frame, marginV)}${body}`,
    );
  }

  if (!events.length) return null;

  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${frame.width}`,
    `PlayResY: ${frame.height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ...[...styles.values()].map((s) => `Style: ${s.line}`),
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}
