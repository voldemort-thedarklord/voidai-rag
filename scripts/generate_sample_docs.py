"""
Utility script to convert text policies into genuine PDF and DOCX files
for testing multi-format document ingestion.
"""

from pathlib import Path
import fitz  # PyMuPDF
import docx

POLICIES_DIR = Path(__file__).resolve().parent.parent / "data" / "sample_policies"


def generate_pdf(source_txt: Path, target_pdf: Path):
    """Generate a multi-page PDF with pagination from text."""
    with open(source_txt, "r", encoding="utf-8") as f:
        content = f.read()

    doc = fitz.open()
    # Split content roughly every 1500 chars to create multi-page PDF
    paragraphs = content.split("\n\n")
    current_page_text = []
    current_length = 0

    pages_data = []
    for p in paragraphs:
        if current_length + len(p) > 1200:
            pages_data.append("\n\n".join(current_page_text))
            current_page_text = [p]
            current_length = len(p)
        else:
            current_page_text.append(p)
            current_length += len(p)
    if current_page_text:
        pages_data.append("\n\n".join(current_page_text))

    for p_idx, p_text in enumerate(pages_data, 1):
        page = doc.new_page(width=595, height=842)  # A4 size
        rect = fitz.Rect(50, 60, 545, 780)
        page.insert_textbox(rect, p_text, fontsize=10, fontname="helv", align=fitz.TEXT_ALIGN_LEFT)
        page.insert_text((270, 810), f"- Page {p_idx} -", fontsize=9, fontname="helv")

    doc.save(target_pdf)
    doc.close()
    print(f"Generated PDF: {target_pdf.name} ({len(pages_data)} pages)")


def generate_docx(source_txt: Path, target_docx: Path):
    """Generate a DOCX file from text."""
    with open(source_txt, "r", encoding="utf-8") as f:
        lines = f.readlines()

    doc = docx.Document()
    if lines:
        doc.add_heading(lines[0].strip(), level=1)
        for line in lines[1:]:
            line_str = line.strip()
            if line_str.startswith(("1.", "2.", "3.", "4.", "5.", "6.")):
                doc.add_heading(line_str, level=2)
            elif line_str:
                doc.add_paragraph(line_str)

    doc.save(target_docx)
    print(f"Generated DOCX: {target_docx.name}")


def main():
    hr_txt = POLICIES_DIR / "HR_Leave_and_Attendance_Policy.txt"
    if hr_txt.exists():
        generate_pdf(hr_txt, POLICIES_DIR / "HR_Leave_and_Attendance_Policy.pdf")

    it_txt = POLICIES_DIR / "IT_Security_and_BYOD_Guidelines.txt"
    if it_txt.exists():
        generate_pdf(it_txt, POLICIES_DIR / "IT_Security_and_BYOD_Guidelines.pdf")

    eng_txt = POLICIES_DIR / "Engineering_Coding_and_Deployment_Standard.txt"
    if eng_txt.exists():
        generate_docx(eng_txt, POLICIES_DIR / "Engineering_Coding_and_Deployment_Standard.docx")


if __name__ == "__main__":
    main()
