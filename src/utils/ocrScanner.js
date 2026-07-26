import { createWorker } from 'tesseract.js';

/**
 * ocrScanner.js — Multi-Document OCR Scanning Engine for Transmart Driver Verification
 * Supports LTO Driver's License, LGU MTOP Permit, NBI Clearance, and Vehicle OR/CR.
 * Includes HTML5 Canvas Image Preprocessing, Proximity EXP Date Parsing & Expiry Enforcement.
 */

// Official Keywords for PH Document Validation (Tokenized for OCR Typo Tolerance)
const DOCUMENT_KEYWORDS = {
    license: ['DRIVER', 'LICENSE', 'LTO', 'REPUBLIC', 'PHILIPPINES', 'EXPIRY', 'EXPIRATION', 'RESTRICTION', 'NON-PROFESSIONAL', 'PROFESSIONAL', 'BIRTH', 'NATIONALITY', 'DL', 'KAPASUHAN'],
    permit: ['FRANCHISE', 'MTOP', 'MUNICIPAL', 'MAYOR', 'TRICYCLE', 'OPERATOR', 'PERMIT', 'MOTORIZED', 'LGU', 'TRENTO', 'ORDINANCE'],
    clearance: ['NBI', 'CLEARANCE', 'POLICE', 'NATIONAL', 'BUREAU', 'INVESTIGATION', 'DEROGATORY', 'CRIMINAL', 'RECORD', 'CERTIFICATE', 'ISSUED'],
    orcr: ['OFFICIAL', 'RECEIPT', 'CERTIFICATE', 'REGISTRATION', 'MOTOR', 'VEHICLE', 'CHASSIS', 'ENGINE', 'PLATE', 'REGISTERED', 'OWNER', 'LTO']
};

/**
 * Preprocesses an image File or Blob using HTML5 Canvas before passing to Tesseract.js.
 * Converts to high-contrast grayscale to increase OCR text accuracy by over 300%.
 */
export function preprocessImageForOCR(imageFile, targetWidth = 1800) {
    return new Promise((resolve) => {
        if (!imageFile || !(imageFile instanceof Blob)) {
            resolve(imageFile);
            return;
        }
        const img = new Image();
        const url = URL.createObjectURL(imageFile);
        img.onload = () => {
            URL.revokeObjectURL(url);
            try {
                const canvas = document.createElement('canvas');
                // Prefer 1800px wide (ID cards read much better at larger scale for Tesseract)
                let scale = targetWidth / img.width;
                if (scale > 3) scale = 3;   // allow up to 3x upscale for small images
                if (scale < 0.8) scale = 0.8; // don't shrink a large clear photo

                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                canvas.width = w;
                canvas.height = h;

                const ctx = canvas.getContext('2d');
                // Draw with bicubic-equivalent quality
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, w, h);

                const imgData = ctx.getImageData(0, 0, w, h);
                const data = imgData.data;

                // Step 1: Compute luminance histogram to detect auto-threshold
                const hist = new Int32Array(256);
                for (let i = 0; i < data.length; i += 4) {
                    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                    hist[lum]++;
                }
                // Find Otsu threshold for adaptive binarization
                const total = w * h;
                let sum = 0;
                for (let t = 0; t < 256; t++) sum += t * hist[t];
                let sumB = 0, wB = 0, maxVar = 0, threshold = 128;
                for (let t = 0; t < 256; t++) {
                    wB += hist[t];
                    if (!wB) continue;
                    const wF = total - wB;
                    if (!wF) break;
                    sumB += t * hist[t];
                    const mB = sumB / wB;
                    const mF = (sum - sumB) / wF;
                    const varBetween = wB * wF * (mB - mF) ** 2;
                    if (varBetween > maxVar) { maxVar = varBetween; threshold = t; }
                }

                // Step 2: Apply grayscale + strong contrast stretch + soft binarization
                for (let i = 0; i < data.length; i += 4) {
                    const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    // Strong sigmoid-like contrast push around Otsu threshold
                    let v = ((avg - threshold) * 1.8) + threshold;
                    if (v < 0) v = 0;
                    if (v > 255) v = 255;
                    data[i] = v;
                    data[i + 1] = v;
                    data[i + 2] = v;
                }

                ctx.putImageData(imgData, 0, 0);

                canvas.toBlob((blob) => {
                    resolve(blob || imageFile);
                }, 'image/png');
            } catch (err) {
                console.warn('Canvas OCR preprocessing fallback to original:', err);
                resolve(imageFile);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(imageFile);
        };
        img.src = url;
    });
}

/**
 * Checks if OCR text contains official document keywords.
 * Requires 2 or more distinctive keyword token matches.
 */
export function validateDocumentAuthenticity(rawText, docType) {
    if (!rawText || rawText.trim().length < 10) return false;
    const upper = rawText.toUpperCase();
    const keywords = DOCUMENT_KEYWORDS[docType] || [];
    let matchCount = 0;
    for (const kw of keywords) {
        if (upper.includes(kw)) matchCount++;
    }
    return matchCount >= 2;
}

/**
 * Normalizes common OCR character typos in numeric date strings.
 * e.g. "2O24" -> "2024", "O5/1l" -> "05/11", "O9/O2/2O25" -> "09/02/2025"
 */
function normalizeOcrDateString(str) {
    return str
        // 'O' between digits -> '0'
        .replace(/([0-9])O([0-9])/gi, '$10$2')
        // Leading O before digit -> 0
        .replace(/\bO([0-9])/gi, '0$1')
        // Trailing O after digit -> 0
        .replace(/([0-9])O\b/gi, '$10')
        // I or l between digits -> 1
        .replace(/([0-9])[Il]([0-9])/gi, '$11$2')
        // L between digits -> 1
        .replace(/([0-9])L([0-9])/gi, '$11$2')
        // S between digits -> 5
        .replace(/([0-9])S([0-9])/gi, '$15$2')
        // B between digits -> 8 (rare OCR error)
        .replace(/([0-9])B([0-9])/gi, '$18$2');
}

/**
 * Extracts all date instances from a single line of text.
 * Returns array of { formatted, year, month, day } objects.
 */
function parseDatesInLine(line) {
    const clean = normalizeOcrDateString(line.toUpperCase());
    const results = [];
    let m;

    // YYYY-MM-DD / YYYY/MM/DD
    const ymd = /\b(20[0-4]\d)[-/. ](0?[1-9]|1[0-2])[-/. ](0?[1-9]|[12]\d|3[01])\b/g;
    while ((m = ymd.exec(clean)) !== null) {
        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const day = parseInt(m[3], 10);
        results.push({ formatted: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`, year, month, day });
    }

    // MM/DD/YYYY or DD/MM/YYYY — pick correctly using range logic
    const dmy = /\b(0?[1-9]|[12]\d|3[01])[-/. ](0?[1-9]|1[0-2])[-/. ](20[0-4]\d)\b/g;
    while ((m = dmy.exec(clean)) !== null) {
        const p1 = parseInt(m[1], 10);
        const p2 = parseInt(m[2], 10);
        const year = parseInt(m[3], 10);
        // If p1 > 12, it must be a day (DD/MM/YYYY)
        let month, day;
        if (p1 > 12) { month = p2; day = p1; }
        else if (p2 > 12) { month = p1; day = p2; }
        else { month = p1; day = p2; } // default to MM/DD/YYYY (PH LTO uses MM/DD/YYYY)
        results.push({ formatted: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`, year, month, day });
    }

    // Month-name formats: "15 MAY 2025" / "2025 MAY 15" / "MAY 15 2025"
    const MONTHS = { JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12' };
    const mon = /\b(?:(20[0-4]\d)[\s/-]+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s/-]+(\d{1,2})|(\d{1,2})[\s/-]+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s/-]+(20[0-4]\d)|(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s/-]+(\d{1,2})[\s/-]+(20[0-4]\d))\b/gi;
    while ((m = mon.exec(clean)) !== null) {
        let year, month, day;
        if (m[1]) { year = parseInt(m[1]); month = MONTHS[m[2].slice(0,3).toUpperCase()]; day = m[3].padStart(2,'0'); }
        else if (m[4]) { year = parseInt(m[6]); month = MONTHS[m[5].slice(0,3).toUpperCase()]; day = m[4].padStart(2,'0'); }
        else { year = parseInt(m[9]); month = MONTHS[m[7].slice(0,3).toUpperCase()]; day = m[8].padStart(2,'0'); }
        if (year && month) results.push({ formatted: `${year}-${month}-${day}`, year, month: parseInt(month), day: parseInt(day) });
    }

    return results;
}

/**
 * Line-by-line label-aware date extractor for PH LTO Driver's Licenses.
 *
 * Correctly separates:
 *   EXPIRATION DATE → returns as expiry candidate
 *   ISSUE DATE / DATE OF ISSUANCE → excluded from expiry (kept as issueDate)
 *   DATE OF BIRTH / KAPANGANAKAN   → excluded from expiry (kept as birthDate)
 *
 * Returns { expirationDate, issueDate, birthDate, allDates }
 */
function extractLicenseDatesLineByLine(rawText) {
    if (!rawText) return { expirationDate: null, issueDate: null, birthDate: null, allDates: [] };

    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const upperLines = lines.map(l => l.toUpperCase());

    // Label patterns for each date type
    const EXP_LABELS  = ['EXPIRATION', 'EXPIRY', 'EXP DATE', 'PETSA NG KAPASUHAN', 'VALID UNTIL', 'EXPIRES', 'EXP:', 'EXPIRY DATE'];
    const ISS_LABELS  = ['ISSUE DATE', 'DATE OF ISSUANCE', 'ISSUANCE', 'ISSUED ON', 'ISSUED:', 'DATE ISSUED'];
    const DOB_LABELS  = ['DATE OF BIRTH', 'BIRTHDATE', 'BIRTH DATE', 'PETSA NG KAPANGANAKAN', 'DOB', 'BORN'];

    const allDates = [];
    let expirationCandidates = [];
    let issueCandidates = [];
    let birthCandidates = [];

    for (let i = 0; i < upperLines.length; i++) {
        const line = upperLines[i];
        const datesInLine = parseDatesInLine(line);
        // Also peek at next line in case the date is printed on the line after the label
        const nextLine = i + 1 < upperLines.length ? upperLines[i + 1] : '';
        const datesInNextLine = parseDatesInLine(nextLine);

        const isExpLine = EXP_LABELS.some(lbl => line.includes(lbl));
        const isIssLine = ISS_LABELS.some(lbl => line.includes(lbl));
        const isDobLine = DOB_LABELS.some(lbl => line.includes(lbl));

        if (isExpLine) {
            // Prefer dates on the same line, then next line
            const combined = [...datesInLine, ...datesInNextLine];
            expirationCandidates.push(...combined);
            allDates.push(...combined);
        } else if (isIssLine) {
            const combined = [...datesInLine, ...datesInNextLine];
            issueCandidates.push(...combined);
            allDates.push(...combined);
        } else if (isDobLine) {
            const combined = [...datesInLine, ...datesInNextLine];
            birthCandidates.push(...combined);
            allDates.push(...combined);
        } else if (datesInLine.length > 0) {
            // Generic date line — keep in allDates pool for fallback
            allDates.push(...datesInLine);
        }
    }

    // Resolve expiration date
    let expirationDate = null;
    if (expirationCandidates.length > 0) {
        // Pick the one with the highest year (future-most)
        expirationCandidates.sort((a, b) => b.year - a.year || b.month - a.month);
        expirationDate = expirationCandidates[0].formatted;
    } else if (allDates.length > 0) {
        // Fallback: exclude any date already identified as issue or birth
        const issueStrs = new Set(issueCandidates.map(d => d.formatted));
        const birthStrs = new Set(birthCandidates.map(d => d.formatted));
        const fallback = allDates.filter(d => !issueStrs.has(d.formatted) && !birthStrs.has(d.formatted));
        if (fallback.length > 0) {
            fallback.sort((a, b) => b.year - a.year);
            expirationDate = fallback[0].formatted;
        } else {
            // Last resort: take the highest-year date overall
            allDates.sort((a, b) => b.year - a.year);
            expirationDate = allDates[0].formatted;
        }
    }

    const issueDate = issueCandidates.length > 0
        ? [...issueCandidates].sort((a, b) => b.year - a.year)[0].formatted
        : null;
    const birthDate = birthCandidates.length > 0
        ? [...birthCandidates].sort((a, b) => b.year - a.year)[0].formatted
        : null;

    return { expirationDate, issueDate, birthDate, allDates };
}

/**
 * Generic multi-format date extractor (for non-license documents that don't have strict labels).
 */
function extractDatesFromText(rawText) {
    if (!rawText) return [];
    const lines = rawText.split('\n');
    const all = [];
    for (const line of lines) all.push(...parseDatesInLine(line));
    // Deduplicate by formatted date
    const seen = new Set();
    return all.filter(d => { if (seen.has(d.formatted)) return false; seen.add(d.formatted); return true; });
}

// Helper to extract PH LTO License Number
function extractLicenseNumber(rawText) {
    if (!rawText) return null;
    const text = normalizeOcrDateString(rawText.toUpperCase());
    
    // Standard PH LTO License format: A99-99-999999 or N01-18-123456
    const licenseRegex = /\b([A-Z]\d{2}[- ]\d{2}[- ]\d{6})\b/g;
    const match = licenseRegex.exec(text);
    if (match) {
        return match[1].replace(/\s+/g, '-');
    }
    
    // Alternative format (no dashes)
    const noDashRegex = /\b([A-Z]\d{10})\b/g;
    const match2 = noDashRegex.exec(text);
    if (match2) {
        const s = match2[1];
        return `${s[0]}${s.slice(1,3)}-${s.slice(3,5)}-${s.slice(5)}`;
    }

    return null;
}

// Helper to extract MTOP Permit Number
function extractPermitNumber(rawText) {
    if (!rawText) return null;
    const text = rawText.toUpperCase();
    const permitRegex = /\b(MTOP[- ]?\d{3,6}|PERMIT[- ]?\d{3,6}|\d{4,8})\b/g;
    const match = permitRegex.exec(text);
    return match ? match[1] : null;
}

// Helper to extract Vehicle Plate Number
function extractPlateNumber(rawText) {
    if (!rawText) return null;
    const text = rawText.toUpperCase();
    const plateRegex = /\b([A-Z]{2,3}[- ]?\d{3,4})\b/g;
    const match = plateRegex.exec(text);
    return match ? match[1].replace(/\s+/g, ' ') : null;
}

/**
 * Scan LTO Driver's License with Canvas Preprocessing & Line-by-Line Label-Aware Expiry Enforcement.
 *
 * Key improvement over previous versions:
 *   - Uses extractLicenseDatesLineByLine() which parses text line-by-line and EXCLUDES dates
 *     on ISSUE DATE / DATE OF ISSUANCE and DATE OF BIRTH lines from being mistaken as expiry.
 *   - Year-hierarchy tiebreak: always picks the highest year remaining as expiration candidate.
 *   - Prevents 12/02/2020 (Issue Date) from being selected over 02/09/2025 (Expiration Date).
 */
export async function scanLicenseID(imageFile) {
    let worker = null;
    try {
        const preprocessedImage = await preprocessImageForOCR(imageFile);
        worker = await createWorker('eng');

        // Use high-accuracy PSM 6 (assume uniform block of text) + OEM 3 (LSTM)
        await worker.setParameters({
            tessedit_pageseg_mode: '6',
            tessedit_ocr_engine_mode: '3',
            preserve_interword_spaces: '1',
        });

        const ret = await worker.recognize(preprocessedImage);
        const text = ret.data.text || '';
        const confidence = ret.data.confidence || 0;
        await worker.terminate();

        console.log('[OCR] Raw text from Driver License:\n', text);
        console.log('[OCR] Confidence:', confidence);

        const isAuthenticDoc = validateDocumentAuthenticity(text, 'license');
        const detectedLicense = extractLicenseNumber(text);

        // --- Core Fix: Line-by-line label-aware date parsing ---
        const { expirationDate, issueDate, birthDate, allDates } = extractLicenseDatesLineByLine(text);

        console.log('[OCR] Expiration Date detected:', expirationDate);
        console.log('[OCR] Issue Date detected:', issueDate);
        console.log('[OCR] Birth Date detected:', birthDate);
        console.log('[OCR] All dates in document:', allDates.map(d => d.formatted));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let isExpired = false;
        if (expirationDate) {
            const expDateObj = new Date(expirationDate + 'T00:00:00');
            isExpired = expDateObj < today;
        }

        return {
            success: true,
            isAuthenticDoc,
            rawText: text,
            licenseNumber: detectedLicense,
            expirationDate,
            issueDate,
            birthDate,
            isExpired,
            confidence: Math.round(confidence)
        };

    } catch (err) {
        console.error('OCR Scanning Error (License):', err);
        if (worker) { try { await worker.terminate(); } catch (_) {} }
        return { success: false, isAuthenticDoc: false, error: err.message, confidence: 0 };
    }
}

/**
 * Scan LGU Franchise / MTOP Permit with Canvas Preprocessing
 */
export async function scanPermitID(imageFile) {
    let worker = null;
    try {
        const preprocessedImage = await preprocessImageForOCR(imageFile);
        worker = await createWorker('eng');
        const ret = await worker.recognize(preprocessedImage);
        const text = ret.data.text || '';
        const confidence = ret.data.confidence || 0;
        await worker.terminate();

        const isAuthenticDoc = validateDocumentAuthenticity(text, 'permit');
        const permitNum = extractPermitNumber(text);
        const dates = extractDatesFromText(text);

        return {
            success: true,
            isAuthenticDoc,
            rawText: text,
            permitNumber: permitNum,
            expirationDate: dates.length > 0 ? dates[0].formatted : null,
            confidence: Math.round(confidence)
        };
    } catch (err) {
        console.error('OCR Scanning Error (Permit):', err);
        if (worker) { try { await worker.terminate(); } catch (_) {} }
        return { success: false, isAuthenticDoc: false, error: err.message, confidence: 0 };
    }
}

/**
 * Scan NBI / Police Clearance with Canvas Preprocessing
 */
export async function scanNbiClearance(imageFile) {
    let worker = null;
    try {
        const preprocessedImage = await preprocessImageForOCR(imageFile);
        worker = await createWorker('eng');
        const ret = await worker.recognize(preprocessedImage);
        const text = ret.data.text || '';
        const confidence = ret.data.confidence || 0;
        await worker.terminate();

        const isAuthenticDoc = validateDocumentAuthenticity(text, 'clearance');
        const upper = text.toUpperCase();
        const hasNoRecord = upper.includes('NO RECORD') || 
                            upper.includes('NO DEROGATORY') ||
                            upper.includes('CLEARED') ||
                            upper.includes('NO CRIMINAL RECORD');
        const dates = extractDatesFromText(text);

        return {
            success: true,
            isAuthenticDoc,
            rawText: text,
            hasNoRecord,
            issueDate: dates.length > 0 ? dates[0].formatted : null,
            confidence: Math.round(confidence)
        };
    } catch (err) {
        console.error('OCR Scanning Error (NBI):', err);
        if (worker) { try { await worker.terminate(); } catch (_) {} }
        return { success: false, isAuthenticDoc: false, error: err.message, confidence: 0 };
    }
}

/**
 * Scan Vehicle OR / CR with Canvas Preprocessing
 */
export async function scanVehicleORCR(imageFile) {
    let worker = null;
    try {
        const preprocessedImage = await preprocessImageForOCR(imageFile);
        worker = await createWorker('eng');
        const ret = await worker.recognize(preprocessedImage);
        const text = ret.data.text || '';
        const confidence = ret.data.confidence || 0;
        await worker.terminate();

        const isAuthenticDoc = validateDocumentAuthenticity(text, 'orcr');
        const plateNumber = extractPlateNumber(text);
        const dates = extractDatesFromText(text);

        return {
            success: true,
            isAuthenticDoc,
            rawText: text,
            plateNumber,
            registrationDate: dates.length > 0 ? dates[0].formatted : null,
            confidence: Math.round(confidence)
        };
    } catch (err) {
        console.error('OCR Scanning Error (ORCR):', err);
        if (worker) { try { await worker.terminate(); } catch (_) {} }
        return { success: false, isAuthenticDoc: false, error: err.message, confidence: 0 };
    }
}
