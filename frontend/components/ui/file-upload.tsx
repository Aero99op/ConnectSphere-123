"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, FileVideo, FileImage, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFileInChunks } from "@/lib/utils/chunk-uploader";
import { uploadToCatbox, auditUpload } from "@/lib/storage";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";

interface FileUploadProps {
    onUploadComplete: (urls: string[], thumbnailUrl?: string) => void;
    maxSizeMB?: number;
}

export function FileUpload({ onUploadComplete, maxSizeMB = 500 }: FileUploadProps) {
    const { user: authUser, supabase } = useAuth();
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string>("");
    const [isCompleted, setIsCompleted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadStartedRef = useRef(false); // Prevent double uploads

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragging(true);
        } else if (e.type === "dragleave") {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelected(e.dataTransfer.files[0]);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelected(e.target.files[0]);
        }
    };

    const generateThumbnail = async (videoFile: File): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.onloadedmetadata = () => {
                video.currentTime = 1;
            };
            video.onseeked = () => {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob((blob) => {
                        URL.revokeObjectURL(video.src);
                        resolve(blob);
                    }, "image/jpeg", 0.7);
                } else {
                    URL.revokeObjectURL(video.src);
                    resolve(null);
                }
            };
            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                resolve(null);
            };
            video.src = URL.createObjectURL(videoFile);
        });
    };

    const compressImage = async (imageFile: File): Promise<Blob> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = URL.createObjectURL(imageFile);
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                const MAX_DIM = 1200;
                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    }
                } else {
                    if (height > MAX_DIM) {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(imageFile);
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            resolve(imageFile);
                        }
                    },
                    "image/jpeg",
                    0.7
                );
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                resolve(imageFile);
            };
        });
    };

    // Instagram-style: file select → instant upload
    const handleFileSelected = (selectedFile: File) => {
        const sizeMB = selectedFile.size / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
            toast.error(`Bhai, itni badi file? Limit ${maxSizeMB}MB ki hai!`);
            return;
        }
        setFile(selectedFile);
        // Auto-start upload immediately
        startUpload(selectedFile);
    };

    const startUpload = async (targetFile: File) => {
        if (uploadStartedRef.current) return;
        uploadStartedRef.current = true;
        setUploading(true);
        setProgress(0);
        let urls: string[] = [];
        let thumbnailUrl = "";

        try {
            let fileToUpload: File | Blob = targetFile;

            // 1. Generate Thumbnail if Video
            if (targetFile.type.startsWith("video/")) {
                setStatus("Generating thumbnail...");
                const thumbBlob = await generateThumbnail(targetFile);
                if (thumbBlob) {
                    setStatus("Uploading thumbnail...");
                    const fileObj = new File([thumbBlob], "thumb.jpg", { type: "image/jpeg" });
                    thumbnailUrl = await uploadToCatbox(fileObj, { useProxy: true });
                }
            } else if (targetFile.type.startsWith("image/")) {
                // 1b. Compress Image
                setStatus("Compressing image... ⚡");
                fileToUpload = await compressImage(targetFile);
            }

            // 2. Upload Main File
            setStatus("Uploading...");

            const finalFile = fileToUpload instanceof File
                ? fileToUpload
                : new File([fileToUpload], targetFile.name, { type: "image/jpeg" });

            urls = await uploadFileInChunks(finalFile, (percent) => {
                setProgress(percent);
                if (percent > 10 && percent < 30) setStatus("Uploading... (1/3)");
                if (percent > 40 && percent < 60) setStatus("Halfway there! (2/3)");
                if (percent > 80) setStatus("Almost done...");
            });

            // 3. Audit Log
            await auditUpload(urls, targetFile.name, finalFile.size, supabase, authUser?.id);

            setStatus("Upload complete! 🚀");
            setProgress(100);
            setIsCompleted(true);
            onUploadComplete(urls, thumbnailUrl);
            toast.success("File uploaded! 🎉");

        } catch (error) {
            console.error("Upload failed", error);
            setStatus("Upload failed. Try again.");
            toast.error("Upload fail ho gaya! Internet check karo.");
            uploadStartedRef.current = false;
            setUploading(false);
            setFile(null);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl">
            {!isCompleted && !uploading && (
                <div
                    className={cn(
                        "relative border-2 border-dashed rounded-lg p-8 transition-all text-center cursor-pointer",
                        isDragging ? "border-primary bg-primary/10" : "border-gray-500 hover:border-gray-400"
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleChange}
                        accept="image/*,video/*"
                    />

                    <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Upload className="w-10 h-10 mb-2 group-hover:text-amber-500 transition-colors" />
                        <p className="text-sm text-zinc-300 font-bold uppercase tracking-wider">Drag & drop / Click</p>
                        <p className="text-xs text-zinc-500">Max {maxSizeMB}MB — Auto uploads instantly!</p>
                    </div>
                </div>
            )}

            {/* Uploading State */}
            {uploading && file && (
                <div className="p-6 border-2 border-dashed border-primary/30 bg-primary/5 rounded-lg text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex flex-col items-center gap-4">
                        {file.type.startsWith("video/") ? (
                            <FileVideo className="w-12 h-12 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse" />
                        ) : (
                            <FileImage className="w-12 h-12 text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse" />
                        )}
                        <div className="text-sm w-full text-center px-4">
                            <p className="font-bold text-white truncate w-full">{file.name}</p>
                            <p className="text-zinc-500 font-mono text-xs mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3 animate-pulse">{status}</p>
                        <div className="w-full bg-black/50 rounded-full h-1.5 border border-white/5 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <p className="text-zinc-600 text-[10px] font-mono mt-2">{progress}%</p>
                    </div>
                </div>
            )}

            {/* Completed State */}
            {isCompleted && (
                <div className="p-8 border-2 border-dashed border-green-500/30 bg-green-500/10 rounded-lg text-center animate-in zoom-in-95 duration-300">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                        <CheckCircle2 className="w-6 h-6 text-black" />
                    </div>
                    <p className="text-green-500 font-black uppercase tracking-widest text-sm">Upload Successful!</p>
                    <p className="text-zinc-500 text-xs mt-1">File uploaded 🚀</p>
                </div>
            )}
        </div>
    );
}
