import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Trash2,
  AlertCircle,
  ArrowRight,
  Plus,
  Loader2,
  FileCheck,
} from 'lucide-react';
import { CustomerHeader } from '../../components/CustomerHeader';
import { StepIndicator } from '../../components/StepIndicator';
import { api } from '../../services/api';
import { UploadedFileItem } from '../../types';

interface UploadPageProps {
  files: UploadedFileItem[];
  setFiles: React.Dispatch<React.SetStateAction<UploadedFileItem[]>>;
}

export const UploadPage: React.FC<UploadPageProps> = ({ files, setFiles }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileSelection = async (selectedFileList: FileList | null) => {
    if (!selectedFileList || selectedFileList.length === 0) return;

    setErrorMsg(null);
    setUploading(true);

    try {
      const formData = new FormData();
      for (let i = 0; i < selectedFileList.length; i++) {
        formData.append('files', selectedFileList[i]);
      }

      // Upload to backend to validate and extract accurate PDF page counts
      const res = await api.uploadFiles(formData);

      const newUploadedItems: UploadedFileItem[] = res.map((item: any, idx: number) => {
        const fileObj = selectedFileList[idx];
        return {
          tempId: item.tempId,
          originalFilename: item.originalFilename,
          storedFilename: item.storedFilename,
          fileSizeBytes: item.fileSizeBytes,
          mimeType: item.mimeType,
          pageCount: item.pageCount || 1,
          file: fileObj,
          previewUrl: item.storedFilename ? `/api/documents/preview/${item.storedFilename}` : undefined,
          setting: {
            colorMode: 'BW',
            paperSize: 'A4',
            duplexMode: 'SINGLE',
            orientation: 'PORTRAIT',
            copies: 1,
            pageRangeType: 'ALL',
            bindingService: 'NONE',
            laminationService: false,
          },
        };
      });

      setFiles((prev) => [...prev, ...newUploadedItems]);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload document. Please ensure valid PDF or image file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <CustomerHeader />
      <StepIndicator currentStep={1} />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-5 space-y-5">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Upload Documents</h1>
          <p className="text-xs text-slate-500 mt-1">
            Upload PDF documents or images (JPG, PNG). You can add multiple files.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Dropzone Container */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/30 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 group"
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            {uploading ? (
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            ) : (
              <UploadCloud className="w-7 h-7 text-indigo-600" />
            )}
          </div>

          <div>
            <div className="text-sm font-bold text-slate-800">
              {uploading ? 'Processing & Counting Pages...' : 'Tap to browse files or drop here'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Supports PDF, JPG, PNG up to 25 MB</div>
          </div>

          <button
            type="button"
            disabled={uploading}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition"
          >
            Select Documents
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => handleFileSelection(e.target.files)}
          />
        </div>

        {/* Uploaded Files List */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Uploaded Files ({files.length})
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Add More
              </button>
            </div>

            <div className="space-y-2">
              {files.map((file, idx) => (
                <div
                  key={file.tempId || idx}
                  className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    {file.mimeType.includes('pdf') ? (
                      <FileText className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-indigo-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{file.originalFilename}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                      <span>{formatFileSize(file.fileSizeBytes)}</span>
                      <span>•</span>
                      <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                        {file.pageCount} {file.pageCount === 1 ? 'Page' : 'Pages'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={files.length === 0 || uploading}
            onClick={() => navigate('/settings')}
            className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition ${
              files.length > 0 && !uploading
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Configure Print Settings</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
};
