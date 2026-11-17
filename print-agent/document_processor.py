import os
import fitz # PyMuPDF
from PIL import Image
import logging

logger = logging.getLogger("DocumentProcessor")

class DocumentProcessor:
    @staticmethod
    def inspect_and_prepare_pdf(input_path: str, output_path: str, custom_range: str = None) -> dict:
        """
        Validates PDF, slices requested page range, and prepares sanitized output PDF.
        """
        doc = fitz.open(input_path)
        total_pages = doc.page_count

        pages_to_keep = []
        if custom_range and custom_range.strip():
            parts = custom_range.split(",")
            for p in parts:
                p = p.strip()
                if "-" in p:
                    s_str, e_str = p.split("-")
                    start, end = int(s_str.strip()), int(e_str.strip())
                    for i in range(max(1, start), min(total_pages, end) + 1):
                        pages_to_keep.append(i - 1)
                else:
                    val = int(p)
                    if 1 <= val <= total_pages:
                        pages_to_keep.append(val - 1)
        else:
            pages_to_keep = list(range(total_pages))

        # Deduplicate & sort
        pages_to_keep = sorted(list(set(pages_to_keep)))

        new_doc = fitz.open()
        for p_no in pages_to_keep:
            new_doc.insert_pdf(doc, from_page=p_no, to_page=p_no)

        new_doc.save(output_path)
        new_doc.close()
        doc.close()

        logger.info(f"Prepared PDF: {len(pages_to_keep)} pages exported to {output_path}")

        return {
            "total_original_pages": total_pages,
            "processed_pages": len(pages_to_keep),
            "output_path": output_path,
        }

    @staticmethod
    def process_image(input_path: str, output_path: str) -> dict:
        """
        Opens and optimizes image using Pillow.
        """
        with Image.open(input_path) as img:
            width, height = img.size
            img = img.convert("RGB")
            img.save(output_path, "JPEG", quality=95)

        return {
            "width": width,
            "height": height,
            "output_path": output_path,
        }
