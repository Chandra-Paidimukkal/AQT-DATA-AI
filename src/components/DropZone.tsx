// ─────────────────────────────────────────────────────────────
//  DropZone.tsx
//  Handles: single file, multi-file, folder, ZIP
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useRef, useState } from "react";
import { Upload, FolderOpen, Archive, Files } from "lucide-react";
import { useDocumentQueue } from "@/store/useDocumentQueue";
import { cn } from "@/lib/utils";

export function DropZone() {
    const { uploadFiles } = useDocumentQueue();
    const [dragging, setDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const zipInputRef = useRef<HTMLInputElement>(null);

    // ── drag handlers ─────────────────────────────────────────
    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(true);
    }, []);

    const onDragLeave = useCallback(() => setDragging(false), []);

    const onDrop = useCallback(
        async (e: React.DragEvent) => {
            e.preventDefault();
            setDragging(false);

            const files: File[] = [];

            // Support folder drops via DataTransferItemList
            if (e.dataTransfer.items) {
                const entries = Array.from(e.dataTransfer.items)
                    .map((item) => item.webkitGetAsEntry?.())
                    .filter(Boolean) as FileSystemEntry[];

                const collected = await collectFromEntries(entries);
                files.push(...collected);
            } else {
                files.push(...Array.from(e.dataTransfer.files));
            }

            if (files.length) await uploadFiles(files);
        },
        [uploadFiles]
    );

    // ── input handlers ────────────────────────────────────────
    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            await uploadFiles(e.target.files);
            e.target.value = "";
        }
    };

    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
                "relative rounded-xl border-2 border-dashed transition-all duration-200 p-8",
                dragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50 dark:bg-slate-900/50"
            )}
        >
            {/* Hidden file inputs */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                className="hidden"
                onChange={onFileChange}
            />
            <input
                ref={folderInputRef}
                type="file"
                // @ts-ignore — non-standard but widely supported
                webkitdirectory=""
                mozdirectory=""
                multiple
                className="hidden"
                onChange={onFileChange}
            />
            <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                onChange={onFileChange}
            />

            <div className="flex flex-col items-center gap-5 text-center">
                <div className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-4">
                    <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>

                <div>
                    <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                        Drop files here
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Supports single files, multiple files, folders, and ZIP archives
                    </p>
                </div>

                {/* Upload trigger buttons */}
                <div className="flex flex-wrap justify-center gap-3">
                    <UploadButton
                        icon={<Files className="h-4 w-4" />}
                        label="Files"
                        onClick={() => fileInputRef.current?.click()}
                    />
                    <UploadButton
                        icon={<FolderOpen className="h-4 w-4" />}
                        label="Folder"
                        onClick={() => folderInputRef.current?.click()}
                    />
                    <UploadButton
                        icon={<Archive className="h-4 w-4" />}
                        label="ZIP"
                        onClick={() => zipInputRef.current?.click()}
                    />
                </div>
            </div>

            {/* Drag overlay */}
            {dragging && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-blue-500/10 backdrop-blur-sm">
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-300">
                        Drop to add files
                    </p>
                </div>
            )}
        </div>
    );
}

function UploadButton({
    icon,
    label,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
            {icon}
            {label}
        </button>
    );
}

// ── FileSystem API helper for folder drops ────────────────────
async function collectFromEntries(entries: FileSystemEntry[]): Promise<File[]> {
    const files: File[] = [];

    async function traverse(entry: FileSystemEntry) {
        if (entry.isFile) {
            const file = await new Promise<File>((res, rej) =>
                (entry as FileSystemFileEntry).file(res, rej)
            );
            files.push(file);
        } else if (entry.isDirectory) {
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            const children = await new Promise<FileSystemEntry[]>((res, rej) =>
                reader.readEntries(res, rej)
            );
            await Promise.all(children.map(traverse));
        }
    }

    await Promise.all(entries.map(traverse));
    return files;
}