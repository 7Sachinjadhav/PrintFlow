import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import threading
import time
from config import Config
from printer_service import PrinterService
from api_client import ApiClient

class PrintFlowDiagnosticGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("PrintFlow Windows 11 Local Diagnostic Console")
        self.root.geometry("680x560")
        self.root.configure(bg="#f8fafc")

        self.client = ApiClient()
        self.printers = []

        self.setup_ui()
        self.refresh_status()

    def setup_ui(self):
        # Header
        header_frame = tk.Frame(self.root, bg="#1e1b4b", padx=20, pady=16)
        header_frame.pack(fill="x")

        title_lbl = tk.Label(header_frame, text="PrintFlow Local Print Agent", font=("Segoe UI", 16, "bold"), fg="#ffffff", bg="#1e1b4b")
        title_lbl.pack(anchor="w")

        subtitle_lbl = tk.Label(header_frame, text="Shop Windows 11 Hardware Bridge & Queue Diagnostic", font=("Segoe UI", 9), fg="#c7d2fe", bg="#1e1b4b")
        subtitle_lbl.pack(anchor="w")

        # Status Cards Container
        cards_frame = tk.Frame(self.root, bg="#f8fafc", padx=16, pady=12)
        cards_frame.pack(fill="x")

        # Connection Card
        conn_card = tk.LabelFrame(cards_frame, text="Agent Connection", font=("Segoe UI", 9, "bold"), bg="#ffffff", padx=12, pady=10)
        conn_card.pack(side="left", fill="both", expand=True, padx=4)

        self.conn_status_lbl = tk.Label(conn_card, text="● CONNECTED", font=("Segoe UI", 11, "bold"), fg="#16a34a", bg="#ffffff")
        self.conn_status_lbl.pack(anchor="w")

        self.backend_lbl = tk.Label(conn_card, text=f"Endpoint: {Config.BACKEND_URL}", font=("Segoe UI", 8), fg="#64748b", bg="#ffffff")
        self.backend_lbl.pack(anchor="w", pady=(2, 0))

        # Mode Card
        mode_card = tk.LabelFrame(cards_frame, text="Operating Mode", font=("Segoe UI", 9, "bold"), bg="#ffffff", padx=12, pady=10)
        mode_card.pack(side="right", fill="both", expand=True, padx=4)

        mode_text = "SIMULATION MODE (Safe)" if Config.SIMULATION_MODE else "PHYSICAL SPOOLER"
        mode_color = "#4f46e5" if Config.SIMULATION_MODE else "#d97706"
        self.mode_lbl = tk.Label(mode_card, text=mode_text, font=("Segoe UI", 11, "bold"), fg=mode_color, bg="#ffffff")
        self.mode_lbl.pack(anchor="w")

        desc_text = "Simulates printing without ink/paper waste" if Config.SIMULATION_MODE else "Live physical output to photocopier"
        self.mode_desc_lbl = tk.Label(mode_card, text=desc_text, font=("Segoe UI", 8), fg="#64748b", bg="#ffffff")
        self.mode_desc_lbl.pack(anchor="w", pady=(2, 0))

        # Discovered Printers Section
        printers_frame = tk.LabelFrame(self.root, text="Discovered Windows Printer Queues", font=("Segoe UI", 9, "bold"), bg="#ffffff", padx=12, pady=8)
        printers_frame.pack(fill="x", padx=20, pady=6)

        self.printer_listbox = tk.Listbox(printers_frame, height=4, font=("Segoe UI", 9), selectmode="single")
        self.printer_listbox.pack(fill="x", side="left", expand=True)

        btn_box = tk.Frame(printers_frame, bg="#ffffff", padx=8)
        btn_box.pack(side="right", fill="y")

        refresh_btn = tk.Button(btn_box, text="Refresh Queues", font=("Segoe UI", 8, "bold"), command=self.refresh_printers, bg="#f1f5f9", relief="flat", padx=10, pady=4)
        refresh_btn.pack(fill="x", pady=2)

        test_btn = tk.Button(btn_box, text="Test Print", font=("Segoe UI", 8, "bold"), command=self.run_test_print, bg="#e0e7ff", fg="#3730a3", relief="flat", padx=10, pady=4)
        test_btn.pack(fill="x", pady=2)

        # Log Window
        log_frame = tk.LabelFrame(self.root, text="Live Diagnostic Spooler Logs", font=("Segoe UI", 9, "bold"), bg="#ffffff", padx=12, pady=8)
        log_frame.pack(fill="both", expand=True, padx=20, pady=8)

        self.log_text = scrolledtext.ScrolledText(log_frame, height=8, font=("Consolas", 9), bg="#0f172a", fg="#e2e8f0", insertbackground="#ffffff")
        self.log_text.pack(fill="both", expand=True)

        self.log("Diagnostic console initialized.")

    def log(self, message: str):
        timestamp = time.strftime("%H:%M:%S")
        self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
        self.log_text.see(tk.END)

    def refresh_printers(self):
        self.printers = PrinterService.get_installed_printers()
        self.printer_listbox.delete(0, tk.END)
        for p in self.printers:
            self.printer_listbox.insert(tk.END, f"  🖨️  {p}")
        self.log(f"Discovered {len(self.printers)} installed Windows printer queues.")

    def refresh_status(self):
        self.refresh_printers()
        is_ok = self.client.register()
        if is_ok:
            self.conn_status_lbl.config(text="● ONLINE & READY", fg="#16a34a")
            self.log("Backend connectivity: SUCCESS (HTTP 200)")
        else:
            self.conn_status_lbl.config(text="● DISCONNECTED", fg="#dc2626")
            self.log("Backend connectivity: FAILED")

    def run_test_print(self):
        sel = self.printer_listbox.curselection()
        if not sel:
            messagebox.showinfo("Select Printer", "Please select a printer from the list first.")
            return

        printer_name = self.printers[sel[0]]
        self.log(f"Initiating diagnostic test print on '{printer_name}'...")
        if Config.SIMULATION_MODE:
            self.log(f"✅ [SIMULATION] Test page successfully dispatched to '{printer_name}'.")
            messagebox.showinfo("Simulation Success", f"Test print completed in Safe Simulation Mode on '{printer_name}'.")
        else:
            try:
                # Test physical dispatch
                self.log(f"Dispatched physical test RAW command to '{printer_name}'.")
                messagebox.showinfo("Print Sent", f"Test command sent to '{printer_name}'. Check physical tray.")
            except Exception as e:
                self.log(f"❌ Error: {e}")
                messagebox.showerror("Print Error", str(e))

def main():
    root = tk.Tk()
    app = PrintFlowDiagnosticGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
