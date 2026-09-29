const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ""
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/g, "").toUpperCase().replace(/\s/g, "")
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const char of clean) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) throw new Error("INVALID_TOTP_SECRET")
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(bytes)
}

function counterBytes(counter: number): ArrayBuffer {
  const out = new ArrayBuffer(8)
  const view = new DataView(out)
  const high = Math.floor(counter / 0x100000000)
  const low = counter >>> 0
  view.setUint32(0, high)
  view.setUint32(4, low)
  return out
}

async function codeFor(secret: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    (() => { const bytes = base32Decode(secret); const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes); return buffer })(),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  )
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes(counter)))
  const offset = signature[signature.length - 1] & 15
  const binary =
    ((signature[offset] & 127) << 24) |
    ((signature[offset + 1] & 255) << 16) |
    ((signature[offset + 2] & 255) << 8) |
    (signature[offset + 3] & 255)
  return String(binary % 1_000_000).padStart(6, "0")
}

export async function generateSecret(): Promise<string> {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return base32Encode(bytes)
}

export async function verifyTotp(secret: string, input: string, now = Date.now()): Promise<boolean> {
  const normalized = input.replace(/\s/g, "")
  if (!/^\d{6}$/.test(normalized)) return false
  const current = Math.floor(now / 1000 / 30)
  for (const offset of [-1, 0, 1]) {
    if ((await codeFor(secret, current + offset)) === normalized) return true
  }
  return false
}

export function otpUri(secret: string, email: string): string {
  const label = encodeURIComponent(`EVARA-LUX:${email}`)
  const issuer = encodeURIComponent("EVARA-LUX")
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}
