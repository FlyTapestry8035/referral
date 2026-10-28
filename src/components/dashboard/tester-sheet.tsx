"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  cellSelectionFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, Columns3Icon, DownloadIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StageDot } from "./stage-dot";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/stats";
import { selectionStats } from "@/lib/metrics";
import { toCsv } from "@/lib/csv";
import { formatNumber, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SheetRow = {
  id: string;
  code: string | null;
  name: string;
  email: string;
  stage: Stage;
  progress: number;
  responses_count: number;
  helpfulness: number;
  bugs_count: number;
  tips_count: number;
  last_active_at: string | null;
  notes: string;
  revoked: boolean;
  badges: { badge: string; name: string }[];
};

type EditableField = "name" | "notes";

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnVisibilityFeature,
  cellSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, datetime: sortFn_datetime, text: sortFn_text },
  filterFns: { equalsString: filterFn_equalsString },
});

const helper = createColumnHelper<typeof features, SheetRow>();

const stageRank = (s: unknown) => STAGES.indexOf(s as Stage);

// Column order is the spec's order. Notes is extra (hidden by default) so it can be edited inline.
const columns = helper.columns([
  helper.accessor("code", { id: "code", header: "Code", sortFn: "text" }),
  helper.accessor("name", { id: "name", header: "Tester", sortFn: "text" }),
  helper.accessor("email", { id: "email", header: "Email", sortFn: "text" }),
  helper.accessor("stage", {
    id: "stage",
    header: "Stage",
    sortFn: (a, b, id) => stageRank(a.getValue(id)) - stageRank(b.getValue(id)),
    filterFn: "equalsString",
  }),
  helper.accessor("progress", { id: "progress", header: "Progress", sortFn: "basic" }),
  helper.accessor("responses_count", { id: "responses_count", header: "Responses", sortFn: "basic" }),
  helper.accessor("helpfulness", { id: "helpfulness", header: "Helpfulness", sortFn: "basic" }),
  helper.accessor("bugs_count", { id: "bugs_count", header: "Bugs found", sortFn: "basic" }),
  helper.accessor("tips_count", { id: "tips_count", header: "Tips shared", sortFn: "basic" }),
  helper.accessor((row) => (row.last_active_at ? new Date(row.last_active_at) : undefined), {
    id: "last_active_at",
    header: "Last activity",
    sortFn: "datetime",
    sortUndefined: "last",
  }),
  helper.accessor("notes", { id: "notes", header: "Notes", sortFn: "text", enableSorting: true }),
]);

const NUMERIC = new Set(["progress", "responses_count", "helpfulness", "bugs_count", "tips_count"]);
const SEARCHABLE = new Set(["code", "name", "email", "stage"]);
const EDITABLE = new Set<string>(["name", "notes"]);

function searchText(columnId: string, value: unknown): string {
  if (columnId === "stage") return `${value} ${STAGE_LABELS[value as Stage] ?? ""}`;
  return value == null ? "" : String(value);
}

export function TesterSheet({
  rows,
  canEdit,
  onOpen,
  onSaveField,
}: {
  rows: SheetRow[];
  canEdit: boolean;
  onOpen: (id: string) => void;
  onSaveField: (id: string, field: EditableField, value: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<{ rowId: string; columnId: EditableField; value: string } | null>(null);

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    initialState: {
      sorting: [{ id: "helpfulness", desc: true }],
      columnVisibility: { notes: false },
    },
    enableSortingRemoval: false,
    // Live updates replace `data`; keep the user's selection when that happens.
    autoResetCellSelection: false,
    getColumnCanGlobalFilter: (column) => SEARCHABLE.has(column.id),
    globalFilterFn: (row, columnId, filterValue) =>
      searchText(columnId, row.getValue(columnId)).toLowerCase().includes(String(filterValue).trim().toLowerCase()),
  });

  const visibleRows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const globalFilter = (table.state.globalFilter as string | undefined) ?? "";
  const stageFilter = (table.getColumn("stage")?.getFilterValue() as string | undefined) ?? "";

  const selected = table.getSelectedCellCount();
  // Recomputed on every render; the selection is at most a few thousand cells.
  const stats = selected > 0 ? selectionStats(table.getSelectedCellRangesData().flat(2)) : null;

  const exportCsv = () => {
    const header = visibleColumns.map((c) => String(c.columnDef.header ?? c.id));
    const body = visibleRows.map((r) =>
      visibleColumns.map((c) => {
        const v = r.getValue(c.id);
        if (c.id === "stage") return STAGE_LABELS[v as Stage];
        if (c.id === "last_active_at") return v instanceof Date ? v.toISOString() : "";
        return v;
      }),
    );
    const blob = new Blob([toCsv(header, body)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `testers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (rowId: string, columnId: string) => {
    if (!canEdit || !EDITABLE.has(columnId)) return false;
    const row = rows.find((r) => r.id === rowId);
    if (!row) return false;
    setEditing({ rowId, columnId: columnId as EditableField, value: columnId === "name" ? row.name : row.notes });
    return true;
  };

  const commitEdit = () => {
    if (!editing) return;
    const row = rows.find((r) => r.id === editing.rowId);
    const current = row ? (editing.columnId === "name" ? row.name : row.notes) : null;
    if (row && editing.value !== current && !(editing.columnId === "name" && !editing.value.trim())) {
      onSaveField(editing.rowId, editing.columnId, editing.value);
    }
    setEditing(null);
    gridRef.current?.focus({ preventScroll: true });
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    const focused = table.getFocusedCell();
    const keyMap: Record<string, "up" | "down" | "left" | "right"> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    if (e.key === "Escape") {
      table.resetCellSelection(true);
      e.preventDefault();
    } else if (keyMap[e.key]) {
      if (!focused) return;
      e.preventDefault();
      if (e.shiftKey) table.extendCellSelection(keyMap[e.key]);
      else table.moveCellSelection(keyMap[e.key]);
    } else if ((e.key === "Enter" || e.key === "F2") && focused) {
      e.preventDefault();
      if (!startEdit(focused.row.id, focused.column.id)) onOpen(focused.row.id);
    } else if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      table.selectAllCells();
    }
  };

  const sortIcon = (dir: false | "asc" | "desc") =>
    dir === "asc" ? <ArrowUpIcon className="size-3.5" /> : dir === "desc" ? <ArrowDownIcon className="size-3.5" /> : <ArrowUpDownIcon className="size-3.5 opacity-30" />;

  const renderValue = (row: SheetRow, columnId: string) => {
    switch (columnId) {
      case "code":
        return row.code ? <span className="font-mono text-xs">{row.code}</span> : <span className="text-muted-foreground">—</span>;
      case "name":
        return (
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate", row.revoked && "text-muted-foreground line-through")}>{row.name}</span>
            {row.badges.map((b) => (
              <span key={b.name} title={b.name} aria-label={`Badge: ${b.name}`} className="text-xs">
                {b.badge}
              </span>
            ))}
            {row.revoked ? <span className="text-destructive text-[10px] uppercase">revoked</span> : null}
          </span>
        );
      case "email":
        return <span className="text-muted-foreground">{row.email}</span>;
      case "stage":
        return <StageDot stage={row.stage} />;
      case "progress":
      case "helpfulness": {
        const v = columnId === "progress" ? row.progress : row.helpfulness;
        return (
          <span className="relative block">
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0 rounded-sm", columnId === "progress" ? "bg-sky-500/20" : "bg-emerald-500/20")}
              style={{ width: `${Math.max(0, Math.min(100, v))}%` }}
            />
            <span className="relative block pr-1 text-right tabular-nums">
              {v}
              {columnId === "progress" ? "%" : ""}
            </span>
          </span>
        );
      }
      case "responses_count":
      case "bugs_count":
      case "tips_count":
        return <span className="block text-right tabular-nums">{row[columnId]}</span>;
      case "last_active_at":
        return (
          <time dateTime={row.last_active_at ?? undefined} title={row.last_active_at ? new Date(row.last_active_at).toLocaleString() : undefined}>
            {relativeTime(row.last_active_at)}
          </time>
        );
      case "notes":
        return <span className="text-muted-foreground block max-w-64 truncate">{row.notes || "—"}</span>;
      default:
        return null;
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <SearchIcon aria-hidden className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Search name, email, code, stage"
            aria-label="Search testers"
            className="pl-8"
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
          />
        </div>
        <NativeSelect
          aria-label="Filter by stage"
          wrapperClassName="w-40"
          value={stageFilter}
          onChange={(e) => table.getColumn("stage")?.setFilterValue(e.target.value || undefined)}
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {visibleRows.length} of {rows.length} testers
        </p>
        <div className="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3Icon /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllLeafColumns().map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(Boolean(v))}
                  onSelect={(e) => e.preventDefault()}
                >
                  {String(column.columnDef.header)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <DownloadIcon /> CSV
          </Button>
        </div>
      </div>

      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        aria-label="Tester sheet. Drag to select cells, Shift+click to extend, Escape to clear, Enter to open a row."
        className="focus-visible:ring-ring/50 relative max-h-[70vh] overflow-auto rounded-md border outline-none focus-visible:ring-[3px]"
      >
        <table role="grid" aria-multiselectable="true" aria-rowcount={visibleRows.length + 1} className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                <th
                  scope="col"
                  className="bg-muted text-muted-foreground sticky top-0 left-0 z-30 w-12 border-r border-b px-2 py-2 text-right text-xs font-medium"
                >
                  #
                </th>
                {group.headers.map((header) => {
                  const dir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                      className={cn(
                        "bg-muted sticky top-0 z-20 border-r border-b px-0 py-0 text-left text-xs font-medium whitespace-nowrap",
                        NUMERIC.has(header.column.id) && "text-right",
                      )}
                    >
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn("hover:bg-accent flex w-full items-center gap-1 px-3 py-2", NUMERIC.has(header.column.id) && "justify-end")}
                      >
                        {String(header.column.columnDef.header)}
                        {sortIcon(dir)}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="text-muted-foreground px-4 py-10 text-center">
                  {rows.length === 0 ? "No testers yet." : "No testers match your search."}
                </td>
              </tr>
            ) : null}
            {visibleRows.map((row, index) => (
              <tr key={row.id} aria-rowindex={index + 2} className="group">
                <th
                  scope="row"
                  className="bg-muted sticky left-0 z-10 border-r border-b p-0 text-right text-xs font-normal"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(row.id)}
                    className="text-muted-foreground hover:text-foreground w-full px-2 py-2 text-right tabular-nums underline-offset-2 hover:underline"
                    aria-label={`Open ${row.original.name}`}
                    title="Open details"
                  >
                    {index + 1}
                  </button>
                </th>
                {row.getVisibleCells().map((cell) => {
                  const isSelected = cell.getIsSelected();
                  const edges = cell.getSelectionEdges();
                  const isEditing = editing?.rowId === row.id && editing.columnId === cell.column.id;
                  const shadows = [
                    edges.top && "inset 0 2px 0 0 var(--color-chart-1)",
                    edges.bottom && "inset 0 -2px 0 0 var(--color-chart-1)",
                    edges.left && "inset 2px 0 0 0 var(--color-chart-1)",
                    edges.right && "inset -2px 0 0 0 var(--color-chart-1)",
                  ].filter(Boolean);
                  return (
                    <td
                      key={cell.id}
                      role="gridcell"
                      aria-selected={isSelected}
                      onMouseDown={(e) => {
                        if (isEditing) return;
                        gridRef.current?.focus({ preventScroll: true });
                        cell.getSelectionStartHandler()(e.nativeEvent);
                      }}
                      onMouseEnter={(e) => cell.getSelectionExtendHandler()(e.nativeEvent)}
                      onDoubleClick={() => {
                        if (!startEdit(row.id, cell.column.id)) onOpen(row.id);
                      }}
                      style={shadows.length ? { boxShadow: shadows.join(", ") } : undefined}
                      className={cn(
                        "max-w-72 cursor-cell border-r border-b px-3 py-2 whitespace-nowrap select-none",
                        "group-hover:bg-muted/40 hover:!bg-accent",
                        isSelected && "bg-selection group-hover:bg-selection",
                        NUMERIC.has(cell.column.id) && "min-w-28",
                        row.original.revoked && "opacity-60",
                      )}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          aria-label={`Edit ${cell.column.columnDef.header}`}
                          className="bg-background ring-ring w-full min-w-40 rounded-sm px-1 outline-none focus:ring-2"
                          value={editing.value}
                          maxLength={editing.columnId === "name" ? 200 : 10000}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          onBlur={commitEdit}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") {
                              setEditing(null);
                              gridRef.current?.focus({ preventScroll: true });
                            }
                          }}
                        />
                      ) : (
                        renderValue(row.original, cell.column.id)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-muted-foreground flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 text-xs" aria-live="polite">
        {stats ? (
          <>
            <span>
              <strong className="text-foreground">{stats.count}</strong> cell{stats.count === 1 ? "" : "s"} selected
            </span>
            {stats.numeric > 0 ? (
              <>
                <span>
                  Sum <strong className="text-foreground tabular-nums">{formatNumber(stats.sum)}</strong>
                </span>
                <span>
                  Average <strong className="text-foreground tabular-nums">{formatNumber(stats.avg ?? 0)}</strong>
                </span>
              </>
            ) : null}
            <span className="hidden sm:inline">Esc to clear</span>
          </>
        ) : (
          <span>
            Drag across cells to select (Shift+click extends). Click a row number to open a tester{canEdit ? "; double-click a name or note to edit" : ""}.
          </span>
        )}
      </div>
    </div>
  );
}

export function useSheetRows<T extends Omit<SheetRow, "badges" | "code" | "revoked">>(
  testers: (T & { referral_code_id: string | null; access_revoked_at: string | null })[],
  codes: Record<string, string>,
  badges: Record<string, { badge: string; name: string }[]>,
): SheetRow[] {
  return useMemo(
    () =>
      testers.map((t) => ({
        id: t.id,
        code: t.referral_code_id ? (codes[t.referral_code_id] ?? null) : null,
        name: t.name,
        email: t.email,
        stage: t.stage,
        progress: t.progress,
        responses_count: t.responses_count,
        helpfulness: t.helpfulness,
        bugs_count: t.bugs_count,
        tips_count: t.tips_count,
        last_active_at: t.last_active_at,
        notes: t.notes,
        revoked: Boolean(t.access_revoked_at),
        badges: badges[t.id] ?? [],
      })),
    [testers, codes, badges],
  );
}
