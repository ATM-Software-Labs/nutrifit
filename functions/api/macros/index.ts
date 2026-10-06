import { error } from '../../utils/response'
import type { Env } from '../../utils/env'

/** /api/macros — objetivos y cálculo de macros (Fase posterior: D1 + IA). */
export const onRequest: PagesFunction<Env> = async () => error(501, 'No implementado todavía')
