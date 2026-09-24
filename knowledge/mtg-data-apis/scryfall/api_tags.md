# Tags

Scryfall provides two types of tags, both sourced from the community-maintained
[Tagger project](https://tagger.scryfall.com):

* **Art tags** (`type: "illustration"`) — describe what is depicted in a card’s artwork,
  such as creatures, settings, or visual motifs.
* **Oracle tags** (`type: "oracle"`) — describe the functional role of a card,
  such as removal, ramp, or draw.

**⚠️ Please note:** Tags are sourced from the [Tagger project](https://tagger.scryfall.com),
a community-maintained database.
Tag data is subject to change as the community adds, edits, and removes tags.
Scryfall performs content moderation on Tagger data.
However, we cannot guarantee that tag data is 100% free from
intentional errors or abuse.

* Do not treat tag slugs or labels as permanent identifiers in your application.
  Use the `id` field (a stable UUID) to track specific tags across data updates.
* Downstream applications are strongly recomended to implement
  a way to temporarily disable display of individual tags.

Tags are available as [bulk data files](/docs/api/bulk-data) and are updated daily.

## Tag Object

A tag object has the following properties:

| Property | Type | Atn | Details |
| --- | --- | --- | --- |
| `object` | String |  | A content type for this object, always `tag`. |
| `id` | UUID |  | A unique and stable UUID for this tag. |
| `slug` | String |  | A URL-safe identifier for the tag, e.g. `squirrel`. Slugs may change over time; use `id` as a stable reference. |
| `label` | String |  | A human-readable name for this tag, e.g. `Squirrel`. |
| `uri` | URI |  | A link to this tag on the Tagger site. |
| `type` | String |  | The tag type: `illustration` for art tags or `oracle` for oracle tags. |
| `description` | String | Nullable | An optional description of what this tag represents. |
| `parent_ids` | Array | Nullable | UUIDs of parent tags in the tag hierarchy within this bulk file. |
| `child_ids` | Array | Nullable | UUIDs of child tags in the tag hierarchy within this bulk file. |
| `aliases` | Array | Nullable | Alternative names the community uses for this tag. |
| `taggings` | Array |  | An array of tagging objects associating this tag with specific cards. |

## Tagging Objects

Each entry in the `taggings` array links a tag to a specific card. Art tag taggings
use `illustration_id`; oracle tag taggings use `oracle_id`.

| Property | Type | Atn | Details |
| --- | --- | --- | --- |
| `illustration_id` | UUID | Nullable | For art tags: the `illustration_id` of the card artwork that has this tagging. |
| `oracle_id` | UUID | Nullable | For oracle tags: the `oracle_id` of the card that has this tagging. |
| `weight` | String |  | How prominently the tag applies to this card. See Tagging Weights below. |
| `annotation` | String | Nullable | An optional note providing additional context for this specific tagging. |

## Tagging Weights

Each tagging has a `weight` field indicating how prominently the tag applies:

Weight | Description || `very_strong` | The subject is exemplary for the image or card text. |
| `strong` | The subject is a primary focus of the image or card text. |
| `median` | A normal tagging with no special weight applied. |
| `weak` | The subject is a minor detail or background element. |

## Tag Hierarchy

Tags are organized into a hierarchy using `parent_ids` and `child_ids`, which reference
other tag `id` values within the same bulk file. This lets you traverse from broad categories
down to specific subjects.

The bulk data only includes direct taggings. A parent tag such as `animal` will have no
direct taggings of its own — to find all illustrations tagged `animal`, traverse its
`child_ids`, find those tags in the bulk data, and collect their `taggings`.

## Joining Tags to Cards

Cross-reference taggings with Scryfall’s card bulk data files:

* **Art tags** — match each tagging’s `illustration_id` against the `illustration_id` field
  in the [Unique Artwork](/docs/api/bulk-data) bulk file.
* **Oracle tags** — match each tagging’s `oracle_id` against the `oracle_id` field in the
  [Oracle Cards](/docs/api/bulk-data) bulk file.

## Bulk Data

The **Art Tags** and **Oracle Tags** bulk data files are available on the
[Bulk Data](/docs/api/bulk-data) page.
Each file contains a JSON array of tag objects as described above.