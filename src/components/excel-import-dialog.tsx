import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Download, FileUp } from "lucide-react";
import { toast } from "sonner";
import { parseExcelFile, downloadTemplate, type SheetRow } from "@/lib/excel-import";

type Props = {
  title: string;
  description: string;
  templateName: string;
  templateHeaders: string[];
  templateSample: (string | number)[];
  /** Convert a sheet row into a record; throw an Error to report a row problem. */
  mapRow: (row: SheetRow) => Record<string, any>;
  /** Persist the mapped records. Returns counts. */
  onImport: (records: Record<string, any>[]) => Promise<{ created: number; updated: number }>;
  buttonLabel?: string;
};

export function ExcelImportDialog({
  title, description, templateName, templateHeaders, templateSample, mapRow, onImport, buttonLabel = "Import Excel",
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setRows([]); setErrors([]); setFileName(""); };

  const handleFile = async (file: File) => {
    try {
      const parsed = await parseExcelFile(file);
      const ok: Record<string, any>[] = [];
      const errs: string[] = [];
      parsed.forEach((r, i) => {
        try {
          ok.push(mapRow(r));
        } catch (e: any) {
          errs.push(`Row ${i + 2}: ${e.message ?? "invalid"}`);
        }
      });
      setRows(ok); setErrors(errs); setFileName(file.name);
      if (!ok.length) toast.error("No valid rows found in the file");
    } catch (e: any) {
      toast.error(e.message ?? "Could not read the file");
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const res = await onImport(rows);
      toast.success(`Imported — ${res.created} added, ${res.updated} updated`);
      setOpen(false); reset();
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-1" /> {buttonLabel}
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          <Button
            variant="secondary" size="sm"
            onClick={() => downloadTemplate(templateName, templateHeaders, templateSample)}
          >
            <Download className="h-4 w-4 mr-1" /> Download template
          </Button>

          <div
            className="rounded-lg border border-dashed border-border p-6 text-center cursor-pointer hover:bg-muted/40"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          >
            <FileUp className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-sm">{fileName || "Click to choose an .xlsx / .csv file, or drop it here"}</div>
            <input
              ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
          </div>

          {rows.length > 0 && (
            <div className="text-sm">
              <span className="font-semibold text-foreground">{rows.length}</span> valid row{rows.length === 1 ? "" : "s"} ready to import.
              <div className="text-xs text-muted-foreground mt-1">Existing records with the same code are updated; new codes are added.</div>
            </div>
          )}
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
              {errors.map((e) => <div key={e}>{e}</div>)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={doImport} disabled={!rows.length || busy}>{busy ? "Importing…" : `Import ${rows.length || ""}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
