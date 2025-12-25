import { useState, useCallback } from "react";
import { Save, Edit2, FileText, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StyleSpec } from "@/lib/store";

interface StyleSpecEditorProps {
  styleId: string;
  styleSpec?: StyleSpec | null;
  createdAt: string;
  updatedAt?: string | null;
  onUpdate?: (spec: StyleSpec) => void;
  className?: string;
}

export function StyleSpecEditor({
  styleId,
  styleSpec,
  createdAt,
  updatedAt,
  onUpdate,
  className,
}: StyleSpecEditorProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usageGuidelines, setUsageGuidelines] = useState(
    styleSpec?.usageGuidelines || ""
  );
  const [designNotes, setDesignNotes] = useState(styleSpec?.designNotes || "");

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/styles/${styleId}/spec`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usageGuidelines, designNotes }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEditing(false);
        if (onUpdate && updated.styleSpec) {
          onUpdate(updated.styleSpec);
        }
      }
    } catch (error) {
      console.error("Failed to save style spec:", error);
    } finally {
      setSaving(false);
    }
  }, [styleId, usageGuidelines, designNotes, onUpdate]);

  const handleCancel = () => {
    setUsageGuidelines(styleSpec?.usageGuidelines || "");
    setDesignNotes(styleSpec?.designNotes || "");
    setEditing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock size={14} />
          <span>Created {formatDate(createdAt)}</span>
          {updatedAt && (
            <>
              <span className="mx-1">•</span>
              <span>Updated {formatDate(updatedAt)}</span>
            </>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-muted/50 hover:bg-muted transition-colors"
            data-testid="button-edit-spec"
          >
            <Edit2 size={12} />
            Edit
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <FileText size={12} />
            Usage Guidelines
          </label>
          {editing ? (
            <textarea
              value={usageGuidelines}
              onChange={(e) => setUsageGuidelines(e.target.value)}
              placeholder="Describe when and how to use this style (e.g., 'Best for hero sections, product photography, editorial layouts...')"
              className="w-full h-24 p-3 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              data-testid="input-usage-guidelines"
            />
          ) : (
            <div className="p-4 bg-muted/30 rounded-lg border border-border min-h-[80px]">
              {usageGuidelines ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {usageGuidelines}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No usage guidelines yet. Click Edit to add.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Edit2 size={12} />
            Design Notes
          </label>
          {editing ? (
            <textarea
              value={designNotes}
              onChange={(e) => setDesignNotes(e.target.value)}
              placeholder="Add technical notes, accessibility considerations, or design rationale..."
              className="w-full h-24 p-3 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              data-testid="input-design-notes"
            />
          ) : (
            <div className="p-4 bg-muted/30 rounded-lg border border-border min-h-[80px]">
              {designNotes ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {designNotes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No design notes yet. Click Edit to add.
                </p>
              )}
            </div>
          )}
        </div>

        {editing && (
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              data-testid="button-save-spec"
            >
              <Save size={14} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
              data-testid="button-cancel-spec"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
