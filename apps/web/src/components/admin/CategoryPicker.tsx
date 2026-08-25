"use client";

import React, { useCallback, useMemo, useState } from "react";

type Locale = "tr" | "en";

type LocalizedText =
  | string
  | {
    tr?: string | null;
    en?: string | null;
  }
  | null
  | undefined;

export type CategoryDoc = {
  id: string;
  name: LocalizedText;
  slug: string;
  parentId?: string | null;
  order?: number | null;
  isActive?: boolean;
};

type CategoryNode = CategoryDoc & {
  children: CategoryNode[];
};

type CategoryPickerProps = {
  cats: CategoryDoc[];
  value: string[];
  onChange: (next: string[]) => void;
  loc?: Locale;

  /**
   * Alt kategori seçildiğinde üst parent kategorileri de
   * otomatik olarak categoryIds içerisine eklenir.
   */
  autoIncludeParent?: boolean;

  /**
   * Parent kaldırıldığında alt kategorileri de kaldırır.
   * Varsayılan true.
   */
  removeChildrenWithParent?: boolean;

  /**
   * Pasif kategorileri göster/gizle.
   */
  showInactive?: boolean;
};

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function pickText(
  value: LocalizedText,
  locale: Locale = "tr",
): string {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  const tr = str(value.tr);
  const en = str(value.en);

  if (locale === "en") {
    return en || tr;
  }

  return tr || en;
}

function normalizeSearch(value: unknown): string {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

function compareCategories(
  a: CategoryDoc,
  b: CategoryDoc,
  locale: Locale,
): number {
  const orderA = Number.isFinite(Number(a.order))
    ? Number(a.order)
    : 999999;

  const orderB = Number.isFinite(Number(b.order))
    ? Number(b.order)
    : 999999;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return pickText(a.name, locale).localeCompare(
    pickText(b.name, locale),
    locale === "tr" ? "tr" : "en",
    {
      sensitivity: "base",
    },
  );
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((item) => str(item))
        .filter(Boolean),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/*                              CATEGORY PICKER                               */
/* -------------------------------------------------------------------------- */

export default function CategoryPicker({
  cats,
  value,
  onChange,
  loc = "tr",
  autoIncludeParent = true,
  removeChildrenWithParent = true,
  showInactive = true,
}: CategoryPickerProps) {
  const [query, setQuery] = useState("");

  const [open, setOpen] = useState<Record<string, boolean>>({});

  /* ------------------------------------------------------------------------ */
  /*                              CLEAN CATEGORIES                            */
  /* ------------------------------------------------------------------------ */

  const cleanCats = useMemo(() => {
    const seen = new Set<string>();

    return (cats ?? []).filter((category) => {
      const id = str(category?.id);

      if (!id) return false;

      if (seen.has(id)) return false;

      if (!showInactive && category.isActive === false) {
        return false;
      }

      seen.add(id);

      return true;
    });
  }, [cats, showInactive]);

  /* ------------------------------------------------------------------------ */
  /*                                CATEGORY MAP                              */
  /* ------------------------------------------------------------------------ */

  const byId = useMemo(() => {
    const map = new Map<string, CategoryDoc>();

    cleanCats.forEach((category) => {
      map.set(str(category.id), category);
    });

    return map;
  }, [cleanCats]);

  /* ------------------------------------------------------------------------ */
  /*                              CHILDREN MAP                                */
  /* ------------------------------------------------------------------------ */

  const childrenByParent = useMemo(() => {
    const map = new Map<string, CategoryDoc[]>();

    cleanCats.forEach((category) => {
      const parentId = str(category.parentId);

      if (!parentId) return;

      const current = map.get(parentId) ?? [];

      current.push(category);

      map.set(parentId, current);
    });

    for (const [parentId, children] of map.entries()) {
      map.set(
        parentId,
        [...children].sort((a, b) =>
          compareCategories(a, b, loc),
        ),
      );
    }

    return map;
  }, [cleanCats, loc]);

  /* ------------------------------------------------------------------------ */
  /*                              BUILD TREE                                  */
  /* ------------------------------------------------------------------------ */

  const roots = useMemo<CategoryNode[]>(() => {
    /**
     * Circular parent ilişkisi olması durumunda
     * sonsuz recursion oluşmasını engeller.
     */
    function buildNode(
      category: CategoryDoc,
      ancestors: Set<string>,
    ): CategoryNode {
      const id = str(category.id);

      if (ancestors.has(id)) {
        return {
          ...category,
          children: [],
        };
      }

      const nextAncestors = new Set(ancestors);
      nextAncestors.add(id);

      const children = childrenByParent.get(id) ?? [];

      return {
        ...category,
        children: children.map((child) =>
          buildNode(child, nextAncestors),
        ),
      };
    }

    /**
     * Parent'ı olmayan kategoriler normal root.
     *
     * Parent ID verilmiş fakat parent artık veritabanında
     * bulunmuyorsa kategori kaybolmasın diye onu da root
     * olarak gösteriyoruz.
     */
    const rootCategories = cleanCats.filter((category) => {
      const parentId = str(category.parentId);

      return !parentId || !byId.has(parentId);
    });

    return [...rootCategories]
      .sort((a, b) => compareCategories(a, b, loc))
      .map((category) => buildNode(category, new Set()));
  }, [cleanCats, childrenByParent, byId, loc]);

  /* ------------------------------------------------------------------------ */
  /*                               SELECTED                                   */
  /* ------------------------------------------------------------------------ */

  const selected = useMemo(() => {
    return new Set(uniqueStrings(value ?? []));
  }, [value]);

  /* ------------------------------------------------------------------------ */
  /*                                  LABEL                                   */
  /* ------------------------------------------------------------------------ */

  const label = useCallback(
    (category: CategoryDoc): string => {
      return (
        pickText(category.name, loc) ||
        str(category.slug) ||
        str(category.id)
      );
    },
    [loc],
  );

  /* ------------------------------------------------------------------------ */
  /*                            PARENT HELPERS                                */
  /* ------------------------------------------------------------------------ */

  const addParentChain = useCallback(
    (
      categoryId: string,
      target: Set<string>,
    ) => {
      const visited = new Set<string>();

      let current = byId.get(categoryId);

      while (current) {
        const parentId = str(current.parentId);

        if (!parentId) break;

        if (visited.has(parentId)) {
          break;
        }

        visited.add(parentId);

        if (!byId.has(parentId)) {
          break;
        }

        target.add(parentId);

        current = byId.get(parentId);
      }
    },
    [byId],
  );

  /* ------------------------------------------------------------------------ */
  /*                           DESCENDANT HELPERS                             */
  /* ------------------------------------------------------------------------ */

  const removeDescendants = useCallback(
    (
      categoryId: string,
      target: Set<string>,
    ) => {
      const visited = new Set<string>();

      function walk(id: string) {
        if (visited.has(id)) return;

        visited.add(id);

        const children =
          childrenByParent.get(id) ?? [];

        children.forEach((child) => {
          const childId = str(child.id);

          target.delete(childId);

          walk(childId);
        });
      }

      walk(categoryId);
    },
    [childrenByParent],
  );

  /* ------------------------------------------------------------------------ */
  /*                                 TOGGLE                                   */
  /* ------------------------------------------------------------------------ */

  const toggle = useCallback(
    (
      id: string,
      checked: boolean,
    ) => {
      const cleanId = str(id);

      if (!cleanId) return;

      const next = new Set(selected);

      if (checked) {
        next.add(cleanId);

        if (autoIncludeParent) {
          addParentChain(cleanId, next);
        }
      } else {
        next.delete(cleanId);

        if (removeChildrenWithParent) {
          removeDescendants(cleanId, next);
        }
      }

      onChange(Array.from(next));
    },
    [
      selected,
      autoIncludeParent,
      removeChildrenWithParent,
      addParentChain,
      removeDescendants,
      onChange,
    ],
  );

  /* ------------------------------------------------------------------------ */
  /*                                 SEARCH                                   */
  /* ------------------------------------------------------------------------ */

  const normalizedQuery = normalizeSearch(query);

  const filteredRoots = useMemo<CategoryNode[]>(() => {
    if (!normalizedQuery) {
      return roots;
    }

    function matches(category: CategoryDoc): boolean {
      const searchable = [
        label(category),
        category.slug,
        category.id,
      ]
        .map(normalizeSearch)
        .join(" ");

      return searchable.includes(normalizedQuery);
    }

    function filterNode(
      node: CategoryNode,
    ): CategoryNode | null {
      /**
       * Parent eşleşiyorsa bütün alt kategorileri göster.
       */
      if (matches(node)) {
        return node;
      }

      const filteredChildren = node.children
        .map(filterNode)
        .filter(
          (
            child,
          ): child is CategoryNode => child !== null,
        );

      if (filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }

      return null;
    }

    return roots
      .map(filterNode)
      .filter(
        (
          root,
        ): root is CategoryNode => root !== null,
      );
  }, [roots, normalizedQuery, label]);

  /* ------------------------------------------------------------------------ */
  /*                             SELECTED LIST                                */
  /* ------------------------------------------------------------------------ */

  const selectedList = useMemo(() => {
    const output: CategoryDoc[] = [];

    selected.forEach((id) => {
      const category = byId.get(id);

      if (category) {
        output.push(category);
        return;
      }

      /**
       * Artık mevcut olmayan eski kategori ID'si
       * varsa kullanıcı yine de kaldırabilsin.
       */
      output.push({
        id,
        name: id,
        slug: id,
      });
    });

    function depth(category: CategoryDoc): number {
      let count = 0;
      let current = category;

      const visited = new Set<string>();

      while (current) {
        const parentId = str(current.parentId);

        if (!parentId) break;

        if (visited.has(parentId)) break;

        visited.add(parentId);

        const parent = byId.get(parentId);

        if (!parent) break;

        count += 1;
        current = parent;
      }

      return count;
    }

    output.sort((a, b) => {
      const depthDifference =
        depth(a) - depth(b);

      if (depthDifference !== 0) {
        return depthDifference;
      }

      return label(a).localeCompare(
        label(b),
        loc === "tr" ? "tr" : "en",
        {
          sensitivity: "base",
        },
      );
    });

    return output;
  }, [selected, byId, label, loc]);

  /* ------------------------------------------------------------------------ */
  /*                              MANUAL IDs                                  */
  /* ------------------------------------------------------------------------ */

  const manualValue = useMemo(
    () => Array.from(selected).join(","),
    [selected],
  );

  function handleManualChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const ids = uniqueStrings(
      event.target.value.split(","),
    );

    onChange(ids);
  }

  /* ------------------------------------------------------------------------ */
  /*                              RENDER NODE                                 */
  /* ------------------------------------------------------------------------ */

  function renderNode(
    node: CategoryNode,
    depth = 0,
  ): React.ReactNode {
    const id = str(node.id);

    const hasChildren =
      node.children.length > 0;

    /**
     * Arama yapılırken eşleşen branch'leri otomatik açık tut.
     */
    const isOpen = normalizedQuery
      ? true
      : (open[id] ?? depth === 0);

    const isChecked = selected.has(id);

    const isInactive =
      node.isActive === false;

    return (
      <div
        key={id}
        style={{
          ...nodeContainer,
          marginLeft:
            depth === 0
              ? 0
              : Math.min(depth * 14, 56),
        }}
      >
        <div
          style={{
            ...nodeRow,
            ...(depth === 0
              ? rootRow
              : childRow),
            opacity: isInactive
              ? 0.58
              : 1,
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              style={caretButton}
              onClick={() => {
                setOpen((current) => ({
                  ...current,
                  [id]: !isOpen,
                }));
              }}
              aria-label={
                isOpen
                  ? `${label(node)} kategorisini kapat`
                  : `${label(node)} kategorisini aç`
              }
              aria-expanded={isOpen}
            >
              {isOpen ? "▾" : "▸"}
            </button>
          ) : (
            <div style={caretPlaceholder}>
              •
            </div>
          )}

          <label
            style={checkboxLabel}
            title={`${label(node)} / ${node.slug || id}`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(event) =>
                toggle(
                  id,
                  event.target.checked,
                )
              }
            />

            <div style={categoryContent}>
              <div style={categoryTitleRow}>
                <span
                  style={
                    depth === 0
                      ? rootName
                      : childName
                  }
                >
                  {label(node)}
                </span>

                {isInactive ? (
                  <span style={inactiveBadge}>
                    Pasif
                  </span>
                ) : null}

                {hasChildren ? (
                  <span style={countBadge}>
                    {node.children.length}
                  </span>
                ) : null}
              </div>

              <div style={categoryMeta}>
                {node.slug
                  ? `/${node.slug}`
                  : "slug yok"}
                {" • "}
                {id}
              </div>
            </div>
          </label>
        </div>

        {hasChildren && isOpen ? (
          <div style={childrenContainer}>
            {node.children.map((child) =>
              renderNode(
                child,
                depth + 1,
              ),
            )}
          </div>
        ) : null}
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  UI                                      */
  /* ------------------------------------------------------------------------ */

  return (
    <div style={wrapper}>
      {/* HEADER */}

      <div style={header}>
        <div style={headerText}>
          <div style={title}>
            Kategoriler
          </div>

          <div style={subtitle}>
            Seçilen:{" "}
            <strong>
              {selected.size}
            </strong>
            {" • "}
            Kategori ağacından seçim yap
          </div>
        </div>

        <input
          type="search"
          style={searchInput}
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Kategori ara…"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* SELECTED CHIPS */}

      <div style={chipsWrapper}>
        {selectedList.length > 0 ? (
          <>
            {selectedList
              .slice(0, 30)
              .map((category) => (
                <button
                  key={category.id}
                  type="button"
                  style={chip}
                  title={`${label(category)} kategorisini kaldır`}
                  onClick={() =>
                    toggle(
                      category.id,
                      false,
                    )
                  }
                >
                  <span>
                    {label(category)}
                  </span>

                  <span style={chipClose}>
                    ×
                  </span>
                </button>
              ))}

            {selectedList.length > 30 ? (
              <div style={moreText}>
                +
                {selectedList.length - 30}{" "}
                kategori daha
              </div>
            ) : null}
          </>
        ) : (
          <div style={emptyText}>
            Henüz kategori seçilmedi.
          </div>
        )}
      </div>

      {/* CATEGORY TREE */}

      <div style={panel}>
        {filteredRoots.length === 0 ? (
          <div style={searchEmpty}>
            <div style={searchEmptyIcon}>
              🔎
            </div>

            <div style={searchEmptyTitle}>
              Kategori bulunamadı
            </div>

            <div style={searchEmptyDescription}>
              “{query}” aramasına uygun
              kategori yok.
            </div>
          </div>
        ) : (
          filteredRoots.map((root) =>
            renderNode(root),
          )
        )}
      </div>

      {/* ADVANCED */}

      <details style={details}>
        <summary style={summary}>
          Gelişmiş
        </summary>

        <div style={detailsContent}>
          <div style={subtitle}>
            Manuel kategori ID'leri.
            Virgülle ayırabilirsin.
            Değerler{" "}
            <code>categoryIds</code>{" "}
            dizisine gönderilir.
          </div>

          <input
            style={{
              ...searchInput,
              width: "100%",
            }}
            value={manualValue}
            onChange={handleManualChange}
            placeholder="id1,id2,id3"
            spellCheck={false}
          />
        </div>
      </details>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   STYLES                                   */
/* -------------------------------------------------------------------------- */

const wrapper: React.CSSProperties = {
  width: "100%",
  background: "#ffffff",
  border:
    "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 18,
  padding: 14,
  boxShadow:
    "0 1px 2px rgba(15, 23, 42, 0.03)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
};

const headerText: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const title: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#0f172a",
};

const subtitle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: "#64748b",
  fontWeight: 650,
};

const searchInput: React.CSSProperties = {
  width: 360,
  maxWidth: "100%",
  height: 42,
  borderRadius: 12,
  border:
    "1px solid rgba(15, 23, 42, 0.12)",
  background: "#ffffff",
  padding: "0 13px",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 700,
  outline: "none",
};

const chipsWrapper: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 7,
  marginTop: 12,
};

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  minHeight: 32,
  padding: "6px 10px",
  borderRadius: 999,
  border:
    "1px solid rgba(15, 23, 42, 0.09)",
  background: "#f1f5f9",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const chipClose: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1,
  opacity: 0.55,
};

const moreText: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 700,
};

const emptyText: React.CSSProperties = {
  padding: "5px 2px",
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 700,
};

const panel: React.CSSProperties = {
  marginTop: 13,
  maxHeight: 430,
  overflowY: "auto",
  overflowX: "hidden",
  display: "grid",
  gap: 8,
  padding: 10,
  border:
    "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 15,
  background: "#f8fafc",
};

const nodeContainer: React.CSSProperties = {
  minWidth: 0,
};

const nodeRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const rootRow: React.CSSProperties = {
  padding: "10px 11px",
  border:
    "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 13,
  background: "#ffffff",
};

const childRow: React.CSSProperties = {
  padding: "8px 10px",
  border:
    "1px solid rgba(15, 23, 42, 0.06)",
  borderRadius: 11,
  background: "rgba(255,255,255,0.75)",
};

const caretButton: React.CSSProperties = {
  flex: "0 0 auto",
  width: 30,
  height: 30,
  display: "grid",
  placeItems: "center",
  borderRadius: 9,
  border:
    "1px solid rgba(15, 23, 42, 0.09)",
  background: "#f8fafc",
  color: "#475569",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 900,
};

const caretPlaceholder: React.CSSProperties = {
  flex: "0 0 auto",
  width: 30,
  height: 30,
  display: "grid",
  placeItems: "center",
  color: "#cbd5e1",
  fontSize: 12,
};

const checkboxLabel: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
};

const categoryContent: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "grid",
  gap: 3,
};

const categoryTitleRow: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const rootName: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 900,
};

const childName: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#1e293b",
  fontSize: 13,
  fontWeight: 800,
};

const categoryMeta: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 650,
};

const countBadge: React.CSSProperties = {
  flex: "0 0 auto",
  minWidth: 21,
  height: 21,
  display: "grid",
  placeItems: "center",
  padding: "0 6px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#64748b",
  fontSize: 10,
  fontWeight: 900,
};

const inactiveBadge: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "3px 6px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#64748b",
  fontSize: 9,
  fontWeight: 900,
};

const childrenContainer: React.CSSProperties = {
  display: "grid",
  gap: 6,
  marginTop: 6,
};

const searchEmpty: React.CSSProperties = {
  minHeight: 130,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  textAlign: "center",
  padding: 20,
};

const searchEmptyIcon: React.CSSProperties = {
  fontSize: 22,
  marginBottom: 7,
};

const searchEmptyTitle: React.CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const searchEmptyDescription: React.CSSProperties = {
  marginTop: 3,
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 650,
};

const details: React.CSSProperties = {
  marginTop: 11,
};

const summary: React.CSSProperties = {
  cursor: "pointer",
  color: "#475569",
  fontSize: 12,
  fontWeight: 850,
  userSelect: "none",
};

const detailsContent: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 9,
};