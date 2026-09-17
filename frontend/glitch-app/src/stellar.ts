import { getPublicKey, isConnected } from '@stellar/freighter-api'

export async function connectFreighter() {
  const connected = await isConnected()
  if (!connected) {
    throw new Error('Freighter wallet not detected')
  }
  return getPublicKey()
}
