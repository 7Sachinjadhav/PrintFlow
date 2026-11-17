import sys
import logging
from typing import List, Dict, Any, Optional

try:
    import win32print
    import win32ui
    from PIL import Image, ImageWin
    WIN32_AVAILABLE = True
except ImportError:
    WIN32_AVAILABLE = False

logger = logging.getLogger("PrinterService")

class PrinterService:
    @staticmethod
    def get_installed_printers() -> List[str]:
        """
        Discovers all installed local and network printers in Windows Print Spooler.
        """
        if not WIN32_AVAILABLE:
            logger.warning("win32print not available on non-Windows environment. Returning virtual queues.")
            return ["Konica 251 (Virtual)", "Canon 240 (Virtual)", "Microsoft Print to PDF"]

        try:
            flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
            printers = win32print.EnumPrinters(flags)
            return [p[2] for p in printers]
        except Exception as e:
            logger.error(f"Error enumerating Windows printers: {e}")
            return []

    @staticmethod
    def get_default_printer() -> Optional[str]:
        if not WIN32_AVAILABLE:
            return "Konica 251 (Virtual)"
        try:
            return win32print.GetDefaultPrinter()
        except Exception:
            return None

    @staticmethod
    def get_printer_status(queue_name: str) -> Dict[str, Any]:
        """
        Queries Windows printer status flags and job count.
        """
        if not WIN32_AVAILABLE:
            return {"status": "ONLINE", "jobs_count": 0, "is_online": True}

        handle = None
        try:
            handle = win32print.OpenPrinter(queue_name)
            info = win32print.GetPrinter(handle, 2)
            cjobs = info.get("cJobs", 0)
            status_flags = info.get("Status", 0)

            is_offline = bool(status_flags & win32print.PRINTER_STATUS_NOT_AVAILABLE or
                              status_flags & win32print.PRINTER_STATUS_OFFLINE or
                              status_flags & win32print.PRINTER_STATUS_ERROR)

            return {
                "status": "OFFLINE" if is_offline else ("BUSY" if cjobs > 0 else "ONLINE"),
                "jobs_count": cjobs,
                "is_online": not is_offline,
                "status_code": status_flags,
            }
        except Exception as e:
            return {"status": "OFFLINE", "jobs_count": 0, "is_online": False, "error": str(e)}
        finally:
            if handle:
                try:
                    win32print.ClosePrinter(handle)
                except Exception:
                    pass

    @staticmethod
    def print_file_physical(queue_name: str, file_path: str, doc_name: str = "PrintFlow Job") -> int:
        """
        Dispatches file to Windows Print Spooler. Returns Windows Spooler Job ID.
        """
        if not WIN32_AVAILABLE:
            raise RuntimeError("Windows win32print is required for physical printing.")

        handle = win32print.OpenPrinter(queue_name)
        try:
            job_id = win32print.StartDocPrinter(handle, 1, (doc_name, None, "RAW"))
            win32print.StartPagePrinter(handle)

            with open(file_path, "rb") as f:
                while chunk := f.read(65536):
                    win32print.WritePrinter(handle, chunk)

            win32print.EndPagePrinter(handle)
            win32print.EndDocPrinter(handle)
            logger.info(f"Successfully submitted job #{job_id} to queue '{queue_name}'")
            return job_id
        finally:
            win32print.ClosePrinter(handle)
