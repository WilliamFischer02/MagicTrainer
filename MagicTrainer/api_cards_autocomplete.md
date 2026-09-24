# GET /cards/autocomplete

Supported formats: `json`

Returns a [Catalog](/docs/api/catalogs) object containing up to
20 full English card names that could be autocompletions of the given string parameter.

This method is designed for creating assistive UI elements
that allow users to free-type card names.

The names are sorted with the nearest match first, highly favoring
results that begin with your given string.

Spaces, punctuation, and capitalization are ignored.

If `q` is less than 2 characters long, or if no names match,
the Catalog will contain 0 items (instead of returning any errors).

| Parameter | Type | Atn | Details |
| --- | --- | --- | --- |
| `q` | String |  | The string to autocomplete. |
| `format` | String | Optional | The data format to return. This method only supports `json`. |
| `pretty` | Boolean | Optional | If true, the returned JSON will be prettified. Avoid using for production code. |
| `include_extras` | Boolean | Optional | If true, extra cards (tokens, planes, vanguards, etc) will be included. Defaults to false. |

## Example Request

Autocomplete the string `thal`

GET

https://api.scryfall.com/cards/autocomplete?q=thal