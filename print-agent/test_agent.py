import unittest
import os
import fitz # PyMuPDF
from document_processor import DocumentProcessor
from printer_service import PrinterService

class TestPrintAgent(unittest.TestCase):
    def setUp(self):
        # Create a small dummy PDF using PyMuPDF
        self.test_pdf = "test_doc_sample.pdf"
        self.output_pdf = "test_doc_sample_out.pdf"

        doc = fitz.open()
        for i in range(5):
            page = doc.new_page(width=595, height=842) # A4
            page.insert_text((50, 100), f"PrintFlow Unit Test Page {i+1}", fontsize=18)
        doc.save(self.test_pdf)
        doc.close()

    def tearDown(self):
        for f in [self.test_pdf, self.output_pdf]:
            if os.path.exists(f):
                os.remove(f)

    def test_custom_page_slicing(self):
        result = DocumentProcessor.inspect_and_prepare_pdf(self.test_pdf, self.output_pdf, custom_range="2-4")
        self.assertEqual(result["total_original_pages"], 5)
        self.assertEqual(result["processed_pages"], 3)

        out_doc = fitz.open(self.output_pdf)
        self.assertEqual(out_doc.page_count, 3)
        out_doc.close()

    def test_printer_discovery(self):
        printers = PrinterService.get_installed_printers()
        self.assertIsInstance(printers, list)
        self.assertGreater(len(printers), 0)

if __name__ == "__main__":
    unittest.main()
