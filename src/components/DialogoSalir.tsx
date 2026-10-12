import { useState } from 'react'
import { LogOut, MonitorSmartphone } from 'lucide-react'
import { Sheet } from './ui/Sheet.tsx'
import { Button } from './ui/Button.tsx'

/** Confirmación de cierre de sesión: solo este dispositivo o todos. */
export function DialogoSalir({ abierto, onClose, onSalir }: { abierto: boolean; onClose: () => void; onSalir: (todos: boolean) => Promise<void> | void }) {
  const [cargando, setCargando] = useState<null | 'uno' | 'todos'>(null)
  const ir = async (todos: boolean) => {
    setCargando(todos ? 'todos' : 'uno')
    try { await onSalir(todos) } finally { setCargando(null) }
  }
  return (
    <Sheet abierto={abierto} onClose={onClose} titulo="¿Cerrar sesión?" descripcion="Tus datos siguen guardados en tu cuenta. Podrás volver a entrar con tu correo." ancho="sm">
      <div className="flex flex-col gap-2.5 pb-2">
        <Button variant="danger" block icon={<LogOut size={16} />} loading={cargando === 'uno'} onClick={() => void ir(false)}>
          Cerrar sesión
        </Button>
        <Button variant="outline" block icon={<MonitorSmartphone size={16} />} loading={cargando === 'todos'} onClick={() => void ir(true)}>
          Cerrar sesión en todos los dispositivos
        </Button>
        <Button variant="ghost" block onClick={onClose}>Cancelar</Button>
      </div>
    </Sheet>
  )
}
