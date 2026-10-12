import type { Handler } from '../../../utils/env.ts'
import { completarMicrosoft } from '../../../utils/microsoftOAuth.ts'

export const onRequestGet: Handler = async ({ request, env }) => completarMicrosoft(env, request)
