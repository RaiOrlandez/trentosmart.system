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
    'license': ['DRIVER', 'LICENSE', 'LTO', 'REPUBLIC', 'PHILIPPINES', 'EXPIRY', 'EXPIRATION', 'RESTRICTION', 'DL', 'KAPASUHAN'],
    'permit': ['PERMIT', 'FRANCHISE', 'MTOP', 'TRENTO', 'MUNICIPAL', 'MAYOR', 'TRICYCLE', 'OPERATOR', 'LGU'],
    'clearance': ['NBI', 'POLICE', 'CLEARANCE', 'NATIONAL', 'BUREAU', 'INVESTIGATION', 'RECORD', 'NO DEROGATORY'],
    'orcr': ['OFFICIAL', 'RECEIPT', 'CERTIFICATE', 'REGISTRATION', 'LTO', 'PLATE', 'CHASSIS', 'MOTOR', 'VEHICLE']
}

def extract_dates_from_pytesseract(ocr_text):
    """
    Parses candidate dates and years from PyTesseract OCR text string.
    Returns list of dicts with formatted date and year.
    """
    if not ocr_text:
        return []
    
    upper = ocr_text.upper()
    # Normalize OCR typos
    upper = re.sub(r'([0-9])O([0-9])', r'\10\2', upper)
    upper = re.sub(r'O([0-9])', r'0\1', upper)
    
    dates = []
    today_year = timezone.now().year

    # Format YYYY-MM-DD or YYYY/MM/DD
    ymd_matches = re.findall(r'\b(20[0-4]\d)[-/.\s]+(0?[1-9]|1[0-2])[-/.\s]+(0?[1-9]|[12]\d|3[01])\b', upper)
    for m in ymd_matches:
        year = int(m[0])
        month = int(m[1])
        day = int(m[2])
        dates.append({
            'formatted': f"{year:04d}-{month:02d}-{day:02d}",
            'year': year,
            'month': month,
            'day': day
        })

    # Format DD-MM-YYYY or MM-DD-YYYY
    dmy_matches = re.findall(r'\b(0?[1-9]|[12]\d|3[01])[-/.\s]+(0?[1-9]|1[0-2])[-/.\s]+(20[0-4]\d)\b', upper)
    for m in dmy_matches:
        year = int(m[2])
        month = int(m[1])
        day = int(m[0])
        dates.append({
            'formatted': f"{year:04d}-{month:02d}-{day:02d}",
            'year': year,
            'month': month,
            'day': day
        })

    return dates

def verify_image_ocr_text(img_field, doc_type):
    """
    Scans stored Django FileField image using PyTesseract.
    Returns (is_valid_ocr: bool, ocr_text: str, confidence_reason: str).
    """
    if not img_field:
        return False, "", "Walang na-upload na larawan."

    try:
        img_field.open()
        img = Image.open(img_field)
        # Convert RGBA/palette to RGB for tesseract compatibility
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')

        img_width, img_height = img.size
        file_size = img_field.size

        ocr_text = ""
        if HAS_PYTESSERACT:
            try:
                ocr_text = pytesseract.image_to_string(img)
            except Exception as tess_err:
                logger.warning(f"PyTesseract execution fallback: {tess_err}")
                ocr_text = ""

        img.close()

        upper_text = ocr_text.upper()
        keywords = DOCUMENT_KEYWORDS.get(doc_type, [])

        if doc_type == 'license' and upper_text.strip():
            # Check if PyTesseract text contains an expired date or year near EXP keyword
            dates = extract_dates_from_pytesseract(ocr_text)
            exp_keywords = ['EXPIRATION', 'EXP', 'VALID UNTIL', 'KAPASUHAN', 'EXPIRES']
            has_exp_keyword = any(kw in upper_text for kw in exp_keywords)
            
            today = timezone.now().date()
            if dates and has_exp_keyword:
                # Find max year / expiration candidate
                dates.sort(key=lambda x: x['year'], reverse=True)
                latest_date_str = dates[0]['formatted']
                latest_date_obj = timezone.datetime.strptime(latest_date_str, "%Y-%m-%d").date()
                if latest_date_obj < today:
                    return False, ocr_text, f"OCR Rejection: Natagpuang EXPIRED ang LTO License sa larawan (Expiry Date: {latest_date_str})."

        if keywords and upper_text.strip():
            matches = [kw for kw in keywords if kw in upper_text]
            if len(matches) >= 2:
                return True, ocr_text, f"OCR Verified: Natagpuan ang mga opisyal na salita ({', '.join(matches[:3])})."
            else:
                return False, ocr_text, f"OCR Failure: Walang natagpuang opisyal na teksto sa larawan ng {doc_type.upper()}."

        # Fallback to image quality check if Tesseract text is blank or PyTesseract is unavailable
        if img_width >= 300 and img_height >= 300 and file_size >= 25000:
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
    today = timezone.now().date()
    if user.license_expiry_date:
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
        if "EXPIRED" in lic_reason:
            diagnostics["license_not_expired"] = False

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
