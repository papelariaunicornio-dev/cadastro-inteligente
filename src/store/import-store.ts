import { create } from 'zustand';
import type { NfImport, NfItem, ItemClassification } from '@/lib/types';
import { nanoid } from 'nanoid';

export interface ItemGroup {
  id: string;
  name: string;
  itemIds: number[];
}

interface ImportState {
  // Data
  nfImport: NfImport | null;
  items: NfItem[];

  // UI state
  activeTab: 'sem_variacao' | 'com_variacao' | 'multiplos_itens';
  loading: boolean;

  // Selections: Map of itemId -> classification
  selections: Map<number, ItemClassification>;

  // Groups for multiplos_itens
  groups: ItemGroup[];
  pendingGroupSelection: Set<number>;

  // Actions
  setNfData: (nfImport: NfImport, items: NfItem[]) => void;
  setActiveTab: (tab: ImportState['activeTab']) => void;
  setLoading: (loading: boolean) => void;

  // Selection actions
  toggleItem: (itemId: number) => void;
  setUndItem: (itemId: number, und: number) => void;

  // Group actions (multiplos_itens)
  togglePendingGroup: (itemId: number) => void;
  confirmGroup: () => void;
  removeGroup: (groupId: string) => void;

  // Computed
  getSelectedCount: () => number;
  getItemClassification: (itemId: number) => ItemClassification | null;
  isItemLocked: (itemId: number) => boolean;
  canProceed: () => boolean;

  // Reset
  reset: () => void;
}

export const useImportStore = create<ImportState>((set, get) => ({
  nfImport: null,
  items: [],
  activeTab: 'sem_variacao',
  loading: false,
  selections: new Map(),
  groups: [],
  pendingGroupSelection: new Set(),

  setNfData: (nfImport, items) => set({ nfImport, items }),
  setActiveTab: (tab) => set({ activeTab: tab, pendingGroupSelection: new Set() }),
  setLoading: (loading) => set({ loading }),

  toggleItem: (itemId) => {
    const state = get();
    const { activeTab, selections, groups } = state;

    // Can't toggle items that are in a group (if not on multiplos_itens tab)
    if (activeTab !== 'multiplos_itens') {
      const isInGroup = groups.some((g) => g.itemIds.includes(itemId));
      if (isInGroup) return;
    }

    const newSelections = new Map(selections);

    if (activeTab === 'multiplos_itens') {
      // In multiplos_itens, toggling is handled via pendingGroupSelection
      return;
    }

    const currentClass = newSelections.get(itemId);

    if (currentClass === activeTab) {
      // Deselect
      newSelections.delete(itemId);
    } else {
      // Select in current tab (removes from any other tab)
      newSelections.set(itemId, activeTab);
    }

    set({ selections: newSelections });
  },

  setUndItem: (itemId, und) => {
    const items = get().items.map((item) =>
      item.Id === itemId ? { ...item, unidades_por_item: und } : item
    );
    set({ items });
  },

  togglePendingGroup: (itemId) => {
    const state = get();
    // Can't select items already in a confirmed group
    const isInGroup = state.groups.some((g) => g.itemIds.includes(itemId));
    if (isInGroup) return;

    // Can't select items classified in other tabs
    const currentClass = state.selections.get(itemId);
    if (currentClass && currentClass !== 'multiplos_itens') return;

    const newPending = new Set(state.pendingGroupSelection);
    if (newPending.has(itemId)) {
      newPending.delete(itemId);
    } else {
      newPending.add(itemId);
    }
    set({ pendingGroupSelection: newPending });
  },

  confirmGroup: () => {
    const state = get();
    const { pendingGroupSelection, groups, selections } = state;

    if (pendingGroupSelection.size < 2) return;

    const groupId = nanoid(8);
    const itemIds = Array.from(pendingGroupSelection);
    const groupNumber = groups.length + 1;

    const newGroup: ItemGroup = {
      id: groupId,
      name: `Grupo ${groupNumber}`,
      itemIds,
    };

    // Mark all items in this group as multiplos_itens
    const newSelections = new Map(selections);
    for (const id of itemIds) {
      newSelections.set(id, 'multiplos_itens');
    }

    set({
      groups: [...groups, newGroup],
      selections: newSelections,
      pendingGroupSelection: new Set(),
    });
  },

  removeGroup: (groupId) => {
    const state = get();
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return;

    const newSelections = new Map(state.selections);
    for (const id of group.itemIds) {
      newSelections.delete(id);
    }

    set({
      groups: state.groups.filter((g) => g.id !== groupId),
      selections: newSelections,
    });
  },

  getSelectedCount: () => get().selections.size,

  getItemClassification: (itemId) => get().selections.get(itemId) ?? null,

  isItemLocked: (itemId) => {
    const state = get();
    const { activeTab, selections, groups } = state;

    // In multiplos_itens tab, items in confirmed groups are locked
    if (activeTab === 'multiplos_itens') {
      return groups.some((g) => g.itemIds.includes(itemId));
    }

    // In other tabs, items in groups are locked
    const isInGroup = groups.some((g) => g.itemIds.includes(itemId));
    if (isInGroup) return true;

    // Items classified in the OTHER non-group tab are not locked (they can be re-classified)
    return false;
  },

  canProceed: () => get().selections.size > 0,

  reset: () =>
    set({
      nfImport: null,
      items: [],
      activeTab: 'sem_variacao',
      loading: false,
      selections: new Map(),
      groups: [],
      pendingGroupSelection: new Set(),
    }),
}));
