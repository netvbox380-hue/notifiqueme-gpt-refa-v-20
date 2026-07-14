function toBytes(value: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

/**
 * Compara a chave VAPID registrada na subscription com a chave pública atual.
 * Retorna `null` quando o navegador não expõe a chave, preservando a
 * compatibilidade com implementações antigas da Push API.
 */
export function compareApplicationServerKey(
  registeredKey: ArrayBuffer | ArrayBufferView | null | undefined,
  expectedKey: Uint8Array,
): boolean | null {
  if (!registeredKey) return null;

  const registeredBytes = toBytes(registeredKey);
  if (registeredBytes.byteLength !== expectedKey.byteLength) return false;

  for (let index = 0; index < registeredBytes.byteLength; index += 1) {
    if (registeredBytes[index] !== expectedKey[index]) return false;
  }

  return true;
}
