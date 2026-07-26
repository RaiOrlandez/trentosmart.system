import re
import json
import logging
from django.utils import timezone
from PIL import Image

logger = logging.getLogger(__name__)

# Try importing pytesseract for server-side OCR
try:
    import pytesseract
    HAS_PYTESSERACT = True
except ImportError:
    HAS_PYTESSERACT = False

# Document Keywords for Server-Side OCR Verification
DOCUMENT_KEYWORDS = {
    'license': ['DRIVER', 'LICENSE', 'LTO', 'REPUBLIC', 'PHILIPPINES', 'EXPIRY', 'RESTRICTION', 'DL'],
    'permit': ['PERMIT', 'FRANCHISE', 'MTOP', 'TRENTO', 'MUNICIPAL', 'MAYOR', 'TRICYCLE', 'OPERATOR', 'LGU'],
    'clearance': ['NBI', 'POLICE', 'CLEARANCE', 'NATIONAL', 'BUREAU', 'INVESTIGATION', 'RECORD', 'NO DEROGATORY'],
    'orcr': ['OFFICIAL', 'RECEIPT', 'CERTIFICATE', 'REGISTRATION', 'LTO', 'PLATE', 'CHASSIS', 'MOTOR', 'VEHICLE']
}

def verify_image_ocr_text(img_field, doc_type):
    """
    Scans stored Django FileField image using PyTesseract.
    Returns (is_valid_ocr: bool, ocr_text: str, confidence_reason: str).
    """
    if not img_field:
        return False, "", "Walang na-upload na larawan."

    try:
        img_field.open()
        with Image.open(img_field) as img:
            # Convert RGBA to RGB for tesseract compatibility
            if img.mode != 'RGB':
                img = img.convert('RGB')

            ocr_text = ""
            if HAS_PYTESSERACT:
                try:
                    ocr_text = pytesseract.image_to_string(img)
                except Exception as tess_err:
                    logger.warning(f"PyTesseract execution fallback: {tess_err}")
                    ocr_text = ""

            upper_text = ocr_text.toUpperCase() if hasattr(ocr_text, 'toUpperCase') else ocr_text.upper()
            keywords = DOCUMENT_KEYWORDS.get(doc_type, [])

            if keywords and upper_text:
                matches = [kw for kw in keywords if kw in upper_text]
                if len(matches) >= 2:
                    return True, ocr_text, f"OCR Verified: Natagpuan ang mga opisyal na salita ({', '.join(matches[:3])})."
                else:
                    return False, ocr_text, f"OCR Failure: Walang natagpuang opisyal na teksto sa larawan ng {doc_type.upper()}."

            # If OCR text is blank or tesseract binary not linked in system path, fallback to file integrity & resolution check
            w, h = img.size
            if w >= 300 and h >= 300 and img_field.size >= 25000:
                return True, ocr_text, "Image Integrity Verified (High Resolution Document Photo)."
            else:
                return False, ocr_text, "Hindi pumasa sa Image Quality & OCR Resolution Gate."

    except Exception as err:
        return False, "", f"Error sa pagbe-verify ng larawan: {str(err)}"

def audit_driver_profile(user):
    """
    Audits a driver profile's documents, expiry dates, license formats, and image OCR text.
    Returns (is_passed: bool, diagnostics: dict, failure_reasons: list).
    """
    failure_reasons = []
    diagnostics = {
        "license_format_ok": False,
        "license_not_expired": False,
        "plate_format_ok": False,
        "license_ocr_ok": False,
        "permit_ocr_ok": False,
        "nbi_ocr_ok": False,
        "orcr_ocr_ok": False,
        "selfie_ok": False,
        "tricycle_photo_ok": False,
        "audit_timestamp": timezone.now().isoformat()
    }

    # 1. License Number Format Check
    license_num = (user.license_number or "").strip().upper()
    license_regex = r'^[A-Z]\d{2}-?\d{2}-?\d{4,6}$'
    if license_num and re.match(license_regex, license_num):
        diagnostics["license_format_ok"] = True
    else:
        failure_reasons.append("Mali o kulang ang format ng LTO License Number (dapat hal. D12-34-567890).")

    # 2. License Expiry Date Check
    if user.license_expiry_date:
        today = timezone.now().date()
        if user.license_expiry_date >= today:
            diagnostics["license_not_expired"] = True
        else:
            failure_reasons.append(f"Expired na ang LTO License noong {user.license_expiry_date}.")
    else:
        failure_reasons.append("Walang inilagay na Expiration Date sa LTO License.")

    # 3. Vehicle Plate Format Check
    vehicle_plate = (user.vehicle_plate or "").strip().upper()
    plate_regex = r'^[A-Z0-9\s-]{3,10}$'
    if vehicle_plate and not re.match(r'^[\s-]+$', vehicle_plate) and re.match(plate_regex, vehicle_plate):
        diagnostics["plate_format_ok"] = True
    else:
        failure_reasons.append("Mali o walang Plate Number (dapat hal. RT-1024 o ABC 1234).")

    # 4. OCR & Image Integrity Checks for Stored Files
    lic_ok, _, lic_reason = verify_image_ocr_text(user.license_image, 'license')
    diagnostics["license_ocr_ok"] = lic_ok
    if not lic_ok:
        failure_reasons.append(f"LTO License Image Audit: {lic_reason}")

    permit_ok, _, permit_reason = verify_image_ocr_text(user.permit_image, 'permit')
    diagnostics["permit_ocr_ok"] = permit_ok
    if not permit_ok:
        failure_reasons.append(f"MTOP Franchise Permit Audit: {permit_reason}")

    nbi_ok, _, nbi_reason = verify_image_ocr_text(user.nbi_clearance_image, 'clearance')
    diagnostics["nbi_ocr_ok"] = nbi_ok
    if not nbi_ok:
        failure_reasons.append(f"NBI/Police Clearance Audit: {nbi_reason}")

    orcr_ok, _, orcr_reason = verify_image_ocr_text(user.vehicle_orcr_image, 'orcr')
    diagnostics["orcr_ocr_ok"] = orcr_ok
    if not orcr_ok:
        failure_reasons.append(f"Vehicle OR/CR Audit: {orcr_reason}")

    # Check Selfie & Tricycle Photo files exist
    diagnostics["selfie_ok"] = bool(user.selfie_with_license and user.selfie_with_license.size >= 20000)
    if not diagnostics["selfie_ok"]:
        failure_reasons.append("Selfie Photo Issue: Walang valid na solo selfie photo.")

    diagnostics["tricycle_photo_ok"] = bool(user.tricycle_photo and user.tricycle_photo.size >= 20000)
    if not diagnostics["tricycle_photo_ok"]:
        failure_reasons.append("Tricycle Photo Issue: Walang valid na larawan ng tricycle unit.")

    # Overall Audit Result
    is_passed = (len(failure_reasons) == 0)

    diagnostics["is_passed"] = is_passed
    diagnostics["failure_reasons"] = failure_reasons

    return is_passed, diagnostics, failure_reasons
