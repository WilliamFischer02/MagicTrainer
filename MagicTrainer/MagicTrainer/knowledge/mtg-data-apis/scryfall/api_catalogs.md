# Catalog Objects

A Catalog object contains an array of Magic datapoints (words, card values, etc).
Catalog objects are provided by the API as aids for building other Magic software
and understanding possible values for a field on Card objects.

| Property | Type | Atn | Details |
| --- | --- | --- | --- |
| `object` | String |  | A content type for this object, always `catalog`. |
| `uri` | URI |  | A link to the current catalog on Scryfall’s API. |
| `total_values` | Integer |  | The number of items in the `data` array. |
| `data` | Array |  | An array of datapoints, as strings. |

## Example Request

Retrieve the catalog of land types.

GET

https://api.scryfall.com/catalog/land-types