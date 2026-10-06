/** Une clases condicionales: cx('a', cond && 'b') */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
