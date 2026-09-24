import { EmptyState, Kbd, Page } from "../components";
import { DeckIcon } from "../icons";
import { useAppStore } from "../store";

export function DecksScreen() {
  const mode = useAppStore((st) => st.mode);
  return (
    <Page
      title="Decks"
      subtitle={mode === "builder" ? "Analyze curve, mana, roles, and detected strategies." : "Pick a deck and watch its winning lines play out against an opponent track."}
    >
      <EmptyState
        icon={<DeckIcon />}
        title="No decks yet"
        body={
          <>
            Deck import (Moxfield, Archidekt, Arena and plain text, plus ManaBox / TCGplayer / Moxfield CSV) lands in Phase 2. Until then, use <Kbd>Rules</Kbd> to look up
            citations and <Kbd>Settings</Kbd> to prepare the card database.
          </>
        }
      />
    </Page>
  );
}
