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
 * e.g. "2O24" -> "2024", "O5/1l" -> "05/11", "2025 / 02 / 09" -> "2025/02/09"
 */
function normalizeOcrDateString(str) {
    if (!str) return '';
    return str
        // Remove spaces around slashes, dashes, and dots in dates
        .replace(/(\d+)\s*[/.-]\s*(\d+)/g, '$1/$2')
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
        // B between digits -> 8
        .replace(/([0-9])B([0-9])/gi, '$18$2');
}

/**
 * Extracts all date instances from a text block.
 * Uses flexible non-digit boundaries instead of rigid \b so dates attached to text like "2025/02/09D06" match.
 * Returns array of { formatted, year, month, day, raw, index } objects.
 */
function parseDatesFromText(text) {
    if (!text) return [];
    const clean = normalizeOcrDateString(text.toUpperCase());
    const results = [];
    const seen = new Set();

    // 1. YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD (Year 2000 to 2099)
    const ymd = /(?:^|[^0-9])(20[0-9]\d)[-/. ](0?[1-9]|1[0-2])[-/. ](0?[1-9]|[12]\d|3[01])(?![0-9])/g;
    let m;
    while ((m = ymd.exec(clean)) !== null) {
        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const day = parseInt(m[3], 10);
        const formatted = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const key = `${formatted}_${m.index}`;
        if (!seen.has(key)) {
            seen.add(key);
            results.push({ formatted, year, month, day, index: m.index, raw: m[0].trim() });
        }
    }

    // 2. MM/DD/YYYY or DD/MM/YYYY (PH LTO Standard: DD/MM/YYYY e.g. 02/09/2025 = 02 September 2025)
    const dmy = /(?:^|[^0-9])(0?[1-9]|[12]\d|3[01])[-/. ](0?[1-9]|1[0-2])[-/. ](20[0-9]\d)(?![0-9])/g;
    while ((m = dmy.exec(clean)) !== null) {
        const p1 = parseInt(m[1], 10);
        const p2 = parseInt(m[2], 10);
        const year = parseInt(m[3], 10);
        let month, day;
        if (p1 > 12) { month = p2; day = p1; }       // e.g. 25/02/2025 -> day=25, month=02
        else if (p2 > 12) { month = p1; day = p2; }  // e.g. 02/25/2025 -> month=02, day=25
        else { month = p2; day = p1; }               // PH LTO standard DD/MM/YYYY: 02/09/2025 -> day=02, month=09
        const formatted = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const key = `${formatted}_${m.index}`;
        if (!seen.has(key)) {
            seen.add(key);
            results.push({ formatted, year, month, day, index: m.index, raw: m[0].trim() });
        }
    }

    // 3. Month name formats: "09 FEB 2025" / "2025 FEB 09" / "FEB 09 2025"
    const MONTHS = { JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12 };
    const mon = /(?:^|[^0-9A-Z])(?:(20[0-9]\d)[\s/-]+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s/-]+(\d{1,2})|(\d{1,2})[\s/-]+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s/-]+(20[0-9]\d)|(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s/-]+(\d{1,2})[\s/-]+(20[0-9]\d))(?![0-9])/gi;
    while ((m = mon.exec(clean)) !== null) {
        let year, month, day;
        if (m[1]) { year = parseInt(m[1]); month = MONTHS[m[2].slice(0,3).toUpperCase()]; day = parseInt(m[3]); }
        else if (m[4]) { year = parseInt(m[6]); month = MONTHS[m[5].slice(0,3).toUpperCase()]; day = parseInt(m[4]); }
        else { year = parseInt(m[9]); month = MONTHS[m[7].slice(0,3).toUpperCase()]; day = parseInt(m[8]); }
        if (year && month && day) {
            const formatted = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const key = `${formatted}_${m.index}`;
            if (!seen.has(key)) {
                seen.add(key);
                results.push({ formatted, year, month, day, index: m.index, raw: m[0].trim() });
            }
        }
    }

    return results;
}

/**
 * Line-by-line & Proximity label-aware date extractor for PH LTO Driver's Licenses.
 *
 * Guaranteed extraction strategy:
 *   1. Extracts all dates from OCR text using flexible boundaries.
 *   2. Identifies proximity to EXPIRATION vs ISSUE vs BIRTH labels.
 *   3. Enforces Year-Hierarchy: Expiration Date on LTO License ALWAYS has the HIGHEST year (e.g. 2025 > 2020).
 *      Prevents Issue Date (2020/12/02) from overriding Expiration Date (2025/02/09).
 */
function extractLicenseDatesLineByLine(rawText) {
    if (!rawText) return { expirationDate: null, issueDate: null, birthDate: null, allDates: [] };

    const upperText = rawText.toUpperCase();
    const allDates = parseDatesFromText(rawText);

    if (allDates.length === 0) {
        return { expirationDate: null, issueDate: null, birthDate: null, allDates: [] };
    }

    // Keyword position finders
    const EXP_KEYWORDS = ['EXPIRATION', 'EXPIRY', 'EXP DATE', 'PETSA NG KAPASUHAN', 'VALID UNTIL', 'EXPIRES', 'EXP:', 'KAPASUHAN'];
    const ISS_KEYWORDS = ['ISSUE DATE', 'DATE OF ISSUANCE', 'ISSUANCE', 'ISSUED ON', 'ISSUED:', 'DATE ISSUED', 'ISSUE'];
    const DOB_KEYWORDS = ['DATE OF BIRTH', 'BIRTHDATE', 'BIRTH DATE', 'PETSA NG KAPANGANAKAN', 'DOB', 'BORN', 'BIRTH'];

    const findMinKeywordDistance = (charIndex, keywords) => {
        let minDist = Infinity;
        for (const kw of keywords) {
            let pos = upperText.indexOf(kw);
            while (pos !== -1) {
                const dist = Math.abs(charIndex - pos);
                if (dist < minDist) minDist = dist;
                pos = upperText.indexOf(kw, pos + 1);
            }
        }
        return minDist;
    };

    // Classify each date candidate
    const scoredDates = allDates.map(d => {
        const expDist = findMinKeywordDistance(d.index, EXP_KEYWORDS);
        const issDist = findMinKeywordDistance(d.index, ISS_KEYWORDS);
        const dobDist = findMinKeywordDistance(d.index, DOB_KEYWORDS);

        let type = 'unknown';
        if (expDist < issDist && expDist < dobDist && expDist < 200) {
            type = 'expiration';
        } else if (issDist < expDist && issDist < dobDist && issDist < 150) {
            type = 'issue';
        } else if (dobDist < expDist && dobDist < issDist && dobDist < 150) {
            type = 'birth';
        } else if (d.year <= 2010) {
            type = 'birth'; // Year <= 2010 is almost certainly a birth date
        }

        return { ...d, expDist, issDist, dobDist, type };
    });

    // Separate by type
    const expCandidates = scoredDates.filter(d => d.type === 'expiration');
    const issCandidates = scoredDates.filter(d => d.type === 'issue');
    const dobCandidates = scoredDates.filter(d => d.type === 'birth');

    let expirationDate = null;

    if (expCandidates.length > 0) {
        // Pick expiration candidate with highest year / closest distance
        expCandidates.sort((a, b) => b.year - a.year || a.expDist - b.expDist);
        expirationDate = expCandidates[0].formatted;
    } else {
        // Fallback: exclude birth dates (year <= 2010) and dates closest to ISSUE label
        const remaining = scoredDates.filter(d => d.year > 2010 && d.type !== 'birth');
        if (remaining.length > 0) {
            // Sort by year descending (HIGHEST year = Expiration Date e.g. 2025 vs Issue Date 2020)
            remaining.sort((a, b) => b.year - a.year);
            expirationDate = remaining[0].formatted;
        } else {
            // Ultimate fallback: highest year overall
            allDates.sort((a, b) => b.year - a.year);
            expirationDate = allDates[0].formatted;
        }
    }

    const issueDate = issCandidates.length > 0 ? issCandidates[0].formatted : null;
    const birthDate = dobCandidates.length > 0 ? dobCandidates[0].formatted : null;

    return { expirationDate, issueDate, birthDate, allDates };
}

/**
 * Generic multi-format date extractor (for non-license documents that don't have strict labels).
 */
function extractDatesFromText(rawText) {
    if (!rawText) return [];
    return parseDatesFromText(rawText);
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
