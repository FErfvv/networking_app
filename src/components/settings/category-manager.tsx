"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryBadge, CATEGORY_SWATCHES } from "@/components/contacts/badges";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/lib/actions/categories";
import { CATEGORY_COLORS, MAX_CATEGORIES, type CategoryColor } from "@/lib/constants";
import type { Category } from "@/lib/services/categories";
import { cn } from "@/lib/utils";

const byName = (a: Category, b: Category) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

/** Add, rename, recolor and delete the categories contacts can be labeled with. */
export function CategoryManager({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const [items, setItems] = useState(() => [...initial].sort(byName));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function saved(cat: Category) {
    setItems((xs) => [...xs.filter((x) => x.id !== cat.id), cat].sort(byName));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((c) =>
            editingId === c.id ? (
              <li key={c.id} className="p-2">
                <CategoryEditor
                  initial={c}
                  submitLabel="Save"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (input) => {
                    const res = await updateCategoryAction(c.id, input);
                    if (!res.ok) return res.error;
                    saved(res.data);
                    setEditingId(null);
                    toast.success("Category saved");
                  }}
                />
              </li>
            ) : (
              <li key={c.id} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
                <CategoryBadge name={c.name} color={c.color} className="max-w-full truncate" />
                <div className="ml-auto flex shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    aria-label={`Edit ${c.name}`}
                    onClick={() => {
                      setAdding(false);
                      setEditingId(c.id);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <DeleteCategoryButton
                    category={c}
                    onDeleted={() => {
                      setItems((xs) => xs.filter((x) => x.id !== c.id));
                      router.refresh();
                    }}
                  />
                </div>
              </li>
            ),
          )}
          {adding ? (
            <li className="p-2">
              <CategoryEditor
                initial={{ name: "", color: nextColor(items) }}
                submitLabel="Add"
                onCancel={() => setAdding(false)}
                onSubmit={async (input) => {
                  const res = await createCategoryAction(input);
                  if (!res.ok) return res.error;
                  saved(res.data);
                  setAdding(false);
                  toast.success(`Added ${res.data.name}`);
                }}
              />
            </li>
          ) : null}
        </ul>
      )}

      {!adding && items.length < MAX_CATEGORIES ? (
        <Button
          variant="outline"
          className="h-10"
          onClick={() => {
            setEditingId(null);
            setAdding(true);
          }}
        >
          <Plus />
          Add category
        </Button>
      ) : null}
    </div>
  );
}

/** Pick the first color not in use yet, so new categories are distinguishable. */
function nextColor(items: Category[]): CategoryColor {
  const used = new Set(items.map((c) => c.color));
  return CATEGORY_COLORS.find((c) => c !== "slate" && !used.has(c)) ?? "slate";
}

function CategoryEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { name: string; color: CategoryColor };
  submitLabel: string;
  /** Resolves to an error message, or nothing on success. */
  onSubmit: (input: { name: string; color: CategoryColor }) => Promise<string | void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState<CategoryColor>(initial.color);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setPending(true);
    try {
      const err = await onSubmit({ name, color });
      if (err) setError(err);
    } catch {
      setError("Network error — not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="space-y-2"
    >
      <div className="flex gap-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={50}
          placeholder="Category name"
          aria-label="Category name"
          aria-invalid={Boolean(error)}
          className="h-10"
        />
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label="Cancel"
          onClick={onCancel}
        >
          <X />
        </Button>
      </div>
      <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1.5">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            title={c}
            onClick={() => setColor(c)}
            className={cn(
              "size-7 rounded-full ring-offset-2 ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring",
              CATEGORY_SWATCHES[c],
              color === c && "ring-2 ring-foreground",
            )}
          />
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}

function DeleteCategoryButton({
  category,
  onDeleted,
}: {
  category: Category;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    setDeleting(true);
    try {
      const res = await deleteCategoryAction(category.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Deleted ${category.name}`);
      onDeleted();
    } catch {
      toast.error("Network error — category not deleted.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${category.name}`}
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{category.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            People in this category are kept. They just won&apos;t have a category anymore.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            disabled={deleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {deleting ? <Loader2 className="animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
