import os
import time
import sys
import logging
from config import Config
from printer_service import PrinterService
from document_processor import DocumentProcessor
from api_client import ApiClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger("PrintAgent")

def run_agent():
    logger.info("==================================================")
    logger.info("🖨️  PrintFlow Windows 11 Local Print Agent")
    logger.info(f"    Mode: {'SAFE SIMULATION (No paper waste)' if Config.SIMULATION_MODE else 'LIVE PHYSICAL PRINTING'}")
    logger.info(f"    Backend: {Config.BACKEND_URL}")
    logger.info("==================================================")

    # Ensure downloads directory exists
    os.makedirs(Config.TEMP_DOWNLOAD_DIR, exist_ok=True)

    client = ApiClient()
    connected = False

    while not connected:
        logger.info("Connecting to PrintFlow backend...")
        if client.register():
            connected = True
            break
        logger.warning(f"Backend unreachable. Retrying in {Config.POLL_INTERVAL_SECONDS} seconds...")
        time.sleep(Config.POLL_INTERVAL_SECONDS)

    # Discover and sync local Windows printers
    printers = PrinterService.get_installed_printers()
    logger.info(f"Discovered {len(printers)} installed Windows printers:")
    for p in printers:
        logger.info(f"  • {p}")

    client.sync_printers(printers)

    last_heartbeat = 0
    logger.info("Agent is online and polling queue for print jobs...")

    try:
        while True:
            now = time.time()
            if now - last_heartbeat >= Config.HEARTBEAT_INTERVAL_SECONDS:
                client.send_heartbeat(discovered_printers=printers)
                last_heartbeat = now

            # Poll for next compatible job
            claim_data = client.claim_next_job()
            if claim_data:
                job = claim_data.get("job")
                lease_token = claim_data.get("leaseToken")
                job_id = job.get("id")
                token_num = job.get("tokenNumber")
                doc_name = job.get("documentFilename")
                printer_info = job.get("printer", {})
                queue_name = printer_info.get("windowsQueueName") or "Default"
                settings = job.get("settings", {})

                logger.info(f"--------------------------------------------------")
                logger.info(f"📥 CLAIMED JOB #{job_id}")
                logger.info(f"   Token: {token_num} | Document: {doc_name}")
                logger.info(f"   Target Queue: {queue_name} | Color: {settings.get('colorMode')} | Paper: {settings.get('paperSize')}")

                # Report PRINTING status
                client.update_job_status(job_id, "PRINTING", lease_token=lease_token)

                # Download file
                temp_input = os.path.join(Config.TEMP_DOWNLOAD_DIR, f"in_{job_id}_{doc_name}")
                temp_output = os.path.join(Config.TEMP_DOWNLOAD_DIR, f"out_{job_id}_{doc_name}")

                download_ok = client.download_document(job.get("documentId"), lease_token, temp_input)
                if not download_ok:
                    logger.error("Download failed! Marking job NEEDS_REVIEW")
                    client.update_job_status(job_id, "NEEDS_REVIEW", error_msg="Document download failed from storage")
                    continue

                # Process PDF or image (slice page ranges, check orientation)
                try:
                    custom_range = settings.get("customRange") if settings.get("pageRangeType") == "CUSTOM" else None
                    if doc_name.lower().endswith(".pdf"):
                        DocumentProcessor.inspect_and_prepare_pdf(temp_input, temp_output, custom_range)
                    else:
                        DocumentProcessor.process_image(temp_input, temp_output)
                except Exception as proc_err:
                    logger.error(f"Document processing error: {proc_err}")
                    client.update_job_status(job_id, "NEEDS_REVIEW", error_msg=f"Processing error: {proc_err}")
                    continue

                # Execute Print (Simulation or Physical Spooler)
                if Config.SIMULATION_MODE:
                    logger.info(f"⚙️  [SIMULATION] Processing document: {doc_name} for printer {queue_name}...")
                    time.sleep(2) # Simulate high-speed print transmission
                    logger.info(f"✅ [SIMULATION] Print simulated successfully for Token {token_num}")
                    client.update_job_status(job_id, "PRINTED", lease_token=lease_token)
                else:
                    try:
                        logger.info(f"🖨️  Dispatching to physical Windows queue: '{queue_name}'")
                        spooler_job_id = PrinterService.print_file_physical(queue_name, temp_output, doc_name=f"PF_{token_num}")
                        logger.info(f"✅ Submitted to Windows Spooler. Spooler Job ID: {spooler_job_id}")
                        client.update_job_status(job_id, "SUBMITTED_TO_PRINTER", spooler_job_id=spooler_job_id)
                    except Exception as print_err:
                        logger.error(f"Spooler error: {print_err}")
                        client.update_job_status(job_id, "FAILED", error_msg=str(print_err))

                # Clean temporary processed files
                try:
                    if os.path.exists(temp_input): os.remove(temp_input)
                    if os.path.exists(temp_output): os.remove(temp_output)
                except Exception:
                    pass

                logger.info(f"Job #{job_id} workflow completed.")
                logger.info(f"--------------------------------------------------")

            time.sleep(Config.POLL_INTERVAL_SECONDS)

    except KeyboardInterrupt:
        logger.info("Print Agent shutting down gracefully.")

if __name__ == "__main__":
    run_agent()
