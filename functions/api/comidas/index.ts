import { error } from '../../utils/response'
import type { Env } from '../../utils/env'

/** /api/comidas — registro de comidas (Fase posterior: D1). */
export const onRequest: PagesFunction<Env> = async () => error(501, 'No implementado todavía')
