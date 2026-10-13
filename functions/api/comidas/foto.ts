/**
 * POST /api/comidas/foto — RETIRADO. Las fotos de comida no se guardan nunca:
 * se analizan en memoria y solo queda el emoji y los macros. Las versiones
 * antiguas de la app que aún llaman aquí reciben 410 y siguen sin foto.
 */
import type { Handler } from '../../utils/env.ts'
import { error } from '../../utils/response.ts'

export const onRequestPost: Handler = async () => error(410, 'Las fotos de comida ya no se guardan.', { codigo: 'fotos_retiradas' })
