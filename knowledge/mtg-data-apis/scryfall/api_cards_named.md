# GET /cards/named

Rate limit: 2/second (500ms)

Supported formats: `json`, `text`, `image`

Returns a Card based on a name search string.
This method is designed for building chat bots, forum bots,
and other services that need card details quickly.

If you provide the `exact` parameter,
a card with that exact name is returned.
Otherwise, a 404 [Error](/docs/api/errors) is returned because no card matches.

If you provide the `fuzzy` parameter and a card name matches that string,
then that card is returned.
If not, a fuzzy search is executed for your card name.
The server allows misspellings and partial words to be provided.
For example: `jac bele` will match `Jace Beleren`.

When fuzzy searching, a card is returned if the server is
confident that you unambiguously identified a unique name with your string.
Otherwise, you will receive a 404 [Error](/docs/api/errors)
object describing the problem: either more than 1 one card matched your search,
or zero cards matched.

You may also provide a set code in the `set` parameter, in which case the
name search and the returned card print will be limited to the specified set.

For both `exact` and `fuzzy`, card names are case-insensitive and
punctuation is optional (you can drop apostrophes and periods etc).
For example: `fIReBALL` is the same as `Fireball` and `smugglers copter`
is the same as `Smuggler's Copter`.

| Parameter | Type | Atn | Details |
| --- | --- | --- | --- |
| `exact` | String |  | The exact card name to search for, case insenstive. |
| `fuzzy` | String |  | A fuzzy card name to search for. |
| `set` | String | Optional | A set code to limit the search to one set. |
| `format` | String | Optional | The data format to return: `json`, `text`, or `image`. Defaults to `json`. |
| `face` | String | Optional | If using the `image` format and this parameter has the value `back`, the back face of the card will be returned. Will return a 422 if this card has no back face. |
| `version` | String | Optional | The image version to return when using the `image` format: `small`, `normal`, `large`, `png`, `art_crop`, or `border_crop`. Defaults to `large`. |
| `pretty` | Boolean | Optional | If true, the returned JSON will be prettified. Avoid using for production code. |

## Example Request

Retrieve Austere Command using the string `aust comm`

GET

https://api.scryfall.com/cards/named?fuzzy=aust+comm