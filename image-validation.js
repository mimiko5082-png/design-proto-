export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_AI_IMAGE_BYTES = 256 * 1024;
export const MAX_IMAGE_PIXELS = 20_000_000;
export const MAX_PROMPT_LENGTH = 1000;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validatePrompt(value) {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_PROMPT_LENGTH) {
    throw new Error("説明文は1〜1000文字で入力してください。");
  }
  return value.trim();
}

export function validateFile(file) {
  if (!file || !IMAGE_TYPES.includes(file.type)) throw new Error("JPEG・PNG・WebPの画像を選んでください。");
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error("画像は4MiB以下にしてください。");
}

// Read dimensions without decoding a potentially enormous bitmap.
export function validateImage(bytes, type, maxBytes = MAX_IMAGE_BYTES) {
  if (!IMAGE_TYPES.includes(type)) throw new Error("JPEG・PNG・WebPの画像を選んでください。");
  if (!bytes.length || bytes.length > maxBytes) throw new Error("画像のサイズが上限を超えています。");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length));
  let width = 0, height = 0;
  if (type === "image/png" && bytes.length >= 33 &&
      ascii(0, 8) === "\x89PNG\r\n\x1a\n" && view.getUint32(8) === 13 && ascii(12, 4) === "IHDR") {
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
      }
      offset += length;
    }
  } else if (type === "image/webp" && bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const u24 = i => bytes[i] + bytes[i + 1] * 256 + bytes[i + 2] * 65536;
    if (ascii(12, 4) === "VP8X") { width = 1 + u24(24); height = 1 + u24(27); }
    else if (ascii(12, 4) === "VP8 " && ascii(23, 3) === "\x9d\x01\x2a") {
      width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff;
    } else if (ascii(12, 4) === "VP8L" && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
    }
  }
  if (!width || !height) throw new Error("画像形式と内容が一致しないか、画像が破損しています。");
  if (width * height > MAX_IMAGE_PIXELS || width > 10000 || height > 10000) throw new Error("画像は2000万画素以下、各辺10000px以下にしてください。");
  return { width, height };
}

export function decodeImageData(value, maxBytes = MAX_IMAGE_BYTES) {
  if (typeof value !== "string" || value.length > Math.ceil(maxBytes / 3) * 4 + 64) throw new Error("画像データが大きすぎます。");
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) throw new Error("画像データの形式が不正です。");
  let bytes;
  if (typeof Uint8Array.fromBase64 === "function") bytes = Uint8Array.fromBase64(match[2]);
  else {
    const binary = atob(match[2]);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  }
  validateImage(bytes, match[1], maxBytes);
  return { bytes, type: match[1] };
}
