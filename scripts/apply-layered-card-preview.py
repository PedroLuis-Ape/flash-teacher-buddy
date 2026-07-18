from pathlib import Path

path = Path("src/pages/ListDetail.tsx")
source = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: esperado 1 trecho, encontrado {count}")
    source = source.replace(old, new, 1)


replace_once(
    'import { MergeIntoLayersDialog } from "@/features/cards/components/MergeIntoLayersDialog";\n',
    'import { MergeIntoLayersDialog } from "@/features/cards/components/MergeIntoLayersDialog";\n'
    'import { LayeredCardPreviewDialog } from "@/features/cards/components/LayeredCardPreviewDialog";\n',
    "import do preview",
)

replace_once(
    "  onDelete,\n  onUnmerge,\n}: {\n"
    "  flashcard: Flashcard;\n"
    "  isSelected: boolean;\n"
    "  canEdit: boolean;\n"
    "  userId?: string;\n"
    "  isFavorite: boolean;\n"
    "  isRedListed: boolean;\n"
    "  onToggleSelection: (id: string) => void;\n"
    "  onEdit: (f: Flashcard) => void;\n"
    "  onDelete: (id: string) => void;\n"
    "  onUnmerge?: (id: string) => void;\n"
    "}) => (\n"
    "  <Card className={`p-4 sm:p-6 cursor-pointer hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}>\n",
    "  onDelete,\n  onUnmerge,\n  onViewLayers,\n}: {\n"
    "  flashcard: Flashcard;\n"
    "  isSelected: boolean;\n"
    "  canEdit: boolean;\n"
    "  userId?: string;\n"
    "  isFavorite: boolean;\n"
    "  isRedListed: boolean;\n"
    "  onToggleSelection: (id: string) => void;\n"
    "  onEdit: (f: Flashcard) => void;\n"
    "  onDelete: (id: string) => void;\n"
    "  onUnmerge?: (id: string) => void;\n"
    "  onViewLayers: (f: Flashcard) => void;\n"
    "}) => (\n"
    "  <Card\n"
    "    className={`p-4 sm:p-6 transition-shadow ${flashcard.__layerCount && flashcard.__layerCount > 0 ? 'cursor-pointer hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}\n"
    "    role={flashcard.__layerCount && flashcard.__layerCount > 0 ? \"button\" : undefined}\n"
    "    tabIndex={flashcard.__layerCount && flashcard.__layerCount > 0 ? 0 : undefined}\n"
    "    aria-label={flashcard.__layerCount && flashcard.__layerCount > 0 ? `Ver ${flashcard.__layerCount} camadas do card ${flashcard.term}` : undefined}\n"
    "    onClick={() => {\n"
    "      if (flashcard.__layerCount && flashcard.__layerCount > 0) onViewLayers(flashcard);\n"
    "    }}\n"
    "    onKeyDown={(event) => {\n"
    "      if (!flashcard.__layerCount || flashcard.__layerCount <= 0) return;\n"
    "      if (event.key === \"Enter\" || event.key === \" \") {\n"
    "        event.preventDefault();\n"
    "        onViewLayers(flashcard);\n"
    "      }\n"
    "    }}\n"
    "  >\n",
    "interação da linha",
)

replace_once(
    '        <div className="pt-1">\n',
    '        <div className="pt-1" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n',
    "isolamento do checkbox",
)

replace_once(
    '      <div className="flex items-center gap-1 shrink-0">\n',
    '      <div className="flex items-center gap-1 shrink-0" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n',
    "isolamento das ações",
)

replace_once(
    "  onDelete,\n  onUnmerge,\n}: {\n"
    "  flashcards: Flashcard[];\n"
    "  selectedCards: string[];\n"
    "  canEdit: boolean;\n"
    "  userId?: string;\n"
    "  favorites: string[];\n"
    "  redListIds: string[];\n"
    "  onToggleSelection: (id: string) => void;\n"
    "  onEdit: (f: Flashcard) => void;\n"
    "  onDelete: (id: string) => void;\n"
    "  onUnmerge?: (id: string) => void;\n"
    "}) => {\n",
    "  onDelete,\n  onUnmerge,\n  onViewLayers,\n}: {\n"
    "  flashcards: Flashcard[];\n"
    "  selectedCards: string[];\n"
    "  canEdit: boolean;\n"
    "  userId?: string;\n"
    "  favorites: string[];\n"
    "  redListIds: string[];\n"
    "  onToggleSelection: (id: string) => void;\n"
    "  onEdit: (f: Flashcard) => void;\n"
    "  onDelete: (id: string) => void;\n"
    "  onUnmerge?: (id: string) => void;\n"
    "  onViewLayers: (f: Flashcard) => void;\n"
    "}) => {\n",
    "prop do wrapper",
)

replace_once(
    "              onDelete={onDelete}\n              onUnmerge={onUnmerge}\n",
    "              onDelete={onDelete}\n              onUnmerge={onUnmerge}\n              onViewLayers={onViewLayers}\n",
    "repasse do preview",
)

replace_once(
    "  const [editingFlashcard, setEditingFlashcard] = useState<Flashcard | null>(null);\n",
    "  const [editingFlashcard, setEditingFlashcard] = useState<Flashcard | null>(null);\n"
    "  const [viewingLayeredCard, setViewingLayeredCard] = useState<Flashcard | null>(null);\n",
    "estado do preview",
)

replace_once(
    "  // ── PERF: Memoized filtered flashcard list ──\n",
    "  const viewingLayers = useMemo(() => {\n"
    "    if (!viewingLayeredCard) return [];\n"
    "    return (flashcards as Flashcard[])\n"
    "      .filter((card) => card.parent_card_id === viewingLayeredCard.id)\n"
    "      .sort((left, right) => {\n"
    "        const leftIndex = left.layer_index ?? Number.MAX_SAFE_INTEGER;\n"
    "        const rightIndex = right.layer_index ?? Number.MAX_SAFE_INTEGER;\n"
    "        return leftIndex - rightIndex || left.id.localeCompare(right.id);\n"
    "      });\n"
    "  }, [flashcards, viewingLayeredCard]);\n\n"
    "  // ── PERF: Memoized filtered flashcard list ──\n",
    "camadas selecionadas",
)

replace_once(
    "                 onDelete={handleDeleteFlashcard}\n                 onUnmerge={handleUnmergeLayers}\n",
    "                 onDelete={handleDeleteFlashcard}\n                 onUnmerge={handleUnmergeLayers}\n                 onViewLayers={setViewingLayeredCard}\n",
    "abertura no clique",
)

replace_once(
    "      {/* Edit Dialog */}\n",
    "      {/* Read-only layered card preview opened by clicking the card row */}\n"
    "      <LayeredCardPreviewDialog\n"
    "        open={!!viewingLayeredCard}\n"
    "        onOpenChange={(open) => {\n"
    "          if (!open) setViewingLayeredCard(null);\n"
    "        }}\n"
    "        title={viewingLayeredCard?.term}\n"
    "        layers={viewingLayers}\n"
    "        labelA={effectiveSettings.labelsA}\n"
    "        labelB={effectiveSettings.labelsB}\n"
    "      />\n\n"
    "      {/* Edit Dialog */}\n",
    "render do preview",
)

path.write_text(source, encoding="utf-8")
