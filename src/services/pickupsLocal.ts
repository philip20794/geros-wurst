// src/services/pickupsLocal.ts
const KEY = 'wurst_pickups_v1'

type StoreShape = Record<string, Record<string, boolean>> // wurstId -> uid -> picked

function readAll(): StoreShape {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as StoreShape
  } catch {
    return {}
  }
}

function writeAll(data: StoreShape) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function getPickedMap(wurstId: string): Record<string, boolean> {
  const all = readAll()
  return all[wurstId] || {}
}

export function setPicked(wurstId: string, uid: string, picked: boolean) {
  const all = readAll()
  const map = all[wurstId] || {}
  if (picked) map[uid] = true
  else delete map[uid]
  all[wurstId] = map
  writeAll(all)
}
