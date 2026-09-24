# Bulk Data Files

Scryfall provides daily exports of our card data in bulk files.
Each of these files is represented as a `bulk_data` object via the API.
URLs for files change their timestamp each day,
and can be [fetched programmatically](/docs/api/bulk-data/all).

**Each bulk file is a gzipped [JSONL (JSON Lines)](https://jsonltools.com/what-is-jsonl) archive:**

* You will specifically download a `jsonl.gz` archive and need to decompress or stream it on disk.
  They are not wrapped in tarballs (it’s just `.gz`, not `.tar.gz`)
* Many programing languages offer a way to stream JSONL directly from the gzip
  archive without having to decompress the entire file at once or load the entire file into system memory.
  For example, Ruby has [Zlib::GzipReader#each\_line](https://docs.ruby-lang.org/en/master/Zlib/GzipReader.html)
* On POSIX systems you can use [gunzip](https://manpages.debian.org/trixie/gzip/gunzip.1.en.html) from the shell

**Please note:**

* Card objects in bulk data include price information,
  but **prices should be considered dangerously stale after 24 hours**.
  Only use bulk price information to track trends or provide a general estimate of card value.
  Prices are not updated frequently enough to power a storefront or sales system.
  You consume price information at your own risk.
* Updates to gameplay data (such as card names, Oracle text, mana costs, etc) are much less frequent.
  If you only need gameplay information, downloading card data once per week or right after set releases
  would most likely be sufficient.
* Every card type in every product is included, including
  [double-faced cards](/search?q=is%3Adfc),
  [planar cards](/search?q=t%3Aplane+or+t%3Aphenom),
  [schemes](/search?q=t%3Ascheme),
  [vanguards](/search?q=t%3Avanguard),
  [tokens](/search?q=t%3Atoken),
  and [funny cards](/search?q=is%3Afunny).
  Make sure you’ve reviewed [documentation for the Card type](/docs/api/cards).
* The **Art Tags** and **Oracle Tags** files contain community-maintained tag data
  from the [Tagger project](https://tagger.scryfall.com).
  See the [Tags](/docs/api/tags) documentation for the object format
  and guidance on joining tags to cards.

Bulk data is only collected once every 12-24 hours.
You can use the [card API methods](/docs/api/cards)
to retrieve fresh objects instead.
You can also use the [/cards/manifest](/docs/api/cards/manifest)
method to check for anything that has changed on Scryfall.

## Files

| File | Link | Compressed Size | Last Updated |
| --- | --- | --- | --- |
| **Oracle Cards** | [Download](https://data.scryfall.io/oracle-cards/oracle-cards-20260924210155.jsonl.gz) | 23.4 MB | 2026-09-24 21:01 UTC |
| A JSON file containing one Scryfall card object for each Oracle ID on Scryfall. The chosen sets for the cards are an attempt to return the most up-to-date recognizable version of the card. | | | |
| **Unique Artwork** | [Download](https://data.scryfall.io/unique-artwork/unique-artwork-20260924210228.jsonl.gz) | 36 MB | 2026-09-24 21:02 UTC |
| A JSON file of Scryfall card objects that together contain all unique artworks. The chosen cards promote the best image scans. | | | |
| **Default Cards** | [Download](https://data.scryfall.io/default-cards/default-cards-20260924210536.jsonl.gz) | 75 MB | 2026-09-24 21:05 UTC |
| A JSON file containing every card object on Scryfall in English or the printed language if the card is only available in one language. | | | |
| **All Cards** | [Download](https://data.scryfall.io/all-cards/all-cards-20260924211809.jsonl.gz) | 375 MB | 2026-09-24 21:18 UTC |
| A JSON file containing every card object on Scryfall in every language. | | | |
| **Rulings** | [Download](https://data.scryfall.io/rulings/rulings-20260924210034.jsonl.gz) | 5.12 MB | 2026-09-24 21:00 UTC |
| A JSON file containing all Rulings on Scryfall. Each ruling refers to cards via an `oracle\_id`. | | | |
| **Art Tags** | [Download](https://data.scryfall.io/art-tags/art-tags-20260924210118.jsonl.gz) | 12.3 MB | 2026-09-24 21:01 UTC |
| A JSON file containing all art (illustration) tags sourced from Tagger, the Scryfall community tagging project. | | | |
| **Oracle Tags** | [Download](https://data.scryfall.io/oracle-tags/oracle-tags-20260924210036.jsonl.gz) | 5.73 MB | 2026-09-24 21:00 UTC |
| A JSON file containing all Oracle tags sourced from Tagger, the Scryfall community tagging project. | | | |

## Fields

Bulk data objects have the following properties:

| Property | Type | Atn | Details |
| --- | --- | --- | --- |
| `id` | UUID |  | A unique ID for this bulk item. |
| `uri` | URI |  | The Scryfall API URI for this file. |
| `type` | String |  | A computer-readable string for the kind of bulk item. |
| `name` | String |  | A human-readable name for this file. |
| `description` | String |  | A human-readable description for this file. |
| `updated_at` | Timestamp |  | The time when this file was last updated. |
| `jsonl_download_uri` | URI |  | The URI that hosts this bulk as jsonl.gz for fetching. |
| `compressed_size` | Integer |  | The size of the compressed jsonl.gz file in integer bytes. |

## Example Request

Retrieve all bulk data items:

GET

https://api.scryfall.com/bulk-data