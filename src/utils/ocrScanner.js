import { createWorker } from 'tesseract.js';

/**
 * ocrScanner.js — Multi-Document OCR Scanning Engine for Transmart Driver Verification
 * Supports LTO Driver's License, LGU MTOP Permit, NBI Clearance, and Vehicle OR/CR.
 */

// Helper to parse dates in various PH document formats
function extractDatesFromText(rawText) {
    if (!rawText) return [];
    
    // Clean common OCR noise
    const text = rawText.toUpperCase().replace(/[|]/g, ' ');
    const dateMatches = [];
    
    // Pattern 1: ISO / Slash formats: YYYY/MM/DD, YYYY-MM-DD, DD/MM/YYYY, YYYY.MM.DD
    const numericDateRegex = /\b(\d{4})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/g;
    let match;
    while ((match = numericDateRegex.exec(text)) !== null) {
        const year = parseInt(match[1], 10);
        const month = match[2];
        const day = match[3];
        if (year >= 2000 && year <= 2045) {
            dateMatches.push({
                formatted: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
                year,
                raw: match[0]
            });
        }
    }

    // Pattern 2: DD/MM/YYYY format
    const altNumericRegex = /\b(0[1-9]|[12]\d|3[01])[-/.](0[1-9]|1[0-2])[-/.](\d{4})\b/g;
    while ((match = altNumericRegex.exec(text)) !== null) {
        const day = match[1];
        const month = match[2];
        const year = parseInt(match[3], 10);
        if (year >= 2000 && year <= 2045) {
            dateMatches.push({
                formatted: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
                year,
                raw: match[0]
            });
        }
    }

    // Pattern 3: Text month formats e.g. "2028 MAY 15" or "15 MAY 2028"
    const months = {
        JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
        JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    };
    const monthRegex = /\b(\d{4}|0[1-9]|[12]\d|3[01])[\s/-]+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s/-]+(\d{4}|0[1-9]|[12]\d|3[01])\b/gi;
    while ((match = monthRegex.exec(text)) !== null) {
        const part1 = match[1];
        const monthStr = match[2].toUpperCase().slice(0, 3);
        const part3 = match[3];
        const month = months[monthStr];

        let year, day;
        if (part1.length === 4) {
            year = parseInt(part1, 10);
            day = part3.padStart(2, '0');
        } else {
            year = parseInt(part3, 10);
            day = part1.padStart(2, '0');
        }

        if (year >= 2000 && year <= 2045 && month) {
            dateMatches.push({
                formatted: `${year}-${month}-${day}`,
                year,
                raw: match[0]
            });
        }
    }

    return dateMatches;
}

// Helper to extract PH LTO License Number
function extractLicenseNumber(rawText) {
    if (!rawText) return null;
    const text = rawText.toUpperCase();
    
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
    
    // Format: MTOP-XXXX, PERMIT-XXXX, or numeric ID
    const permitRegex = /\b(MTOP[- ]?\d{3,6}|PERMIT[- ]?\d{3,6}|\d{4,8})\b/g;
    const match = permitRegex.exec(text);
    return match ? match[1] : null;
}

// Helper to extract Vehicle Plate Number
function extractPlateNumber(rawText) {
    if (!rawText) return null;
    const text = rawText.toUpperCase();
    
    // PH Plate formats: ABC 123, ABC 1234, AB 12345
    const plateRegex = /\b([A-Z]{2,3}[- ]?\d{3,4})\b/g;
    const match = plateRegex.exec(text);
    return match ? match[1].replace(/\s+/g, ' ') : null;
}

/**
 * Scan LTO Driver's License
 */
export async function scanLicenseID(imageFile) {
    let worker = null;
    try {
        worker = await createWorker('eng');
        const ret = await worker.recognize(imageFile);
        const text = ret.data.text || '';
        const confidence = ret.data.confidence || 0;

        await worker.terminate();

        const detectedLicense = extractLicenseNumber(text);
        const dates = extractDatesFromText(text);

        let expirationDate = null;
        let isExpired = null;

        if (dates.length > 0) {
            const expKeywordIndex = text.toUpperCase().indexOf('EXP');
            if (expKeywordIndex !== -1) {
                expirationDate = dates[0].formatted;
            } else {
                dates.sort((a, b) => b.year - a.year);
                expirationDate = dates[0].formatted;
            }

            if (expirationDate) {
                const expDateObj = new Date(expirationDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                isExpired = expDateObj < today;
            }
        }

        return {
            success: true,
            rawText: text,
            licenseNumber: detectedLicense,
            expirationDate,
            isExpired,
            confidence: Math.round(confidence)
        };

    } catch (err) {
        console.error('OCR Scanning Error (License):', err);
        if (worker) { try { await worker.terminate(); } catch (_) {} }
        return { success: false, error: err.message, confidence: 0 };
    }
}

/**
 * Scan LGU Franchise / MTOP Permit
 */
export async function scanPermitID(imageFile) {
    let worker = null;
    try {
        worker = await createWorker('eng');
        const ret = await worker.recognize(imageFile);
        const text = ret.data.text || '';
        const confidence = ret.data.confidence || 0;
        await worker.terminate();

        const permitNum = extractPermitNumber(text);
        const dates = extractDatesFromText(text);
        const validDate = dates.length > 0 ? dates[0].formatted : null;

        return {
            success: true,
            rawText: text,
            permitNumber: permitNum,
            expirationDate: validDate,
            confidence: Math.round(confidence)
        };
    } catch (err) {
        console.error('OCR Scanning Error (Permit):', err);
        if (worker) { try { await worker.terminate(); } catch (_) {} }
        return { success: false, error: err.message, confidence: 0 };
    }
}

/**
 * Scan NBI / Police Clearance
 */
export async function scanNbiClearance(imageFile) {
    let worker = null;
    try {
        worker = await createWorker('eng');
        const ret = await worker.recognize(imageFile);
        const text = ret.data.text || '';
        const confidence = ret.data.confidence || 0;
        await worker.terminate();

        const hasNoRecord = text.toUpperCase().includes('NO RECORD') || 
                            text.toUpperCase().includes('NO DEROGATORY') ||
                            text.toUpperCase().includes('CLEARED');

        const dates = extractDatesFromText(text);

        return {
            success: true,
            rawText: text,
            hasNoRecord,
            issueDate: dates.length > 0 ? dates[0].formatted : null,
            confidence: Math.round(confidence)
        };
    } catch (err) {
        console.error('OCR Scanning Error (NBI):', err);
        if (worker) { try { await worker.terminate(); } catch (_) {} }
        return { success: false, error: err.message, confidence: 0 };
    }
}

/**
 * Scan Vehicle OR / CR
 */
export async function scanVehicleORCR(imageFile) {
    let worker = null;
    try {
        worker = await createWorker('eng');
        const ret = await worker.recognize(imageFile);
        const text = ret.data.text || '';
        const confidence = ret.data.confidence || 0;
        await worker.terminate();

        const plateNumber = extractPlateNumber(text);
        const dates = extractDatesFromText(text);

        return {
            success: true,
            rawText: text,
            plateNumber,
            registrationDate: dates.length > 0 ? dates[0].formatted : null,
            confidence: Math.round(confidence)
        };
    } catch (err) {
        console.error('OCR Scanning Error (ORCR):', err);
        if (worker) { try { await worker.terminate(); } catch (_) {} }
        return { success: false, error: err.message, confidence: 0 };
    }
}
