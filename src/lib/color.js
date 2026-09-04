// ════════════════════════════════════════════════════════════════
//  tint() — versão translúcida de uma cor de acento.
//
//  Antes o código concatenava alpha em hexadecimal (color + '1f'),
//  o que só funciona com literal #rrggbb. Como os acentos agora são
//  tokens de tema (var(--color-*)), a mistura precisa acontecer no
//  CSS — color-mix() faz isso e aceita tanto hex quanto var().
//
//  alpha: os mesmos 2 dígitos hex de antes ('1f'), ou um número 0–1.
// ════════════════════════════════════════════════════════════════
export function tint(color, alpha = '1f') {
    if (!color) return 'transparent';
    const a = typeof alpha === 'number' ? alpha : parseInt(alpha, 16) / 255;
    const pct = Math.round(Math.min(Math.max(a, 0), 1) * 1000) / 10;
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}
