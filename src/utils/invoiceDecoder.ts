export interface InvoiceItem {
  name: string;
  qty: string;
  price: string;
}

export interface ParsedLeftQR {
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  expectedTotalItems: number | null;
  items: InvoiceItem[];
  sellerId: string;
  buyerId: string;
  encodingType: 'big5' | 'utf-8' | 'base64' | 'unknown';
  raw: string;
}

export interface ParsedRightQR {
  items: InvoiceItem[];
  raw: string;
}

export interface RawQRResult {
  data: string;
  binaryData?: number[];
}

/**
 * Checks if a string represents a valid number (integer or float)
 */
export const isNumeric = (str: string | undefined): boolean => {
  if (!str || typeof str !== 'string') return false;
  return /^-?\d+(\.\d+)?$/.test(str.trim());
};

/**
 * Converts Taiwan ROC calendar date (e.g. 1150916) to ISO YYYY-MM-DD
 */
export const convertTaiwanDateToISO = (taiwanDate: string): string => {
  const clean = taiwanDate.trim();
  if (clean.length === 7) {
    const year = parseInt(clean.substring(0, 3), 10) + 1911;
    const month = clean.substring(3, 5);
    const day = clean.substring(5, 7);
    return `${year}-${month}-${day}`;
  }
  if (clean.length === 8 && (clean.startsWith('20') || clean.startsWith('19'))) {
    return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
  }
  return new Date().toISOString().split('T')[0];
};

/**
 * Cleans item name by removing leading sequence indicators with delimiters like "1. ", "01: "
 * without stripping numbers that are part of the brand name (e.g., "3M", "7-11").
 */
export const cleanItemName = (rawName: string): string => {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  // Strip item index if followed by clear delimiter like dot, colon, hyphen, or enumeration mark
  const stripped = trimmed.replace(/^0?\d+[\.\:、\s\-]+(.*)$/, '$1');
  return (stripped.trim() || trimmed).replace(/^:+/, '');
};

/**
 * Decodes Taiwan e-invoice raw QR payload bytes into text with full Big-5 and UTF-8 support.
 *
 * Taiwan E-Invoice QR standard (MOF):
 * Chinese encoding flag in Left QR:
 * 0 = Big5 (Traditional Chinese, CP950)
 * 1 = UTF-8
 * 2 = Base64
 */
export const decodeTaiwanInvoiceQR = (
  rawStr: string,
  binaryData?: number[] | Uint8Array,
  knownEncoding?: 'big5' | 'utf-8'
): string => {
  let bytes: Uint8Array | null = null;
  if (binaryData && binaryData.length > 0) {
    bytes = binaryData instanceof Uint8Array ? binaryData : new Uint8Array(binaryData);
  }

  // If no binary data provided, check if rawStr can be converted back to raw bytes (e.g. ISO-8859-1 / Latin-1)
  if (!bytes && rawStr) {
    // If rawStr has \ufffd, it was already irreparably converted to Unicode replacement char
    if (!rawStr.includes('\ufffd')) {
      const b = new Uint8Array(rawStr.length);
      let isLatin1 = true;
      let hasHighByte = false;
      for (let i = 0; i < rawStr.length; i++) {
        const code = rawStr.charCodeAt(i);
        if (code > 255) {
          isLatin1 = false;
          break;
        }
        b[i] = code;
        if (code >= 128) hasHighByte = true;
      }
      if (isLatin1 && hasHighByte) {
        bytes = b;
      }
    }
  }

  if (bytes && bytes.length > 0) {
    // 1. If knownEncoding was determined (e.g. from Left QR code)
    if (knownEncoding === 'big5') {
      try {
        const text = new TextDecoder('big5').decode(bytes);
        if (!text.includes('\ufffd')) return text;
      } catch {
        // fallback
      }
    } else if (knownEncoding === 'utf-8') {
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        // fallback
      }
    }

    // 2. Check if Left QR code (starts with 77 ASCII chars)
    if (bytes.length >= 77) {
      let isAsciiHeader = true;
      for (let i = 0; i < 77; i++) {
        if (bytes[i] < 32 || bytes[i] > 126) {
          isAsciiHeader = false;
          break;
        }
      }

      if (isAsciiHeader) {
        // Read header ASCII portion after 77 bytes to detect encoding flag
        let headerStr = '';
        for (let i = 77; i < Math.min(bytes.length, 140); i++) {
          const b = bytes[i];
          if (b >= 32 && b <= 126) {
            headerStr += String.fromCharCode(b);
          } else {
            break;
          }
        }

        // Header format after 77 bytes: [:info]:totalItems:totalQty:encoding:items...
        const tokens = headerStr.split(':').map((s) => s.trim()).filter(Boolean);
        if (tokens.length >= 4) {
          const encFlag = tokens[3];
          if (encFlag === '0') {
            try {
              const decodedBig5 = new TextDecoder('big5').decode(bytes);
              return decodedBig5;
            } catch {
              // fallback
            }
          } else if (encFlag === '1') {
            try {
              return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            } catch {
              // fallback
            }
          }
        }
      }
    }

    // 3. Try UTF-8 strict first
    try {
      const decodedUtf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return decodedUtf8;
    } catch {
      // 4. If invalid UTF-8 bytes, decode with Big-5
      try {
        const decodedBig5 = new TextDecoder('big5').decode(bytes);
        return decodedBig5;
      } catch {
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      }
    }
  }

  return rawStr || '';
};

/**
 * Parses Taiwan Left QR code
 */
export const parseLeftInvoiceQR = (
  rawStr: string,
  binaryData?: number[] | Uint8Array
): ParsedLeftQR | null => {
  const decoded = decodeTaiwanInvoiceQR(rawStr, binaryData);
  if (!decoded || decoded.length < 77 || decoded.startsWith('**')) {
    return null;
  }

  const invoiceNumber = decoded.substring(0, 10);
  const dateTaiwan = decoded.substring(10, 17);
  const totalAmountHex = decoded.substring(29, 37);
  const buyerId = decoded.substring(37, 45);
  const sellerId = decoded.substring(45, 53);

  const totalAmount = parseInt(totalAmountHex, 16);
  const date = convertTaiwanDateToISO(dateTaiwan);

  const fixedInfoLength = 77;
  let variableData = decoded.substring(fixedInfoLength);
  if (variableData.startsWith(':')) {
    variableData = variableData.substring(1);
  }

  const rawParts = variableData.split(':');
  let expectedTotalItems: number | null = null;
  let encodingType: 'big5' | 'utf-8' | 'base64' | 'unknown' = 'unknown';

  const headerTokens: string[] = [];
  let firstItemIdx = -1;

  for (let i = 1; i < rawParts.length; i++) {
    const token = rawParts[i].trim();
    if (!token) continue;
    // Check if we hit an item triple (name followed by two numbers)
    if (i < rawParts.length - 2 && isNumeric(rawParts[i + 1]) && isNumeric(rawParts[i + 2])) {
      // If token is just a 1 or 2 digit number at early positions, it belongs to the header flags
      if (/^\d{1,2}$/.test(token) && headerTokens.length < 3) {
        headerTokens.push(token);
        continue;
      }
      firstItemIdx = i;
      break;
    }
    headerTokens.push(token);
  }

  if (headerTokens.length >= 1 && /^\d+$/.test(headerTokens[0])) {
    expectedTotalItems = parseInt(headerTokens[0], 10);
  }
  if (headerTokens.length >= 3) {
    if (headerTokens[2] === '0') encodingType = 'big5';
    else if (headerTokens[2] === '1') encodingType = 'utf-8';
    else if (headerTokens[2] === '2') encodingType = 'base64';
  }

  const items: InvoiceItem[] = [];
  if (firstItemIdx !== -1) {
    for (let i = firstItemIdx; i + 2 < rawParts.length; i += 3) {
      const name = rawParts[i].trim();
      const qty = rawParts[i + 1].trim();
      const price = rawParts[i + 2].trim();
      if (name && isNumeric(qty) && isNumeric(price)) {
        items.push({
          name: cleanItemName(name),
          qty,
          price,
        });
      }
    }
  }

  return {
    invoiceNumber,
    date,
    totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
    expectedTotalItems,
    items,
    sellerId,
    buyerId,
    encodingType,
    raw: decoded,
  };
};

/**
 * Parses Taiwan Right QR code (starts with '**' and lists remaining items)
 */
export const parseRightInvoiceQR = (
  rawStr: string,
  binaryData?: number[] | Uint8Array,
  knownEncoding?: 'big5' | 'utf-8'
): ParsedRightQR | null => {
  const decoded = decodeTaiwanInvoiceQR(rawStr, binaryData, knownEncoding);
  if (!decoded || !decoded.startsWith('**')) {
    return null;
  }

  let content = decoded.replace(/^\*\*+/, '');
  if (content.startsWith(':')) {
    content = content.substring(1);
  }

  const parts = content.split(':').map((p) => p.trim()).filter((p) => p.length > 0);
  let startIdx = 0;
  if (
    parts.length >= 4 &&
    /^\d{1,2}$/.test(parts[0]) &&
    !isNumeric(parts[1]) &&
    isNumeric(parts[2]) &&
    isNumeric(parts[3])
  ) {
    startIdx = 1;
  }

  const items: InvoiceItem[] = [];
  for (let i = startIdx; i + 2 < parts.length; i += 3) {
    const rawName = parts[i];
    const qty = parts[i + 1];
    const price = parts[i + 2];
    if (rawName && isNumeric(qty) && isNumeric(price)) {
      items.push({
        name: cleanItemName(rawName),
        qty,
        price,
      });
    }
  }

  return {
    items,
    raw: decoded,
  };
};
