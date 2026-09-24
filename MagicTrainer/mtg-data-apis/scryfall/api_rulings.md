# Rulings Objects

Rulings represent Oracle rulings, Wizards of the Coast set release notes,
or Scryfall notes for a particular card.

If two cards have the same name, they will have the same set of rulings objects.
If a card has rulings, it usually has more than one.

Rulings with a `scryfall` source have been added by the Scryfall team, either
to provide additional context for the card, or explain how the card
works in an unofficial format (such as Duel Commander).

Ruling objects have the following properties:

| Property | Type | Atn | Details |
| --- | --- | --- | --- |
| `object` | String |  | A content type for this object, always `ruling`. |
| `oracle_id` | UUID |  | The Oracle ID of the card this ruling is associated with. |
| `source` | String |  | A computer-readable string indicating which company produced this ruling, either `wotc` or `scryfall`. |
| `published_at` | Date |  | The date when the ruling or note was published. |
| `comment` | String |  | The text of the ruling. |

## Example Requests

Fetch rulings for Derevi, Empyrial Tactician

GET

https://api.scryfall.com/cards/cma/176/rulings