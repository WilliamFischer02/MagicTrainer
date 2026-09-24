# List Objects

A List object represents a requested sequence of other objects (Cards, Sets, etc).
List objects may be paginated, and also include information about
issues raised when generating the list.

| Property | Type | Atn | Details |
| --- | --- | --- | --- |
| `object` | String |  | A content type for this object, always `list`. |
| `data` | Array |  | An array of the requested objects, in a specific order. |
| `has_more` | Boolean |  | True if this List is paginated and there is a page beyond the current page. |
| `next_page` | URI | Nullable | If there is a page beyond the current page, this field will contain a full API URI to that page. You may submit a HTTP `GET` request to that URI to continue paginating forward on this List. |
| `total_cards` | Integer | Nullable | If this is a list of Card objects, this field will contain the total number of cards found across all pages. |
| `warnings` | Array | Nullable | An array of human-readable warnings issued when generating this list, as strings. Warnings are non-fatal issues that the API discovered with your input. In general, they indicate that the List will not contain the all of the information you requested. You should fix the warnings and re-submit your request. |

## Example Request

Find white cards with mana value 1

GET

https://api.scryfall.com/cards/search?q=c%3Awhite+mv%3D1