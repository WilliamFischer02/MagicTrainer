# GET /cards/search

Rate limit: 2/second (500ms)

Supported formats: `json` and `csv`

Returns a List object containing Cards found using a fulltext search string.
This string supports the same [fulltext search system](/docs/syntax)
that the main site uses.

This method is paginated,
returning 175 cards at a time.
Review the documentation for [paginating the List type](/docs/api/lists) and
and the [Error type](/docs/api-overview#type-error) type to
understand all of the possible output from this method.

If only one card is found, this method will still return a List.

| Parameter | Type | Atn | Details |
| --- | --- | --- | --- |
| `q` | String |  | A fulltext search query. Make sure that your parameter is [properly encoded](https://en.wikipedia.org/wiki/Percent-encoding). Maximum length: 1000 Unicode characters. |
| `unique` | String | Optional | The strategy for omitting similar cards. See below. |
| `order` | String | Optional | The method to sort returned cards. See below. |
| `dir` | String | Optional | The direction to sort cards. See below. |
| `include_extras` | Boolean | Optional | If true, extra cards (tokens, planes, etc) will be included. Equivalent to adding `include:extras` to the fulltext search. Defaults to false. |
| `include_multilingual` | Boolean | Optional | If true, cards in every language supported by Scryfall will be included. Defaults to false. |
| `include_variations` | Boolean | Optional | If true, rare care variants will be included, like the [Hairy Runesword](https://scryfall.com/card/drk/107%E2%80%A0/runesword). Defaults to false. |
| `page` | Integer | Optional | The page number to return, default `1`. |
| `format` | String | Optional | The data format to return: `json` or `csv`. Defaults to `json`. |
| `pretty` | Boolean | Optional | If true, the returned JSON will be prettified. Avoid using for production code. |

## Unique (Rollup) Modes

The `unique` parameter specifies if Scryfall should remove
“duplicate” results in your query. The options are:

Unique | Default | Description || `cards` | ✓ | Removes duplicate gameplay objects (cards that share a name and have the same functionality). For example, if your search matches more than one print of Pacifism, only one copy of Pacifism will be returned. |
| `art` |  | Returns only one copy of each unique artwork for matching cards. For example, if your search matches more than one print of Pacifism, one card with each different illustration for Pacifism will be returned, but any cards that duplicate artwork already in the results will be omitted. |
| `prints` |  | Returns all prints for all cards matched (disables rollup). For example, if your search matches more than one print of Pacifism, all matching prints will be returned. |

## Sorting Cards

The `order` parameter determines how Scryfall should sort the returned cards.

Order | Default | Description || `name` | ✓ | Sort cards by name, A → Z |
| `set` |  | Sort cards by their set and collector number: AAA/#1 → ZZZ/#999 |
| `released` |  | Sort cards by their release date: Newest → Oldest |
| `rarity` |  | Sort cards by their rarity: Common → Mythic |
| `color` |  | Sort cards by their color and color identity: WUBRG → multicolor → colorless |
| `usd` |  | Sort cards by their lowest known U.S. Dollar price: 0.01 → highest, `null` last |
| `tix` |  | Sort cards by their lowest known TIX price: 0.01 → highest, `null` last |
| `eur` |  | Sort cards by their lowest known Euro price: 0.01 → highest, `null` last |
| `cmc` |  | Sort cards by their mana value: 0 → highest |
| `power` |  | Sort cards by their power: `null` → highest |
| `toughness` |  | Sort cards by their toughness: `null` → highest |
| `edhrec` |  | Sort cards by their EDHREC ranking: lowest → highest |
| `penny` |  | Sort cards by their Penny Dreadful ranking: lowest → highest |
| `artist` |  | Sort cards by their front-side artist name: A → Z |
| `review` |  | Sort cards how podcasts review sets, usually color & CMC, lowest → highest, with Booster Fun cards at the end |

Then you can optionally specify a `dir` parameter to choose
which direction the sorting should occur:

Dir | Default | Description || `auto` | ✓ | Scryfall will automatically choose the most inuitive direction to sort |
| `asc` |  | Sort ascending (the direction of the arrows in the previous table) |
| `desc` |  | Sort descending (flip the direction of the arrows in the previous table) |

## Missing Luxuries

Please note that this search endpoint is more strict than the user-facing
search system on Scryfall. In particular:

* On Scryfall’s website, if your search does not match any cards, the search
  system automatically retries with `include:extras` and again with `lang:any`.
  This API method does not automatically retry your search.
* On Scryfall’s website, if your search is only for a set (example: `e:set`),
  the system automatically redirects you to the custom gallery page
  we have for that set (which uses `unique:prints`).
  This API method does not provide redirects.
* On Scryfall’s website, certain searches trigger additional user interface
  elements that suggest expanding your search coverage
  (with `o:changeling` or `unique:prints` for example)
  or other searches may “swizzle” your results to show the cheapest prints when
  working with price search operators.
  This API method does not have this suggestion and swizzle behavior.
* This API method will not provide help with spelling errors.

## Example Requests

Find red creatures with 3 power, sorted by converted mana cost

GET

https://api.scryfall.com/cards/search?order=cmc&q=c%3Ared+pow%3D3