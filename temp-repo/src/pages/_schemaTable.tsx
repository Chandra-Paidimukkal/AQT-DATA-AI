import React, { useMemo } from "react";

type Row = Record<string, any>;

// ─────────────────────────────────────────────────────────────
// Value Handling
// ─────────────────────────────────────────────────────────────

export function cellValue(v: any): string {
    if (v === null || v === undefined || v === "") return "NULL";

    if (typeof v === "object") {
        // compact object preview
        try {
            const str = JSON.stringify(v);
            return str.length > 80 ? str.slice(0, 80) + "..." : str;
        } catch {
            return "[Object]";
        }
    }

    return String(v);
}

// ─────────────────────────────────────────────────────────────
// Column Helpers
// ─────────────────────────────────────────────────────────────

function dedupeFields(fields: string[] = []): string[] {
    return Array.from(
        new Set(
            (fields || [])
                .map((f) => String(f || "").trim())
                .filter(Boolean)
        )
    );
}

function inferColumnsFromRows(rows: Row[] = []): string[] {
    return Array.from(
        new Set(
            rows.flatMap((r) => Object.keys(r || {}))
        )
    );
}

function extractMetaFields(rows: Row[]): string[] {
    return Array.from(
        new Set(
            rows.flatMap((r) =>
                Object.keys(r || {}).filter((k) => k.startsWith("_") && k !== "_document")
            )
        )
    );
}

// ─────────────────────────────────────────────────────────────
// Schema Normalization
// ─────────────────────────────────────────────────────────────

export function normalizeRowsToSchema(
    rows: Row[],
    schemaFields: string[],
    documentName?: string
): Row[] {

    const cols = dedupeFields(schemaFields);

    return (rows || []).map((row) => {
        const safeRow = row || {};
        const out: Row = {};

        if (documentName) {
            out._document = documentName;
        }

        // enforce schema strictly
        if (cols.length > 0) {
            cols.forEach((field) => {
                out[field] = safeRow[field] ?? "NULL";
            });
        } else {
            Object.entries(safeRow).forEach(([key, value]) => {
                out[key] = value;
            });
        }

        // preserve meta
        Object.entries(safeRow).forEach(([key, value]) => {
            if (key.startsWith("_")) {
                out[key] = value;
            }
        });

        return out;
    });
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function SchemaTable({
    rows,
    schemaFields,
    includeDocument = false,
}: {
    rows: Row[];
    schemaFields: string[];
    includeDocument?: boolean;
}) {

    const columns = useMemo(() => {
        const cleanSchema = dedupeFields(schemaFields);

        const baseCols =
            cleanSchema.length > 0
                ? cleanSchema
                : inferColumnsFromRows(rows).filter((k) => !k.startsWith("_"));

        const metaCols = extractMetaFields(rows);

        return [
            ...(includeDocument ? ["_document"] : []),
            ...baseCols,
            ...metaCols,
        ];
    }, [rows, schemaFields, includeDocument]);

    if (!rows || rows.length === 0) {
        return (
            <p className="text-xs font-mono py-4 text-center" style={{ color: "#64748b" }}>
                No data extracted
            </p>
        );
    }

    return (
        <div
            className="overflow-auto rounded-lg"
            style={{ border: "1px solid #1e3a5f", maxHeight: "360px" }}
        >
            <table
                className="w-full text-xs border-collapse"
                style={{
                    minWidth: `${Math.max(columns.length * 140, 400)}px`,
                }}
            >
                <thead>
                    <tr
                        style={{
                            background: "#0c2340",
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                        }}
                    >
                        <th
                            className="px-3 py-2 text-left font-mono font-semibold whitespace-nowrap"
                            style={{
                                color: "#38bdf8",
                                borderRight: "1px solid #1e3a5f",
                                borderBottom: "2px solid #1e3a5f",
                                width: "48px",
                            }}
                        >
                            #
                        </th>

                        {columns.map((col) => (
                            <th
                                key={col}
                                className="px-3 py-2 text-left font-mono font-semibold whitespace-nowrap"
                                style={{
                                    color: col.startsWith("_") ? "#94a3b8" : "#38bdf8",
                                    borderRight: "1px solid #1e3a5f",
                                    borderBottom: "2px solid #1e3a5f",
                                    minWidth: "120px",
                                }}
                            >
                                {col === "_document" ? "Document" : col}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {rows.map((row, ri) => (
                        <tr
                            key={ri}
                            style={{
                                background:
                                    ri % 2 === 0
                                        ? "#071a2e"
                                        : "#0a2038",
                            }}
                        >
                            <td
                                className="px-3 py-1.5 font-mono text-center"
                                style={{
                                    color: "#475569",
                                    borderRight: "1px solid #1e3a5f",
                                    borderBottom: "1px solid #1e3a5f",
                                }}
                            >
                                {ri + 1}
                            </td>

                            {columns.map((col) => {
                                const val = cellValue(row?.[col]);
                                const isNull = val === "NULL" || val === "—";

                                return (
                                    <td
                                        key={col}
                                        className="px-3 py-1.5 font-mono whitespace-nowrap max-w-[260px] overflow-hidden text-ellipsis"
                                        style={{
                                            color: isNull
                                                ? "#334155"
                                                : col.startsWith("_")
                                                    ? "#94a3b8"
                                                    : "#cbd5e1",
                                            borderRight: "1px solid #1e3a5f",
                                            borderBottom: "1px solid #1e3a5f",
                                        }}
                                        title={val}
                                    >
                                        {val}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}