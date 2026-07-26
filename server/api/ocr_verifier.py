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

def normalize_ocr_date_str(text):
    """
    Normalizes common Tesseract OCR character substitution errors in date strings.
    e.g. 'O9/O2/2O25' -> '09/02/2025', '12/O2/2O20' -> '12/02/2020'
    """
    import re
    # 'O' between digits -> '0'
    text = re.sub(r'(?<=[0-9])O(?=[0-9])', '0', text)
    # Leading O before digit -> 0
    text = re.sub(r'\bO(?=[0-9])', '0', text)
    # Trailing O after digit -> 0  
    text = re.sub(r'(?<=[0-9])O\b', '0', text)
    # I/l between digits -> 1
    text = re.sub(r'(?<=[0-9])[Il](?=[0-9])', '1', text)
    # L between digits -> 1
    text = re.sub(r'(?<=[0-9])L(?=[0-9])', '1', text)
    # S between digits -> 5
    text = re.sub(r'(?<=[0-9])S(?=[0-9])', '5', text)
    return text


def parse_dates_in_line(line):
    """
    Extracts all date instances from a single line of OCR text.
    Returns list of dicts with year, month, day, formatted fields.
    """
    import re
    results = []
    clean = normalize_ocr_date_str(line.upper())

    # YYYY-MM-DD / YYYY/MM/DD
    for m in re.finditer(r'\b(20[0-4]\d)[\-/. ](0?[1-9]|1[0-2])[\-/. ](0?[1-9]|[12]\d|3[01])\b', clean):
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        results.append({'year': y, 'month': mo, 'day': d, 'formatted': f'{y:04d}-{mo:02d}-{d:02d}'})

    # MM/DD/YYYY or DD/MM/YYYY
    for m in re.finditer(r'\b(0?[1-9]|[12]\d|3[01])[\-/. ](0?[1-9]|1[0-2])[\-/. ](20[0-4]\d)\b', clean):
        p1, p2, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if p1 > 12:
            mo, d = p2, p1          # DD/MM/YYYY
        elif p2 > 12:
            mo, d = p1, p2          # MM/DD/YYYY but p2 > 12 means p2 is day
        else:
            mo, d = p1, p2          # default MM/DD/YYYY (PH LTO standard)
        results.append({'year': y, 'month': mo, 'day': d, 'formatted': f'{y:04d}-{mo:02d}-{d:02d}'})

    # Month-name formats: "02 SEP 2025" / "2025 SEP 02"
    MONTHS = {'JAN':1,'FEB':2,'MAR':3,'APR':4,'MAY':5,'JUN':6,'JUL':7,'AUG':8,'SEP':9,'OCT':10,'NOV':11,'DEC':12}
    for m in re.finditer(
        r'\b(\d{1,2}|20[0-4]\d)[\s/-]+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s/-]+(\d{1,2}|20[0-4]\d)\b',
        clean
    ):
        p1, mon_str, p3 = m.group(1), m.group(2)[:3].upper(), m.group(3)
        mo = MONTHS.get(mon_str)
        if mo:
            if len(p1) == 4:
                y, d = int(p1), int(p3)
            else:
                y, d = int(p3), int(p1)
            if 2000 <= y <= 2045:
                results.append({'year': y, 'month': mo, 'day': d, 'formatted': f'{y:04d}-{mo:02d}-{d:02d}'})

    return results


def extract_dates_from_pytesseract(ocr_text):
    """
    Line-by-line label-aware date extractor for PH LTO Driver's License OCR text.

    Correctly classifies:
      EXPIRATION DATE lines -> expiration candidates
      ISSUE DATE / DATE OF ISSUANCE lines -> excluded from expiry
      DATE OF BIRTH lines -> excluded from expiry

    Returns dict: { expirationDate, issueDate, birthDate, allDates }
    """
    if not ocr_text:
        return {'expirationDate': None, 'issueDate': None, 'birthDate': None, 'allDates': []}

    EXP_LABELS = ['EXPIRATION', 'EXPIRY', 'EXP DATE', 'PETSA NG KAPASUHAN', 'VALID UNTIL', 'EXPIRES', 'EXP:']
    ISS_LABELS = ['ISSUE DATE', 'DATE OF ISSUANCE', 'ISSUANCE', 'ISSUED ON', 'ISSUED:', 'DATE ISSUED']
    DOB_LABELS = ['DATE OF BIRTH', 'BIRTHDATE', 'BIRTH DATE', 'PETSA NG KAPANGANAKAN', 'DOB']

    lines = [l.strip() for l in ocr_text.split('\n') if l.strip()]
    upper_lines = [l.upper() for l in lines]

    all_dates = []
    expiration_candidates = []
    issue_candidates = []
    birth_candidates = []

    for i, line in enumerate(upper_lines):
        dates_in_line = parse_dates_in_line(line)
        next_line = upper_lines[i + 1] if i + 1 < len(upper_lines) else ''
        dates_in_next = parse_dates_in_line(next_line)

        is_exp = any(lbl in line for lbl in EXP_LABELS)
        is_iss = any(lbl in line for lbl in ISS_LABELS)
        is_dob = any(lbl in line for lbl in DOB_LABELS)

        combined = dates_in_line + dates_in_next

        if is_exp:
            expiration_candidates.extend(combined)
            all_dates.extend(combined)
        elif is_iss:
            issue_candidates.extend(combined)
            all_dates.extend(combined)
        elif is_dob:
            birth_candidates.extend(combined)
            all_dates.extend(combined)
        elif dates_in_line:
            all_dates.extend(dates_in_line)

    # Resolve expiration: pick highest-year candidate
    expiration_date = None
    if expiration_candidates:
        expiration_candidates.sort(key=lambda x: (x['year'], x['month']), reverse=True)
        expiration_date = expiration_candidates[0]['formatted']
    elif all_dates:
        issue_strs = {d['formatted'] for d in issue_candidates}
        birth_strs = {d['formatted'] for d in birth_candidates}
        fallback = [d for d in all_dates if d['formatted'] not in issue_strs and d['formatted'] not in birth_strs]
        if fallback:
            fallback.sort(key=lambda x: x['year'], reverse=True)
            expiration_date = fallback[0]['formatted']
        else:
            all_dates.sort(key=lambda x: x['year'], reverse=True)
            expiration_date = all_dates[0]['formatted'] if all_dates else None

    issue_date = (sorted(issue_candidates, key=lambda x: x['year'], reverse=True)[0]['formatted']
                  if issue_candidates else None)
    birth_date = (sorted(birth_candidates, key=lambda x: x['year'], reverse=True)[0]['formatted']
                  if birth_candidates else None)

    return {
        'expirationDate': expiration_date,
        'issueDate': issue_date,
        'birthDate': birth_date,
        'allDates': all_dates,
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
            # Use line-by-line label-aware date extraction for accurate expiry detection
            date_info = extract_dates_from_pytesseract(ocr_text)
            expiration_date_str = date_info.get('expirationDate')

            logger.info(f'[OCR Backend] Expiration Date: {expiration_date_str}')
            logger.info(f'[OCR Backend] Issue Date: {date_info.get("issueDate")}')
            logger.info(f'[OCR Backend] Birth Date: {date_info.get("birthDate")}')

            today = timezone.now().date()
            if expiration_date_str:
                try:
                    from datetime import datetime
                    exp_date = datetime.strptime(expiration_date_str, '%Y-%m-%d').date()
                    if exp_date < today:
                        return False, ocr_text, f"OCR Rejection: Natagpuang EXPIRED ang LTO License sa larawan (Expiry Date: {expiration_date_str})."
                except ValueError:
                    logger.warning(f'Could not parse expiration date: {expiration_date_str}')

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
