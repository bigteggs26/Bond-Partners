import React, { useState, useEffect, useRef } from 'react';
import { supabase, STORAGE_BUCKET, MAX_FILE_SIZE_BYTES, formatBytes } from '../lib/supabase';
import { CaseItem, CaseFile, Profile, CaseStage, CASE_STAGES } from '../types';
import { getStageConfig } from '../lib/stages';
import { mergeCaseFiles, saveLocalCaseFile, removeLocalCaseFile } from '../lib/fileCache';
import {
  X,
  Calendar,
  User,
  Upload,
  UploadCloud,
  Download,
  Trash2,
  Edit2,
  FileText,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldAlert,
  Save,
  Check,
  Image as ImageIcon,
} from 'lucide-react';

interface CaseDetailModalProps {
  caseId: string | null;
  currentUser: Profile;
  lawyers: Profile[];
  onClose: () => void;
  onCaseDeleted?: (deletedId: string) => void;
  onCaseUpdated?: (updatedCase: CaseItem) => void;
}

export const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  caseId,
  currentUser,
  lawyers,
  onClose,
  onCaseDeleted,
  onCaseUpdated,
}) => {
  const isBoss = currentUser.role === 'boss';

  const [currentCase, setCurrentCase] = useState<CaseItem | null>(null);
  const [files, setFiles] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit mode states (Boss only)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLawyerId, setEditLawyerId] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);

  // Document staging and upload state (Available to all firm members - exactly like NewCaseModal)
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadDocMsg, setUploadDocMsg] = useState<string | null>(null);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Delete case confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingCase, setIsDeletingCase] = useState(false);

  // File deletion state (Available to all firm members)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState<string | null>(null);

  // Fetch initial case data and files
  const loadCaseData = async () => {
    if (!caseId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: cData, error: cErr } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .maybeSingle();

      if (cErr) throw cErr;
      if (!cData) {
        throw new Error('Case not found.');
      }

      const assignedLawyer = lawyers.find((l) => l.id === cData.assigned_lawyer_id) || null;
      setCurrentCase({ ...cData, assigned_lawyer: assignedLawyer });

      setEditName(cData.case_name);
      setEditDate(cData.case_date);
      setEditLawyerId(cData.assigned_lawyer_id || '');

      // Load files with fallback to resilient local cache
      const { data: fData, error: fErr } = await supabase
        .from('case_files')
        .select('*')
        .eq('case_id', caseId)
        .order('uploaded_at', { ascending: false });

      if (fErr) {
        console.warn('Notice loading case_files (merging with cache):', fErr.message);
      }
      const combined = mergeCaseFiles(fData || [], caseId);
      setFiles(combined);
    } catch (err: any) {
      console.error('Error loading case detail:', err);
      setErrorMsg(err.message || 'Failed to load case data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadCaseData();
    }
  }, [caseId, lawyers]);

  // Realtime subscription for this specific case & files
  useEffect(() => {
    if (!caseId) return;

    const channel = supabase
      .channel(`case-detail-${caseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases',
          filter: `id=eq.${caseId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            setCurrentCase((prev) => {
              if (!prev) return null;
              const assigned = lawyers.find((l) => l.id === updated.assigned_lawyer_id) || null;
              return { ...prev, ...updated, assigned_lawyer: assigned };
            });
          } else if (payload.eventType === 'DELETE') {
            onCaseDeleted?.(caseId);
            onClose();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'case_files',
          filter: `case_id=eq.${caseId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setFiles((prev) => [payload.new as CaseFile, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setFiles((prev) => prev.filter((f) => f.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseId, lawyers]);

  if (!caseId) return null;

  // Updates Stage (Available to all counsel)
  const handleStageChange = async (newStage: CaseStage) => {
    if (!currentCase) return;
    setErrorMsg(null);

    // Optimistic update
    const previousStage = currentCase.stage;
    setCurrentCase({ ...currentCase, stage: newStage });

    try {
      const { error } = await supabase
        .from('cases')
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', currentCase.id);

      if (error) {
        // Rollback
        setCurrentCase({ ...currentCase, stage: previousStage });
        throw error;
      }
      onCaseUpdated?.({ ...currentCase, stage: newStage });
    } catch (err: any) {
      console.error('Failed to update stage:', err);
      setErrorMsg(`Failed to update case stage: ${err.message}`);
    }
  };

  // Saves edits (name, date, lawyer, photo - Available to all counsel)
  const handleSaveEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCase) return;
    setErrorMsg(null);
    setEditSaving(true);

    try {
      let photoUrl = currentCase.photo_url;

      if (newPhotoFile) {
        const fileExt = newPhotoFile.name.split('.').pop() || 'jpg';
        const photoPath = `case-photos/${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}.${fileExt}`;

        const { error: photoUploadErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(photoPath, newPhotoFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (photoUploadErr) throw photoUploadErr;

        const { data: publicUrlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(photoPath);

        photoUrl = publicUrlData.publicUrl;
      }

      const updates = {
        case_name: editName.trim(),
        case_date: editDate,
        assigned_lawyer_id: editLawyerId || null,
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedData, error: updateErr } = await supabase
        .from('cases')
        .update(updates)
        .eq('id', currentCase.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      const assignedLawyer = lawyers.find((l) => l.id === editLawyerId) || null;
      const updatedCaseObj = { ...currentCase, ...updatedData, assigned_lawyer: assignedLawyer };
      setCurrentCase(updatedCaseObj);
      onCaseUpdated?.(updatedCaseObj);

      setIsEditing(false);
      setNewPhotoFile(null);
      setNewPhotoPreview(null);
    } catch (err: any) {
      console.error('Error saving edits:', err);
      setErrorMsg(err.message || 'Failed to save case modifications.');
    } finally {
      setEditSaving(false);
    }
  };

  // Reusable document upload processor for both file picker and drag-and-drop
  const processDocumentFiles = async (selectedFiles: File[]) => {
    setErrorMsg(null);
    setUploadDocMsg(null);
    if (selectedFiles.length === 0 || !currentCase) return;

    // Check 50MB limit
    const oversized = selectedFiles.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      setErrorMsg(
        `File "${oversized[0].name}" exceeds the 50MB limit (${formatBytes(
          oversized[0].size
        )}). File uploads are strictly restricted to 50MB maximum.`
      );
      return;
    }

    setIsUploadingDoc(true);
    const uploadedRecords: CaseFile[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadDocMsg(`Uploading "${file.name}" (${i + 1}/${selectedFiles.length})...`);

        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const docPath = `documents/${currentCase.id}/${Date.now()}_${sanitized}`;

        const { error: uploadErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(docPath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadErr) {
          throw new Error(`Upload failed for "${file.name}": ${uploadErr.message}`);
        }

        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(docPath);

        const newRecord: CaseFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          case_id: currentCase.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          uploaded_at: new Date().toISOString(),
        };

        const { data: dbData, error: rowErr } = await supabase
          .from('case_files')
          .insert([
            {
              case_id: currentCase.id,
              file_name: file.name,
              file_url: urlData.publicUrl,
              uploaded_at: newRecord.uploaded_at,
            },
          ])
          .select()
          .maybeSingle();

        if (rowErr) {
          console.warn('File record insert notice (saved in local cache):', rowErr.message);
        }

        const finalRecord = (dbData as CaseFile) || newRecord;
        saveLocalCaseFile(finalRecord);
        uploadedRecords.push(finalRecord);
      }

      setUploadDocMsg('Upload complete!');
      setFiles((prev) => mergeCaseFiles([...uploadedRecords, ...prev], currentCase.id));

      // Refresh from server if available
      const { data: fData } = await supabase
        .from('case_files')
        .select('*')
        .eq('case_id', currentCase.id)
        .order('uploaded_at', { ascending: false });

      if (fData) {
        setFiles(mergeCaseFiles(fData, currentCase.id));
      }
    } catch (err: any) {
      console.error('Document upload error:', err);
      setErrorMsg(err.message || 'Failed to upload document.');
    } finally {
      setIsUploadingDoc(false);
      setTimeout(() => setUploadDocMsg(null), 2500);
    }
  };

  // Staging handlers (Identical to NewCaseModal flow)
  const handleDocumentsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const oversized = selected.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      setErrorMsg(
        `File "${oversized[0].name}" exceeds the 50MB limit (${formatBytes(
          oversized[0].size
        )}). Maximum allowed size is 50MB per file.`
      );
      e.target.value = '';
      return;
    }

    setStagedFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadStagedFiles = async () => {
    if (stagedFiles.length === 0 || !currentCase) return;
    await processDocumentFiles(stagedFiles);
    setStagedFiles([]);
  };

  // Delete a document (available to firm members)
  const handleDeleteFile = async (file: CaseFile) => {
    if (!currentCase) return;
    setDeletingFileId(file.id);
    setConfirmDeleteFileId(null);
    setErrorMsg(null);

    try {
      // 1. Delete row from `case_files`
      const { error: rowErr } = await supabase
        .from('case_files')
        .delete()
        .eq('id', file.id);

      if (rowErr) {
        console.warn('Database case_files delete notice:', rowErr.message);
      }

      // 2. Extract storage path from file_url and delete from storage
      try {
        const urlObj = new URL(file.file_url);
        const pathPart = urlObj.pathname.split(`${STORAGE_BUCKET}/`)[1];
        if (pathPart) {
          await supabase.storage.from(STORAGE_BUCKET).remove([decodeURIComponent(pathPart)]);
        }
      } catch (storageErr) {
        console.warn('Storage removal non-blocking notice:', storageErr);
      }

      // 3. Remove from local cache
      removeLocalCaseFile(currentCase.id, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id && f.file_url !== file.file_url));
    } catch (err: any) {
      console.error('Error deleting file:', err);
      setErrorMsg(err.message || 'Failed to delete file.');
    } finally {
      setDeletingFileId(null);
    }
  };

  // Deletes entire case
  const handleDeleteCase = async () => {
    if (!currentCase) return;
    setIsDeletingCase(true);
    setErrorMsg(null);

    try {
      // 1. Delete case files records
      await supabase.from('case_files').delete().eq('case_id', currentCase.id);

      // 2. Delete case record
      const { error: caseDeleteErr } = await supabase
        .from('cases')
        .delete()
        .eq('id', currentCase.id);

      if (caseDeleteErr) throw caseDeleteErr;

      onCaseDeleted?.(currentCase.id);
      onClose();
    } catch (err: any) {
      console.error('Error deleting case:', err);
      setErrorMsg(err.message || 'Failed to delete case.');
      setIsDeletingCase(false);
    }
  };

  const stageCfg = currentCase ? getStageConfig(currentCase.stage) : getStageConfig('Active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#12151e] border border-[#2b3145] rounded-2xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#212638] bg-[#0d0f16] shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="text-xs uppercase tracking-[0.2em] font-bold text-[#c5a059]"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Case Docket File
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-400 font-mono">
              ID: {currentCase?.id.slice(0, 8)}...
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1f2d] hover:bg-[#23293c] text-slate-200 border border-[#2e364a] hover:border-[#c5a059]/60 transition-colors cursor-pointer"
                title="Edit case title, date, photo, or counsel"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#c5a059]" />
                <span className="hidden sm:inline">Edit Details</span>
              </button>
            )}

            {!isEditing && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                title="Delete Case Docket"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-[#1f2433] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#c5a059]" />
            <span className="text-sm font-medium">Retrieving case docket...</span>
          </div>
        ) : !currentCase ? (
          <div className="p-12 text-center text-slate-400">
            Case information is unavailable or has been removed.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Overview Section */}
            {isEditing ? (
              /* BOSS EDIT FORM */
              <form
                onSubmit={handleSaveEdits}
                className="p-5 rounded-xl bg-[#0c0e14] border border-[#272d3f] space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#1f2434]">
                  <h3 className="text-sm font-bold text-[#e5c378] uppercase tracking-wider flex items-center gap-2">
                    <Edit2 className="w-4 h-4" /> Edit Case Particulars
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setNewPhotoFile(null);
                      setNewPhotoPreview(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Case Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#12151e] border border-[#2b3145] rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#c5a059]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Case Date
                    </label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-[#12151e] border border-[#2b3145] rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#c5a059]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Assigned Lawyer
                    </label>
                    <select
                      value={editLawyerId}
                      onChange={(e) => setEditLawyerId(e.target.value)}
                      className="w-full bg-[#12151e] border border-[#2b3145] rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-[#c5a059]"
                    >
                      <option value="">-- Unassigned --</option>
                      {lawyers.map((l) => (
                        <option key={l.id} value={l.id} className="bg-[#12151e]">
                          {l.name} ({l.role === 'boss' ? 'Managing Partner' : 'Lawyer'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Replace Photo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Replace Case Photo (Max 50MB)
                  </label>
                  <div className="flex items-center gap-3">
                    {newPhotoPreview ? (
                      <img
                        src={newPhotoPreview}
                        alt="New Preview"
                        className="w-14 h-14 rounded-lg object-cover border border-[#c5a059]"
                      />
                    ) : currentCase.photo_url ? (
                      <img
                        src={currentCase.photo_url}
                        alt="Current"
                        className="w-14 h-14 rounded-lg object-cover border border-slate-700"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#1e2332] text-slate-200 border border-[#2d354b] cursor-pointer hover:bg-[#282e42]">
                      <Upload className="w-3.5 h-3.5 text-[#c5a059]" />
                      <span>{newPhotoPreview ? 'Select Different' : 'Choose New Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > MAX_FILE_SIZE_BYTES) {
                            setErrorMsg('Selected photo exceeds 50MB limit.');
                            return;
                          }
                          setNewPhotoFile(file);
                          setNewPhotoPreview(URL.createObjectURL(file));
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-[#1a1f2e] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#0d0f15] bg-[#c5a059] hover:bg-[#d4af37] rounded-lg shadow cursor-pointer disabled:opacity-50"
                  >
                    {editSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            ) : (
              /* VIEW MODE */
              <div className="flex flex-col md:flex-row gap-6 items-start pb-6 border-b border-[#212638]">
                {/* Photo */}
                <div className="w-full md:w-56 shrink-0">
                  {currentCase.photo_url ? (
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[#2b3145] bg-black shadow-lg">
                      <img
                        src={currentCase.photo_url}
                        alt={currentCase.case_name}
                        className="w-full h-full object-cover"
                      />
                      <a
                        href={currentCase.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black text-slate-200 text-xs flex items-center gap-1 backdrop-blur-sm"
                        title="View Full Resolution"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-xl border border-dashed border-[#2b3145] bg-[#0c0e14] flex flex-col items-center justify-center text-slate-500">
                      <ImageIcon className="w-10 h-10 mb-2 text-slate-600" />
                      <span className="text-xs">No Photo Docket</span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 space-y-4">
                  <div>
                    <h1
                      className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-wide leading-tight"
                      style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                    >
                      {currentCase.case_name}
                    </h1>
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Date */}
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0e111a] border border-[#212638]">
                      <Calendar className="w-4 h-4 text-[#c5a059] shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                          Filing / Incident Date
                        </span>
                        <span className="text-slate-200 font-semibold">
                          {new Date(currentCase.case_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Assigned Lawyer */}
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#0e111a] border border-[#212638]">
                      <User className="w-4 h-4 text-[#c5a059] shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                          Assigned Counsel
                        </span>
                        <span className="text-slate-200 font-semibold">
                          {currentCase.assigned_lawyer?.name || 'Unassigned / General Firm'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stage Control Row */}
                  <div className="p-3.5 rounded-xl bg-[#0e111a] border border-[#212638] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-slate-300 block mb-0.5">
                        Current Case Stage
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Update or advance this proceeding's stage across the firm in real-time.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <select
                          value={currentCase.stage}
                          onChange={(e) => handleStageChange(e.target.value as CaseStage)}
                          className="bg-[#141824] border border-[#c5a059]/40 text-[#faebd0] rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#c5a059] cursor-pointer"
                          title="Update proceeding stage"
                        >
                          {CASE_STAGES.map((s) => (
                            <option key={s} value={s} className="bg-[#12151e] text-slate-100">
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Case Documents Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3
                    className="text-base font-bold text-slate-100 tracking-wide flex items-center gap-2"
                    style={{ fontFamily: "'Cinzel', Georgia, serif" }}
                  >
                    <FileText className="w-4 h-4 text-[#c5a059]" />
                    <span>Case Documents & Evidentiary Files</span>
                    <span className="text-xs font-mono font-normal text-slate-400">
                      ({files.length})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Accessible and downloadable by all firm members. Maximum 50MB per file.
                  </p>
                </div>

                {/* Add Files Button */}
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#1d2232] hover:bg-[#252b3f] text-[#faebd0] border border-[#c5a059]/40 hover:border-[#c5a059] cursor-pointer transition-all shadow-sm">
                    <Upload className="w-3.5 h-3.5 text-[#c5a059]" />
                    <span>+ Add Files</span>
                    <input
                      ref={docInputRef}
                      type="file"
                      multiple
                      disabled={isUploadingDoc}
                      onChange={handleDocumentsSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingDoc(true);
                }}
                onDragLeave={() => setIsDraggingDoc(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingDoc(false);
                  const dropped = Array.from(e.dataTransfer.files);
                  const oversized = dropped.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
                  if (oversized.length > 0) {
                    setErrorMsg(
                      `File "${oversized[0].name}" exceeds 50MB limit. Maximum allowed size is 50MB.`
                    );
                    return;
                  }
                  setStagedFiles((prev) => [...prev, ...dropped]);
                }}
                onClick={() => docInputRef.current?.click()}
                className={`p-4 rounded-xl border-2 border-dashed transition-all text-center cursor-pointer flex items-center justify-center gap-3 ${
                  isDraggingDoc
                    ? 'border-[#c5a059] bg-[#c5a059]/10'
                    : 'border-[#232838] hover:border-[#c5a059]/50 bg-[#0a0c12]/60'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[#181c2b] border border-[#2b334d] flex items-center justify-center text-[#c5a059] shrink-0">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div className="text-left text-xs">
                  <span className="text-[#e5c378] font-semibold underline">Click to add documents</span>{' '}
                  <span className="text-slate-300">or drag & drop files here</span>
                  <p className="text-[10px] text-slate-500">PDF, Word, Scans, Media (up to 50MB per file)</p>
                </div>
              </div>

              {/* Staged Files Preview (The exact way boss adds files) */}
              {stagedFiles.length > 0 && (
                <div className="p-4 rounded-xl bg-[#0e111a] border border-[#c5a059]/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#e5c378] uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Attached Documents to Upload ({stagedFiles.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setStagedFiles([])}
                      disabled={isUploadingDoc}
                      className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {stagedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-[#141824] border border-[#23293c] text-xs"
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
                          onClick={() => removeStagedFile(idx)}
                          disabled={isUploadingDoc}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Upload Action Button */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#1f2434]">
                    <button
                      type="button"
                      onClick={handleUploadStagedFiles}
                      disabled={isUploadingDoc}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[#c5a059] hover:bg-[#d4af37] text-[#0d0f15] shadow transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingDoc ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-4 h-4" />
                      )}
                      <span>
                        {isUploadingDoc
                          ? 'Uploading Files...'
                          : `Upload ${stagedFiles.length} Document${
                              stagedFiles.length > 1 ? 's' : ''
                            } to Docket`}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {uploadDocMsg && (
                <div className="p-3 rounded-lg bg-[#141824] border border-[#c5a059]/30 text-xs text-[#faebd0] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#c5a059]" />
                  <span>{uploadDocMsg}</span>
                </div>
              )}

              {/* Files Table / List */}
              {files.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#262c3e] bg-[#0c0e14] text-center text-xs text-slate-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p>No documents filed under this docket yet.</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Any attorney or partner can upload briefs, transcripts, contracts, and evidence up to 50MB.
                  </p>
                </div>
              ) : (
                <div className="border border-[#222738] rounded-xl overflow-hidden bg-[#0c0e15]">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#12151f] border-b border-[#222738] text-[10px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="py-2.5 px-4">Document Name</th>
                        <th className="py-2.5 px-4 hidden sm:table-cell">Uploaded Date</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2333]">
                      {files.map((file) => (
                        <tr key={file.id} className="hover:bg-[#141824]/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5 font-medium text-slate-200">
                              <FileText className="w-4 h-4 text-[#c5a059] shrink-0" />
                              <span className="truncate max-w-xs sm:max-w-md">{file.file_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell text-slate-400 text-[11px]">
                            {new Date(file.uploaded_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              {/* Download Link (Available to everyone) */}
                              <a
                                href={file.file_url}
                                target="_blank"
                                rel="noreferrer"
                                download={file.file_name}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[#1a1f2d] hover:bg-[#252c40] text-slate-200 border border-[#2c3347] transition-colors"
                                title="Download Document"
                              >
                                <Download className="w-3.5 h-3.5 text-[#c5a059]" />
                                <span className="hidden sm:inline">Download</span>
                              </a>

                              {/* Delete Button (Available to firm members) */}
                              {confirmDeleteFileId === file.id ? (
                                <div className="inline-flex items-center gap-1.5 bg-rose-950/80 border border-rose-800 rounded-md px-2 py-1 text-xs">
                                  <span className="text-rose-200 text-[11px] font-medium">Delete?</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFile(file)}
                                    disabled={deletingFileId === file.id}
                                    className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold cursor-pointer text-[10px]"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteFileId(null)}
                                    className="px-1.5 py-0.5 hover:bg-slate-700 text-slate-300 rounded cursor-pointer text-[10px]"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={deletingFileId === file.id}
                                  onClick={() => setConfirmDeleteFileId(file.id)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors disabled:opacity-50 cursor-pointer"
                                  title="Delete Document"
                                >
                                  {deletingFileId === file.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete Case Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md p-6 bg-[#161924] border border-rose-800/60 rounded-xl shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-700/60 flex items-center justify-center mx-auto mb-3 text-rose-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Permanently Delete Docket?</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                This will delete <strong className="text-slate-200">"{currentCase?.case_name}"</strong> and all attached files from the database and storage. This action is irreversible.
              </p>

              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  disabled={isDeletingCase}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-[#202535]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingCase}
                  onClick={handleDeleteCase}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow"
                >
                  {isDeletingCase ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#212638] bg-[#0d0f16] flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Bond Partners Case Management System</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#1a1e2b] text-slate-300 hover:text-white text-xs font-medium"
          >
            Close Docket
          </button>
        </div>
      </div>
    </div>
  );
};
