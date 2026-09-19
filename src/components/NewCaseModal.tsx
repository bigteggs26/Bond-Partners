import React, { useState, useEffect } from 'react';
import { supabase, STORAGE_BUCKET, MAX_FILE_SIZE_BYTES, formatBytes } from '../lib/supabase';
import { Profile, CaseStage, CASE_STAGES } from '../types';
import {
  X,
  Upload,
  Calendar,
  Briefcase,
  FileText,
  UserCheck,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCaseId: string) => void;
  lawyers: Profile[];
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lawyers,
}) => {
  const [caseName, setCaseName] = useState('');
  const [caseDate, setCaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [stage, setStage] = useState<CaseStage>('Active');
  const [assignedLawyerId, setAssignedLawyerId] = useState<string>('');

  // Files
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCaseName('');
      setCaseDate(new Date().toISOString().split('T')[0]);
      setStage('Active');
      setAssignedLawyerId(lawyers.length > 0 ? lawyers[0].id : '');
      setPhotoFile(null);
      setPhotoPreview(null);
      setAttachedFiles([]);
      setErrorMsg(null);
      setUploadProgress(null);
    }
  }, [isOpen, lawyers]);

  if (!isOpen) return null;

  // Handle Photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(
        `Case photo exceeds the 50MB limit (${formatBytes(file.size)}). Please select an image under 50MB.`
      );
      e.target.value = '';
      return;
    }

    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
  };

  // Handle Document selection
  const handleDocumentsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      setErrorMsg(
        `File "${oversized[0].name}" exceeds the 50MB limit (${formatBytes(
          oversized[0].size
        )}). Maximum allowed size is 50MB per file.`
      );
      e.target.value = '';
      return;
    }

    setAttachedFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!caseName.trim()) {
      setErrorMsg('Please specify a Case Name.');
      return;
    }
    if (!caseDate) {
      setErrorMsg('Please select a Case Date.');
      return;
    }

    setLoading(true);
    setUploadProgress('Preparing case filing...');

    try {
      let uploadedPhotoUrl: string | null = null;

      // 1. Upload photo if selected
      if (photoFile) {
        setUploadProgress('Uploading case thumbnail/photo...');
        const fileExt = photoFile.name.split('.').pop() || 'jpg';
        const photoPath = `case-photos/${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}.${fileExt}`;

        const { error: photoUploadErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(photoPath, photoFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (photoUploadErr) {
          throw new Error(`Photo upload failed: ${photoUploadErr.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(photoPath);

        uploadedPhotoUrl = publicUrlData.publicUrl;
      }

      // 2. Insert case row into `cases`
      setUploadProgress('Creating case docket entry in database...');
      const { data: newCaseData, error: caseInsertErr } = await supabase
        .from('cases')
        .insert([
          {
            case_name: caseName.trim(),
            case_date: caseDate,
            stage: stage,
            assigned_lawyer_id: assignedLawyerId || null,
            photo_url: uploadedPhotoUrl,
          },
        ])
        .select()
        .single();

      if (caseInsertErr) {
        throw new Error(`Failed to create case: ${caseInsertErr.message}`);
      }

      const caseId = newCaseData.id;

      // 3. Upload attached documents if any
      if (attachedFiles.length > 0) {
        for (let i = 0; i < attachedFiles.length; i++) {
          const doc = attachedFiles[i];
          setUploadProgress(`Uploading document ${i + 1} of ${attachedFiles.length}: "${doc.name}"...`);

          const sanitizedName = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const docPath = `documents/${caseId}/${Date.now()}_${sanitizedName}`;

          const { error: docUploadErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(docPath, doc, {
              cacheControl: '3600',
              upsert: false,
            });

          if (docUploadErr) {
            console.error('Error uploading document:', docUploadErr);
            throw new Error(`Document upload failed for "${doc.name}": ${docUploadErr.message}`);
          }

          const { data: docUrlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(docPath);

          // Insert into `case_files`
          const { error: fileRowErr } = await supabase.from('case_files').insert([
            {
              case_id: caseId,
              file_name: doc.name,
              file_url: docUrlData.publicUrl,
              uploaded_at: new Date().toISOString(),
            },
          ]);

          if (fileRowErr) {
            console.warn('Could not insert case_file record:', fileRowErr);
          }
        }
      }

      setUploadProgress('Docket registered successfully!');
      onSuccess(caseId);
      onClose();
    } catch (err: any) {
      console.error('Case creation error:', err);
      setErrorMsg(err.message || 'Failed to file new case. Please check connections.');
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#131620] border border-[#2d3448] rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222738] bg-[#0e1017]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#c5a059]/15 border border-[#c5a059]/30 text-[#e5c378]">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-lg font-bold text-slate-100"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                + File New Case
              </h2>
              <p className="text-xs text-slate-400">
                Authorized Managing Partner Docket Entry (Real-time live sync across firm)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1f2433] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Row 1: Case Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Case Name / Matter Title <span className="text-[#c5a059]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. State v. Alexander Vance, or Meridian Corp vs. Apex Tech"
              value={caseName}
              onChange={(e) => setCaseName(e.target.value)}
              className="w-full bg-[#0a0c12] border border-[#2a3042] rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059]"
            />
          </div>

          {/* Row 2: Date & Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Case Date <span className="text-[#c5a059]">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={caseDate}
                  onChange={(e) => setCaseDate(e.target.value)}
                  className="w-full bg-[#0a0c12] border border-[#2a3042] rounded-lg pl-9.5 pr-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Initial Stage <span className="text-[#c5a059]">*</span>
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as CaseStage)}
                className="w-full bg-[#0a0c12] border border-[#2a3042] rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059]"
              >
                {CASE_STAGES.map((s) => (
                  <option key={s} value={s} className="bg-[#131620] text-slate-100">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Assigned Lawyer */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Assigned Lawyer
              </label>
              <span className="text-[11px] text-slate-400">
                Populated from registered lawyers in directory
              </span>
            </div>
            <div className="relative">
              <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <select
                value={assignedLawyerId}
                onChange={(e) => setAssignedLawyerId(e.target.value)}
                className="w-full bg-[#0a0c12] border border-[#2a3042] rounded-lg pl-9.5 pr-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059]"
              >
                <option value="">-- No specific lawyer assigned (Unassigned) --</option>
                {lawyers.map((lawyer) => (
                  <option key={lawyer.id} value={lawyer.id} className="bg-[#131620] text-slate-100">
                    {lawyer.name} ({lawyer.role === 'boss' ? 'Managing Partner' : 'Lawyer'})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Note: Assigning a lawyer tags responsible counsel. All lawyers and partners can view every case in real-time.
            </p>
          </div>

          {/* Row 4: Case Photo Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Case Photo / Thumbnail (Max 50MB)
            </label>
            <div className="flex items-start gap-4">
              {photoPreview ? (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-[#c5a059]/40 bg-black shrink-0">
                  <img
                    src={photoPreview}
                    alt="Case Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                    }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-slate-200 hover:text-white"
                    title="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg border border-dashed border-[#31384c] flex flex-col items-center justify-center text-slate-500 bg-[#0a0c12] shrink-0">
                  <ImageIcon className="w-7 h-7 mb-1 text-slate-600" />
                  <span className="text-[10px]">No Photo</span>
                </div>
              )}

              <div className="flex-1">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1a1e2a] hover:bg-[#232838] text-slate-200 border border-[#2d3448] cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-[#c5a059]" />
                  <span>{photoPreview ? 'Change Photo' : 'Select Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Supported formats: JPG, PNG, WEBP. Maximum 50MB. Uploads securely to the{' '}
                  <code className="text-[#e5c378] text-[10px]">{STORAGE_BUCKET}</code> bucket.
                </p>
              </div>
            </div>
          </div>

          {/* Row 5: Attach Documents */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Attach Initial Documents / Evidence (Max 50MB per file)
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-[#e5c378] hover:underline cursor-pointer font-medium">
                <Upload className="w-3 h-3" />
                <span>+ Add Files</span>
                <input
                  type="file"
                  multiple
                  onChange={handleDocumentsSelect}
                  className="hidden"
                />
              </label>
            </div>

            {attachedFiles.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-[#292f40] bg-[#0b0d14] text-center text-xs text-slate-500">
                No initial files attached yet. (Documents can also be added anytime after filing by either the Boss or Lawyers).
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {attachedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#0e111a] border border-[#252b3d] text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-[#c5a059] shrink-0" />
                      <span className="truncate text-slate-200 font-medium">{file.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        ({formatBytes(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachedFile(idx)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Progress state */}
          {uploadProgress && (
            <div className="p-3 rounded-lg bg-[#181c28] border border-[#c5a059]/30 text-xs text-[#faebd0] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#c5a059]" />
              <span>{uploadProgress}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[#222738] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#1e2332] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold tracking-wide bg-gradient-to-r from-[#d4af37] via-[#c5a059] to-[#a38035] hover:brightness-110 active:brightness-95 text-[#0d0f15] shadow-lg shadow-[#c5a059]/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Filing Case...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Create & Publish Docket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
