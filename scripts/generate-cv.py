"""Generate a one-page profile PDF from site.config.ts via generate-cv.mjs.

The checked-in PDF is a static asset: the site's production build needs no
Python packages. Install this script's optional tools under artifacts/pdf-tools.
"""

import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

import pymupdf
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


payload = json.load(sys.stdin)
profile = payload["profile"]
root = Path(payload["root"]).resolve()
required = ("name", "role", "experience", "availability", "email", "github", "cv", "summary")
for field in required:
    if not isinstance(profile.get(field), str) or not profile[field].strip():
        raise ValueError(f"profile.{field} must be a non-empty string")
if not isinstance(profile.get("coreStack"), list) or not all(isinstance(skill, str) and skill for skill in profile["coreStack"]):
    raise ValueError("profile.coreStack must be an array of non-empty strings")
if not isinstance(profile.get("isPlaceholder"), bool):
    raise ValueError("profile.isPlaceholder must be a boolean")
if profile["cv"] != "/cv.pdf":
    raise ValueError("The public CV download must remain /cv.pdf")

output = root / "public" / profile["cv"].lstrip("/")
preview = root / "artifacts" / "screenshots" / "placeholder-cv.png"
output.parent.mkdir(parents=True, exist_ok=True)
preview.parent.mkdir(parents=True, exist_ok=True)

width, height = A4
margin = 44
content_width = width - margin * 2
navy = colors.HexColor("#14223F")
ink = colors.HexColor("#203047")
muted = colors.HexColor("#566576")
green = colors.HexColor("#55783D")
lime = colors.HexColor("#D8E5A4")
border = colors.HexColor("#CCD5CA")
paper = colors.HexColor("#F9FAF5")

pdf = canvas.Canvas(str(output), pagesize=A4, pageCompression=1, invariant=1)
pdf.setTitle(f"{profile['name']} - {'Placeholder CV' if profile['isPlaceholder'] else 'CV'}")
pdf.setAuthor(profile["name"])
pdf.setSubject(profile["summary"])


def paragraph(text, x, top, available_width, size=10.5, leading=16, color=ink, font="Helvetica"):
    style = ParagraphStyle("body", fontName=font, fontSize=size, leading=leading, textColor=color, alignment=TA_LEFT)
    block = Paragraph(escape(text), style)
    _, block_height = block.wrap(available_width, height)
    block.drawOn(pdf, x, top - block_height)
    return top - block_height


def label(text, top):
    pdf.setFillColor(green)
    pdf.rect(margin, top - 9, 6, 6, fill=1, stroke=0)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(margin + 14, top - 9, text)


def rule(top):
    pdf.setStrokeColor(border)
    pdf.setLineWidth(0.7)
    pdf.line(margin, top, width - margin, top)


pdf.setFillColor(paper)
pdf.rect(0, 0, width, height, fill=1, stroke=0)
pdf.setFillColor(navy)
pdf.rect(0, height - 190, width, 190, fill=1, stroke=0)
pdf.setFillColor(green)
pdf.rect(0, height - 194, width, 4, fill=1, stroke=0)

# Original square motifs echo the portfolio without borrowing game artwork.
pdf.setFillColor(lime)
for dx, dy in ((0, 0), (8, 0), (16, 0), (8, -8), (16, -8), (16, -16)):
    pdf.rect(width - margin - 24 + dx, height - 51 + dy, 6, 6, fill=1, stroke=0)
pdf.setFillColor(lime)
pdf.setFont("Helvetica-Bold", 9)
pdf.drawString(margin, height - 48, "PLACEHOLDER CV / PROJECT PROFILE" if profile["isPlaceholder"] else "DEVELOPER PROFILE / CV")
name_bottom = paragraph(profile["name"], margin, height - 73, content_width - 38, 30, 35, colors.white, "Helvetica-Bold")
role_bottom = paragraph(profile["role"], margin, name_bottom - 12, content_width, 13, 18, lime)
if role_bottom < height - 175:
    raise ValueError("Profile name or role is too long for the one-page CV header")

top = height - 223
label("PROFILE", top)
bottom = paragraph(profile["summary"], margin, top - 27, content_width, 10.5, 16)

top = bottom - 28
rule(top)
top -= 21
label("AT A GLANCE", top)
left_width = content_width * 0.56
right_x = margin + left_width + 18
right_width = content_width - left_width - 18
row_top = top - 30
left_bottom = paragraph(profile["experience"], margin, row_top, left_width, 11, 16, ink, "Helvetica-Bold")
left_bottom = paragraph(profile["availability"], margin, left_bottom - 10, left_width, 11, 16)
right_bottom = paragraph("CORE STACK", right_x, row_top, right_width, 8, 12, muted, "Helvetica-Bold")
right_bottom = paragraph(" / ".join(profile["coreStack"]), right_x, right_bottom - 7, right_width, 12, 18, ink, "Helvetica-Bold")
if profile["isPlaceholder"]:
    right_bottom = paragraph("Technologies evidenced in project repositories.", right_x, right_bottom - 7, right_width, 9, 13, muted)

top = min(left_bottom, right_bottom) - 26
rule(top)
top -= 21
label("CONTACT & LINKS", top)
contact_top = top - 30
paragraph("EMAIL", margin, contact_top, 74, 8, 13, muted, "Helvetica-Bold")
email_bottom = paragraph(profile["email"], margin + 84, contact_top, content_width - 84, 11, 16)
pdf.linkURL(f"mailto:{profile['email']}", (margin + 84, email_bottom, width - margin, contact_top), relative=0)
contact_top = email_bottom - 13
paragraph("GITHUB", margin, contact_top, 74, 8, 13, muted, "Helvetica-Bold")
github_bottom = paragraph(profile["github"], margin + 84, contact_top, content_width - 84, 10.5, 16)
pdf.linkURL(profile["github"], (margin + 84, github_bottom, width - margin, contact_top), relative=0)

top = github_bottom - 29
if profile["isPlaceholder"]:
    box_text = "This project-based placeholder is not an employment record. Confirm the role, contact details and availability, then add verified work history and education before using it as a personal CV."
    block = Paragraph(escape(box_text), ParagraphStyle("notice", fontName="Helvetica", fontSize=10, leading=15, textColor=ink))
    _, box_text_height = block.wrap(content_width - 32, height)
    box_height = box_text_height + 48
    pdf.setFillColor(colors.HexColor("#EEF2E5"))
    pdf.setStrokeColor(border)
    pdf.rect(margin, top - box_height, content_width, box_height, fill=1, stroke=1)
    pdf.setFillColor(green)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(margin + 16, top - 21, "BEFORE SHARING")
    block.drawOn(pdf, margin + 16, top - 33 - box_text_height)
    top -= box_height

if top < 90:
    raise ValueError("Profile content exceeds the one-page CV layout; shorten the shared summary")
rule(61)
pdf.setFillColor(muted)
pdf.setFont("Helvetica", 8)
pdf.drawString(margin, 43, "Project profile - CV details unconfirmed" if profile["isPlaceholder"] else profile["name"])
pdf.drawRightString(width - margin, 43, "1 / 1")
pdf.save()

reader = PdfReader(str(output))
if len(reader.pages) != 1:
    raise ValueError("The CV must contain exactly one page")
text = reader.pages[0].extract_text()
for value in [profile[field] for field in ("name", "role", "experience", "availability", "email", "github")] + profile["coreStack"]:
    if value not in text:
        raise ValueError(f"Expected profile value missing from the PDF: {value}")
with pymupdf.open(output) as document:
    document[0].get_pixmap(matrix=pymupdf.Matrix(1.6, 1.6), alpha=False).save(preview)
print(f"Generated {output.relative_to(root)} ({output.stat().st_size:,} bytes, 1 page)")
print(f"Preview: {preview.relative_to(root)}")
