import type { Handler } from '../../utils/env.ts'
import { json } from '../../utils/response.ts'
import { exigirIdentidad } from '../../utils/identidad.ts'
import { exigirLimite } from '../../utils/rateLimit.ts'
import { leerImagenSubida } from '../../utils/imagenSubida.ts'
import { cadenaVision } from '../../utils/ia.ts'

export const onRequestPost: Handler = async ({ request, env, data }) => {
  const sesion = await exigirIdentidad(env, data.sesion)
  await exigirLimite(env, `foto:bf:${sesion.usuarioId}`, 10, 3600, 'Demasiadas estimaciones. Espera un rato.')
  
  const imagen = await leerImagenSubida(request)

  try {
    const { resultado } = await cadenaVision(env, imagen, {
      sistema: `Eres un experto en fitness y antropometría. Estima el porcentaje de grasa corporal (body fat) de la persona en la foto.
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional: {"bf": number}
Reglas:
- Si no se ve una persona o la calidad es mala, devuelve {"bf": null}.
- Analiza la definición muscular, vascularidad y proporciones.
- El valor debe ser un número entre 3 y 60.`,
      usuario: 'Estima el porcentaje de grasa corporal y devuelve el JSON.',
      parsear: (texto) => {
        const t = typeof texto === 'string' ? texto : JSON.stringify(texto)
        const match = t.match(/"bf"\s*:\s*([\d.]+)/)
        if (match) return { bf: parseFloat(match[1]) }
        return { bf: null }
      },
      maxTokens: 50,
    })

    return json({ bf: resultado.bf }, { status: 200 })
  } catch (e: any) {
    return Response.json({ error: e.message || 'Error al procesar' }, { status: 500 })
  }
}
