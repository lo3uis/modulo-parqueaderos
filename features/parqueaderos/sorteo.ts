export type TipoVehiculo = "A" | "M"

export type Participante = {
  id: number
  tipoVehiculo: TipoVehiculo
}

export type Espacio = {
  id: number
  tipoVehiculo: TipoVehiculo
}

export type AsignacionSorteo = {
  participanteId: number
  espacioId: number
}

export function ejecutarSorteo(
  participantes: Participante[],
  espacios: Espacio[],
  tipo: TipoVehiculo
): AsignacionSorteo[] {
  const participantesFiltrados = participantes.filter(
    (participante) => participante.tipoVehiculo === tipo
  )

  const espaciosFiltrados = espacios.filter(
    (espacio) => espacio.tipoVehiculo === tipo
  )

  const participantesMezclados = [...participantesFiltrados].sort(
    () => Math.random() - 0.5
  )

  const asignaciones: AsignacionSorteo[] = []

  for (
  let indice = 0;
  indice < participantesMezclados.length &&
  indice < espaciosFiltrados.length;
  indice++
) {
  asignaciones.push({
    participanteId: participantesMezclados[indice].id,
    espacioId: espaciosFiltrados[indice].id,
  })
}
  return asignaciones
}