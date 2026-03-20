"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2, File as FileIcon, Image as ImageIcon, Video, Headphones } from "lucide-react";
import { toast } from "sonner";
import { decryptFileBlob } from "@/lib/crypto/e2ee";
import { downloadAndMergeChunks } from "@/lib/utils/chunk-uploader";

interface EncryptedMediaProps {
    urls: string[];
    e2eKeys?: { key: string, iv: string, name: string };
    thumbnail?: string;
    fileName?: string;
    onClick?: () => void;
}

export function EncryptedMedia({ urls, e2eKeys, thumbnail, fileName, onClick }: EncryptedMediaProps) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // E2E auto-decrypt for single files/images
    useEffect(() => {
        if (urls.length > 0 && e2eKeys && !blobUrl) {
            handleDownloadAndDecrypt();
        }
    }, [urls, e2eKeys]);

    const handleDownloadAndDecrypt = async () => {
        if (blobUrl || loading) return;
        setLoading(true);
        try {
            if (e2eKeys && e2eKeys.key) {
                // E2E Encrypted Blob
                const response = await fetch(urls[0]);
                const encryptedBuffer = await response.arrayBuffer();
                const decryptedBlob = await decryptFileBlob(encryptedBuffer, e2eKeys.key, e2eKeys.iv);
                setBlobUrl(URL.createObjectURL(decryptedBlob));
            } else {
                // Legacy Chunked or Plaintext
                if (urls.length === 1 && !thumbnail) {
                    setBlobUrl(urls[0]); // direct link
                } else {
                     const url = await downloadAndMergeChunks(urls, 'application/octet-stream');
                     setBlobUrl(url);
                }
            }
        } catch (e) {
            console.error("Media Decryption Error", e);
            toast.error("Decryption failed. Media might be corrupted.");
        } finally {
            setLoading(false);
        }
    };

    const isImage = fileName?.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i) || urls[0].toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|bmp)$/i);
    const isVideo = fileName?.toLowerCase().match(/\.(mp4|webm|ogg)$/i) || urls[0].toLowerCase().match(/\.(mp4|webm|ogg)$/i);
    const isAudio = fileName?.toLowerCase().match(/\.(mp3|wav|ogg)$/i) || urls[0].toLowerCase().match(/\.(mp3|wav|ogg)$/i);

    const isSingleImagePlain = !e2eKeys && isImage && urls.length === 1 && !thumbnail;

    return (
        <div className="group relative rounded-lg overflow-hidden border border-white/10 bg-black/40 min-w-[200px]" onClick={onClick}>
            {loading ? (
                <div className="flex flex-col items-center justify-center p-6 bg-black/50 aspect-square min-h-[150px]">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-2" />
                    <span className="text-xs text-orange-400 font-bold uppercase tracking-widest animate-pulse">Decrypting...</span>
                </div>
            ) : blobUrl || isSingleImagePlain || thumbnail ? (
                <>
                    {/* Render Image/Video/Audio depending on type */}
                    {isImage ? (
                         <div className="relative w-full max-w-[240px] h-[320px] md:max-w-[320px] md:h-[400px]">
                            <Image
                                src={blobUrl || thumbnail || urls[0]}
                                alt={fileName || "Secure Media"}
                                fill
                                className="object-cover transition-opacity hover:opacity-95"
                                unoptimized
                            />
                        </div>
                    ) : isVideo ? (
                        <video
                            src={blobUrl || urls[0]}
                            controls
                            className="w-full max-h-[300px]"
                        />
                    ) : isAudio ? (
                        <div className="p-3 w-full bg-black/40 rounded-lg">
                             <div className="flex items-center gap-2 text-xs mb-2 opacity-80 text-orange-400 font-bold">
                                 <Headphones className="w-4 h-4" /> 
                                 <span className="truncate">{fileName || "Voice Note"}</span>
                             </div>
                             <audio src={blobUrl || urls[0]} controls className="w-full h-8" />
                        </div>
                    ) : (
                        <div className="p-3 flex items-center gap-3">
                            <div className="p-2 bg-white/5 rounded-lg border border-orange-500/30">
                                <FileIcon className="w-6 h-6 text-orange-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate text-white">{fileName || "Encrypted File"}</p>
                            </div>
                            <a href={blobUrl || urls[0]} download={fileName || "file"} onClick={e => e.stopPropagation()} className="text-orange-500 text-xs font-bold bg-orange-500/10 px-3 py-1.5 rounded-full hover:bg-orange-500/20 transition-colors">
                                Open
                            </a>
                        </div>
                    )}
                </>
            ) : (
                <div className="p-4 flex flex-col items-center justify-center gap-3 bg-black/60 aspect-video">
                    <div className="p-3 bg-orange-500/10 rounded-full border border-orange-500/30">
                        {isVideo ? <Video className="w-6 h-6 text-orange-500" /> : isAudio ? <Headphones className="w-6 h-6 text-orange-500" /> : isImage ? <ImageIcon className="w-6 h-6 text-orange-500" /> : <FileIcon className="w-6 h-6 text-orange-500" />}
                    </div>
                    <div className="text-center">
                        <p className="text-xs font-bold truncate text-white max-w-[150px]">{fileName || "Encrypted Payload"}</p>
                        {e2eKeys && <p className="text-[9px] text-green-400 uppercase tracking-wider mt-1 font-mono">Military Grade E2EE</p>}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDownloadAndDecrypt(); }} disabled={loading} className="mt-2 bg-orange-500 hover:bg-orange-600 text-black font-black uppercase tracking-widest text-[10px] px-4 py-2 rounded-full transition-colors active:scale-95 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                        Unlock & View
                    </button>
                </div>
            )}
        </div>
    );
}
