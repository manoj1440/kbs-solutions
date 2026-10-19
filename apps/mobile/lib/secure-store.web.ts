/**
 * F-818: Expo-web preview only (screenshots at 390×844) — `expo-secure-store` has no web implementation. The product
 * ships Android only (REQ-02); this file is never bundled into the APK.
 */
export async function getItemAsync(key: string): Promise<string | null> {
  return globalThis.localStorage?.getItem(key) ?? null;
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  globalThis.localStorage?.setItem(key, value);
}
export async function deleteItemAsync(key: string): Promise<void> {
  globalThis.localStorage?.removeItem(key);
}
