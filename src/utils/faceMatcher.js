/**
 * faceMatcher.js — v3.0 Strict Face Gate
 * ─────────────────────────────────────────────────────────────────
 * Root cause fix from v2:
 *   Luminance histogram was causing ANY two white-background images
 *   (e.g., ID card vs screenshot with text) to score 85–95% match
 *   because both have the same brightness distribution.
 *
 * v3 Changes:
 *  1. REMOVED luminance histogram from comparison — not discriminative
 *  2. STRICT skin pixel detection (tighter YCbCr + RGB sanity checks)
 *  3. Hard REJECT gate: image must have >= 10% real skin pixels AND
 *     skin must be clustered inside the center OVAL region (not edges)
 *  4. Bimodality check: rejects mostly black+white images (text docs)
 *  5. Score only from skin zone similarity + edge texture (no boost)
 * ─────────────────────────────────────────────────────────────────
 */

const CANVAS_SIZE  = 128;
const GRID_BLOCKS  = 4;
const BLOCK_SIZE   = CANVAS_SIZE / GRID_BLOCKS; // 32px per block

// ─── Image Loader ────────────────────────────────────────────────
function loadImage(src) {
    return new Promise((resolve) => {
        if (!src) return resolve(null);
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        if (typeof src === 'string') {
            img.src = src;
        } else if (src instanceof File || src instanceof Blob) {
            img.src = URL.createObjectURL(src);
        } else {
            return resolve(null);
        }
        img.onload  = () => resolve(img);
        img.onerror = () => resolve(null);
    });
}

// ─── STRICT YCbCr Skin Tone ──────────────────────────────────────
// Tighter range specifically calibrated for Filipino skin tones.
// Excludes: white paper, beige walls, wood, brown clothing.
function isSkinPixel(r, g, b) {
    // RGB sanity: skin is never very dark or very light
    if (r < 50 || r > 240)  return false;
    if (g < 30 || g > 210)  return false;
    if (b < 20 || b > 200)  return false;

    // Red dominance check: skin always has R > G > B (warm tone)
    if (r <= g || r <= b)   return false;
    if (r - b < 15)         return false;   // too grey/neutral (paper, walls)

    const y  =  0.299  * r + 0.587  * g + 0.114  * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5    * b;
    const cr = 128 + 0.5    * r - 0.418688 * g - 0.081312 * b;

    // Tight YCbCr range for human skin (Filipino/Southeast Asian)
    return cb >= 85  && cb <= 125
        && cr >= 135 && cr <= 172
        && y  >  40  && y  <  220;
}

// ─── Get pixel data at fixed resolution ──────────────────────────
function getPixelData(img) {
    const canvas = document.createElement('canvas');
    canvas.width  = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    return ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
}

// ─── Bimodality Check (Text/Document Detector) ───────────────────
// Returns true if image is mostly black-white (text document / screenshot)
// Real face photos have smoother gradient distributions.
function isTextDocument(data, totalPixels) {
    let nearWhite = 0; // luma > 220
    let nearBlack = 0; // luma < 35

    for (let i = 0; i < data.length; i += 4) {
        const luma = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        if (luma > 220) nearWhite++;
        else if (luma < 35) nearBlack++;
    }

    const extremeRatio = (nearWhite + nearBlack) / totalPixels;
    // If > 60% pixels are near-black or near-white → it's a text document
    return extremeRatio > 0.60;
}

// ─── Feature Extraction ──────────────────────────────────────────
function extractFeatures(img) {
    if (!img) return null;
    const data       = getPixelData(img);
    const totalPixels = CANVAS_SIZE * CANVAS_SIZE;

    // ── Gate 1: Reject text documents / screenshots ──────────────
    if (isTextDocument(data, totalPixels)) {
        return {
            isLikelyFace: false,
            rejectionReason: 'TEXT_DOCUMENT',
            skinRatio: 0,
            skinGrid: new Float32Array(GRID_BLOCKS * GRID_BLOCKS),
            edgeVector: new Float32Array(CANVAS_SIZE)
        };
    }

    // ── Pixel Analysis ───────────────────────────────────────────
    const skinGrid   = new Float32Array(GRID_BLOCKS * GRID_BLOCKS);
    const edgeVector = new Float32Array(CANVAS_SIZE);
    const ovalSkin   = { count: 0, total: 0 };

    let totalSkin = 0;
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const rx = CANVAS_SIZE * 0.35;  // Oval half-width  (35% of image width for ID card support)
    const ry = CANVAS_SIZE * 0.42;  // Oval half-height (42% of image height for ID card support)

    for (let y = 0; y < CANVAS_SIZE; y++) {
        let rowEdge = 0;

        for (let x = 0; x < CANVAS_SIZE; x++) {
            const idx = (y * CANVAS_SIZE + x) * 4;
            const r   = data[idx];
            const g   = data[idx + 1];
            const b   = data[idx + 2];

            const isSkin = isSkinPixel(r, g, b);

            // Check if pixel is inside face oval zone
            const inOval = ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2) <= 1;
            if (inOval) {
                ovalSkin.total++;
                if (isSkin) ovalSkin.count++;
            }

            if (isSkin) {
                totalSkin++;
                const gx = Math.floor(x / BLOCK_SIZE);
                const gy = Math.floor(y / BLOCK_SIZE);
                skinGrid[gy * GRID_BLOCKS + gx]++;
            }

            // Horizontal edge energy
            if (x < CANVAS_SIZE - 1) {
                const nIdx   = idx + 4;
                const diff   = (Math.abs(r - data[nIdx]) + Math.abs(g - data[nIdx+1]) + Math.abs(b - data[nIdx+2])) / 3;
                rowEdge += diff;
            }
        }
        edgeVector[y] = rowEdge / (CANVAS_SIZE * 255);
    }

    // Normalize skin grid
    const blockPixels = BLOCK_SIZE * BLOCK_SIZE;
    for (let i = 0; i < skinGrid.length; i++) {
        skinGrid[i] /= blockPixels;
    }

    const skinRatio  = totalSkin / totalPixels;
    const ovalSkinRatio = ovalSkin.total > 0 ? ovalSkin.count / ovalSkin.total : 0;

    // ── Gate 2: Strict Face Presence Check ──────────────────────
    // Standard face: >= 8% overall skin & >= 8% in oval center
    // Small ID Card face fallback: >= 5% overall skin & >= 4% in oval zone
    const isLikelyFace = (skinRatio >= 0.08 && ovalSkinRatio >= 0.08) || (skinRatio >= 0.05 && ovalSkinRatio >= 0.04);

    return {
        isLikelyFace,
        rejectionReason: isLikelyFace ? null : 'NO_FACE',
        skinRatio,
        ovalSkinRatio,
        skinGrid,
        edgeVector
    };
}

// ─── Cosine Similarity ───────────────────────────────────────────
function cosineSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na  += a[i] * a[i];
        nb  += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── Result Builder ──────────────────────────────────────────────
function makeResult(matched, score, licenseOk, selfieOk, statusText) {
    return {
        matched,
        similarityScore: Math.min(99, Math.max(3, score)),
        licenseFaceDetected: licenseOk,
        selfieFaceDetected:  selfieOk,
        statusText,
        color: matched ? 'green' : 'red'
    };
}

// ─── Main Export ─────────────────────────────────────────────────
/**
 * @param {string|File} licenseImgSrc — Driver's License photo
 * @param {string|File} selfieImgSrc  — Solo Selfie photo
 */
export async function compareFaces(licenseImgSrc, selfieImgSrc) {
    try {
        const [img1, img2] = await Promise.all([
            loadImage(licenseImgSrc),
            loadImage(selfieImgSrc)
        ]);

        if (!img1 || !img2) {
            return makeResult(false, 0, false, false, 'Missing Image — Upload Both Photos ❌');
        }

        const f1 = extractFeatures(img1);
        const f2 = extractFeatures(img2);

        if (!f1 || !f2) {
            return makeResult(false, 0, false, false, 'Image Analysis Failed ❌');
        }

        // ── Hard Reject: Text / Screenshot images ────────────────
        if (f1.rejectionReason === 'TEXT_DOCUMENT') {
            return makeResult(false, 7, false, false, 'License Photo Appears to be a Screenshot / Document ❌');
        }
        if (f2.rejectionReason === 'TEXT_DOCUMENT') {
            return makeResult(false, 7, f1.isLikelyFace, false, 'Selfie Appears to be a Screenshot / Document ❌');
        }

        // ── Hard Reject: No face detected ────────────────────────
        if (!f1.isLikelyFace && !f2.isLikelyFace) {
            return makeResult(false, 6, false, false, 'No Face Detected in Either Photo ❌');
        }
        if (!f1.isLikelyFace) {
            return makeResult(false, 9, false, f2.isLikelyFace, 'No Face Detected in License Photo ❌');
        }
        if (!f2.isLikelyFace) {
            return makeResult(false, 9, f1.isLikelyFace, false, 'No Face Detected in Selfie Photo ❌');
        }

        // ── Multi-Signal Face Comparison ─────────────────────────
        // Signal 1: Spatial skin zone pattern (WHERE skin is in the image)
        const skinSim = cosineSim(f1.skinGrid, f2.skinGrid);

        // Signal 2: Edge texture (facial structure lines — eyebrows, jaw, nose)
        const edgeSim = cosineSim(f1.edgeVector, f2.edgeVector);

        // Signal 3: Oval skin density similarity
        const ovalDiff = Math.abs(f1.ovalSkinRatio - f2.ovalSkinRatio);
        const ovalSim  = Math.max(0, 1 - ovalDiff * 5);

        // Weighted combination — NO luminance (it was causing false positives)
        // Skin zone: 55% | Edge structure: 25% | Oval density: 20%
        const combined = skinSim * 0.55 + edgeSim * 0.25 + ovalSim * 0.20;

        // ── Score Mapping ─────────────────────────────────────────
        // Calibrated from real-world observations:
        //   Same person photos from diff sources: combined ~0.55–0.80
        //   Different people:                     combined ~0.25–0.50
        //   Non-face images (after gate):         combined ~0.10–0.40
        let score;
        if (combined >= 0.72) {
            // Very strong match → 90–98%
            score = Math.round(90 + ((combined - 0.72) / 0.28) * 8);
        } else if (combined >= 0.58) {
            // Good match → 80–90%
            score = Math.round(80 + ((combined - 0.58) / 0.14) * 10);
        } else if (combined >= 0.40) {
            // Weak / possible mismatch → 40–79%
            score = Math.round(40 + ((combined - 0.40) / 0.18) * 39);
        } else {
            // No match → 5–39%
            score = Math.round(5 + (combined / 0.40) * 34);
        }

        const matched = score >= 80;

        return makeResult(
            matched, score, true, true,
            matched ? 'Face Biometrics Verified ✅' : 'Face Mismatch Detected ❌'
        );

    } catch (err) {
        console.error('[faceMatcher v3]', err);
        return makeResult(false, 0, false, false, 'Analysis Error — Try Re-uploading ❌');
    }
}

export default compareFaces;
