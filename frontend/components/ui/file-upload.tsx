"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, FileVideo, FileImage, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFileInChunks } from "@/lib/utils/chunk-uploader";
import { uploadToCatbox, auditUpload } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Utility for class merging (inline for now if lib/utils doesn't exist)
function classNames(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}

interface FileUploadProps {
    onUploadComplete: (urls: string[], thumbnailUrl?: string) => void;
    maxSizeMB?: number; // Default 500MB for our new "Jugaad" chunking style
}

export function FileUpload({ onUploadComplete, maxSizeMB = 500 }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string>("");
    const [isCompleted, setIsCompleted] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const validateAndSetFile = (selectedFile: File) => {
        const sizeMB = selectedFile.size / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
            toast.error(`Bhai, itni badi file? Limit ${maxSizeMB}MB ki hai!`);
            return;
        }
        setFile(selectedFile);
        setStatus("Ready to Jugaad (Upload)");
    };

    const generateThumbnail = async (videoFile: File): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.onloadedmetadata = () => {
                video.currentTime = 1; // Capture at 1s
            };
            video.onseeked = () => {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob((blob) => {
                        URL.revokeObjectURL(video.src); // Cleanup!
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
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(imageFile);
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                // Max dimension 1200px
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
                    resolve(imageFile); // Fallback to original
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
                resolve(imageFile); // Fallback
            };
        });
    };

    const startUpload = async () => {
        if (!file || uploading || isCompleted) return;
        setUploading(true);
        setProgress(0);
        let urls: string[] = [];
        let thumbnailUrl = "";

        try {
            let fileToUpload: File | Blob = file;

            // 1. Generate Thumbnail if Video (Client-side hack)
            if (file.type.startsWith("video/")) {
                setStatus("Generating Thumbnail hack...");
                const thumbBlob = await generateThumbnail(file);
                if (thumbBlob) {
                    setStatus("Uploading Thumbnail...");
                    const fileObj = new File([thumbBlob], "thumb.jpg", { type: "image/jpeg" });
                    thumbnailUrl = await uploadToCatbox(fileObj, { useProxy: true });
                }
            } else if (file.type.startsWith("image/")) {
                // 1b. Compress Image if it's an image
                setStatus("Compressing Image for speed... ⚡");
                fileToUpload = await compressImage(file);
                console.log(`Original: ${file.size}, Compressed: ${fileToUpload.size}`);
            }

            // 2. Upload Main File using our Chunk Uploader
            setStatus("Bade File ka Todna aur Uploading on Catbox...");

            // If it's a blob from compression, make it a file for the uploader
            const finalFile = fileToUpload instanceof File
                ? fileToUpload
                : new File([fileToUpload], file.name, { type: "image/jpeg" });

            urls = await uploadFileInChunks(finalFile, (percent) => {
                setProgress(percent);
                if (percent > 10 && percent < 30) setStatus("Bhai, file badi hai, thoda sabr kar... (1/3 done)");
                if (percent > 40 && percent < 60) setStatus("Aadhe raste pahunch gaye! (2/3 done)");
                if (percent > 80) setStatus("Bas thoda sa aur... Final merge hone waala hai.");
            });

            // 3. Security Audit Log (MOSSAD-Level Governance)
            await auditUpload(urls, file.name, finalFile.size);

            setStatus("Upload Complete! Zero Server Cost 💸🚀");
            setIsCompleted(true);
            onUploadComplete(urls, thumbnailUrl);
            toast.success("File uploaded successfully! 🎉");


        } catch (error) {
            console.error("Upload failed", error);
            setStatus("Upload Failed. Check console bhai.");
            toast.error("Upload Fail Ho Gaya! Internet ya Catbox check karo.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl">
            {!isCompleted && (
                <div
                    className={classNames(
                        "relative border-2 border-dashed rounded-lg p-8 transition-all text-center cursor-pointer",
                        isDragging ? "border-primary bg-primary/10" : "border-gray-500 hover:border-gray-400",
                        uploading || file ? "border-gray-500 bg-black/20" : ""
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => !file && !uploading && fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleChange}
                        accept="image/*,video/*"
                    />

                    {!file ? (
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                            <Upload className="w-10 h-10 mb-2 group-hover:text-amber-500 transition-colors" />
                            <p className="text-sm text-zinc-300 font-bold uppercase tracking-wider">Drag & drop / Click</p>
                            <p className="text-xs text-zinc-500">Max {maxSizeMB}MB ki aukaat hai (Infinite trick via Catbox!)</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 relative z-10 w-full">
                            {file.type.startsWith("video/") ? (
                                <FileVideo className="w-12 h-12 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                            ) : (
                                <FileImage className="w-12 h-12 text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                            )}
                            <div className="text-sm w-full text-center px-4">
                                <p className="font-bold text-white truncate w-full">{file.name}</p>
                                <p className="text-zinc-500 font-mono text-xs mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>

                            {!uploading && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                        setStatus("");
                                    }}
                                    className="absolute -top-6 -right-6 p-2 bg-black/50 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 rounded-full transition-colors border border-white/10"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {isCompleted && (
                <div className="p-8 border-2 border-dashed border-green-500/30 bg-green-500/10 rounded-lg text-center animate-in zoom-in-95 duration-300">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                        <Loader2 className="w-6 h-6 text-black" />
                    </div>
                    <p className="text-green-500 font-black uppercase tracking-widest text-sm">Upload Successful!</p>
                    <p className="text-zinc-500 text-xs mt-1">Bhai, file server pe pahunch gayi 🚀</p>
                </div>
            )}

            {status && (
                <div className="mt-6 text-center">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3 animate-pulse">{status}</p>
                    {uploading && (
                        <div className="w-full bg-black/50 rounded-full h-1.5 border border-white/5 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 transition-all duration-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    )}
                </div>
            )}

            {file && !uploading && !isCompleted && (
                <button
                    onClick={startUpload}
                    className="mt-6 w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black uppercase tracking-widest rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg"
                >
                    Confirm & Upload (Jugaad Start)
                </button>
            )}
        </div>
    );
}
