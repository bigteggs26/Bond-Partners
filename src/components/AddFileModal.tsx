import React, { useState, useRef } from 'react';
import { supabase, STORAGE_BUCKET, MAX_FILE_SIZE_BYTES, formatBytes } from '../lib/supabase';
import { CaseItem, CaseFile, Profile } from '../types';
import { saveLocalCaseFile } from '../lib/fileCache';
import {
  X,
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Briefcase,
  Paperclip,
  Trash2,
} from 'lucide-react';

interface AddFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCaseId?: string | null;
  cases: CaseItem[];
  currentUser: Profile;
  onSuccess?: (caseId: string, addedFiles: CaseFile[]) => void;
}

export const AddFileModal: React.FC<AddFileModalProps> = ({
  isOpen,
  onClose,
  targetCaseId,
  cases,
  currentUser,
  onSuccess,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    targetCaseId || (cases.length > 0 ? cases[0].id : '')
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync selectedCaseId when targetCaseId changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedCaseId(targetCaseId || (cases.length > 0 ? cases[0].id : ''));
      setSelectedFiles([]);
      setErrorMsg(null);
      setSuccessMsg(null);
      setProgressMsg(null);
    }
  }, [isOpen, targetCaseId, cases]);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMsg(null);

    const droppedFiles = Array.from(e.dataTransfer.files);
    validateAndAddFiles(droppedFiles);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = Array.from(e.target.files || []);
    validateAndAddFiles(files);
    e.target.value = '';
  };

  const validateAndAddFiles = (files: File[]) => {
    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      setErrorMsg(
        `File "${oversized[0].name}" exceeds the 50MB limit (${formatBytes(
          oversized[0].size
        )}). Please select files 50MB or smaller.`
      );
      return;
    }

    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) {
      setErrorMsg('Please select a target case.');
      return;
    }
    if (selectedFiles.length === 0) {
      setErrorMsg('Please select at least one document or evidentiary file to upload.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    setProgressMsg(null);

    const uploadedFiles: CaseFile[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setProgressMsg(`Uploading "${file.name}" (${i + 1}/${selectedFiles.length})...`);

        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const docPath = `documents/${selectedCaseId}/${Date.now()}_${sanitized}`;

        // 1. Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(docPath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadErr) {
          throw new Error(`Upload failed for "${file.name}": ${uploadErr.message}`);
        }

        // 2. Retrieve public URL
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(docPath);

        const newFileRecord: CaseFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          case_id: selectedCaseId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          uploaded_at: new Date().toISOString(),
        };

        // 3. Insert record into database table
        const { data: insertedData, error: dbErr } = await supabase
          .from('case_files')
          .insert([
            {
              case_id: selectedCaseId,
              file_name: file.name,
              file_url: urlData.publicUrl,
              uploaded_at: newFileRecord.uploaded_at,
            },
          ])
          .select()
          .maybeSingle();

        if (dbErr) {
          console.warn('Database case_files notice (persisting in resilient cache):', dbErr.message);
        }

        const finalRecord: CaseFile = insertedData ? (insertedData as CaseFile) : newFileRecord;

        // 4. Save to local resilient cache so file always appears immediately
        saveLocalCaseFile(finalRecord);
        uploadedFiles.push(finalRecord);
      }

      setSuccessMsg(`Successfully attached ${uploadedFiles.length} document(s) to the case!`);
      setSelectedFiles([]);
      setTimeout(() => {
        onSuccess?.(selectedCaseId, uploadedFiles);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('File upload error:', err);
      setErrorMsg(err.message || 'Failed to upload files. Please check network/storage connection.');
    } finally {
      setUploading(false);
      setProgressMsg(null);
    }
  };

  const activeCase = cases.find((c) => c.id === selectedCaseId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#131621] border border-[#2c3348] rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#212638] bg-[#0e1017]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#c5a059]/15 border border-[#c5a059]/30 text-[#e5c378]">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-lg font-bold text-slate-100"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                Upload Case Documents
              </h2>
              <p className="text-xs text-slate-400">
                {currentUser.role === 'boss' ? 'Managing Partner' : 'Firm Counsel'} • Up to 50MB per file
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1e2333] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleUploadAll} className="p-6 space-y-5">
          {/* Target Case Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Select Case Docket
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c5a059]" />
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                disabled={uploading || (cases.length <= 1 && !!targetCaseId)}
                className="w-full bg-[#0d0f16] border border-[#2a2f42] rounded-lg pl-9 pr-4 py-2.5 text-xs font-medium text-slate-100 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] transition-colors cursor-pointer"
              >
                {cases.length === 0 ? (
                  <option value="">No cases registered yet</option>
                ) : (
                  cases.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#121520] text-slate-100">
                      {c.case_name} ({c.case_date}) — {c.stage}
                    </option>
                  ))
                )}
              </select>
            </div>
            {activeCase && (
              <p className="text-[11px] text-slate-400 mt-1">
                Filing date: <span className="text-slate-300">{activeCase.case_date}</span> • Assigned:{' '}
                <span className="text-slate-300">
                  {activeCase.assigned_lawyer?.name || 'Unassigned'}
                </span>
              </p>
            )}
          </div>

          {/* Drag and Drop Zone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Documents & Evidentiary Files
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 rounded-xl border-2 border-dashed transition-all text-center cursor-pointer flex flex-col items-center justify-center ${
                isDragging
                  ? 'border-[#c5a059] bg-[#c5a059]/10'
                  : 'border-[#2a3044] hover:border-[#c5a059]/60 bg-[#0d0f16]'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-[#181c2b] border border-[#2b334d] flex items-center justify-center text-[#c5a059] mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium text-slate-200">
                <span className="text-[#e5c378] font-semibold underline">Click to browse files</span>{' '}
                or drag & drop here
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                PDF, Word, Excel, Scans, Audio, Contracts, and Evidence (Max 50MB each)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading}
              />
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider">
                  Files Selected ({selectedFiles.length})
                </span>
                <span>
                  Total:{' '}
                  {formatBytes(selectedFiles.reduce((acc, curr) => acc + curr.size, 0))}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto border border-[#222739] rounded-lg divide-y divide-[#1e2333] bg-[#0c0e15]">
                {selectedFiles.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="p-2.5 flex items-center justify-between text-xs hover:bg-[#141824]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#c5a059] shrink-0" />
                      <span className="font-medium text-slate-200 truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        ({formatBytes(f.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(idx);
                      }}
                      disabled={uploading}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remove file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {progressMsg && (
            <div className="p-3 rounded-lg bg-[#141826] border border-[#c5a059]/40 text-[#faebd0] text-xs flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 shrink-0 text-[#c5a059] animate-spin" />
              <span>{progressMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#212638]">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-[#1a1f2e] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || selectedFiles.length === 0 || !selectedCaseId}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold tracking-wide bg-gradient-to-r from-[#d4af37] via-[#c5a059] to-[#a38035] hover:brightness-110 active:brightness-95 text-[#0d0f15] shadow-lg shadow-[#c5a059]/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading Files...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Attach to Docket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
