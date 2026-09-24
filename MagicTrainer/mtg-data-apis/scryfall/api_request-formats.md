# Request Formats

Each Scryfall API method will return data as a JSON blob.
Some methods support additional alternative formats.
Each API method documents which formats it will support.

Format | Default | Desc || `json` | ✓ | Return data as a JSON blob |
| `csv` |  | Return data as a CSV table |
| `text` |  | Return a formatted plaintext snippet |
| `image` |  | Return an `HTTP 302` redirect to an image file |
| `file` |  | Return an `HTTP 302` redirect to a JSON file |

## Image and File Requests

The `image` and `file` formats will return an `HTTP 302` redirect
directly to an image file or another downloadable item.
Ensure your HTTP library will accept this behavior if you use it.

## Image Requests: Version

When requesting the `image` format, you may also provide a `version` parameter
for the specific [image version](/docs/api/images) you would like returned. It can
be `small`, `normal`, `large`, `png`, `art_crop`, or `border_crop`.
The default is `large`.

## Image Requests: Back Face

When requesting the `image` format, you may also provide a `face` parameter
with the value `back`.
If this card has two faces, a redirect to an image for the back face
of the card will be returned.
If this card does not have a back face, the method will return a 422 error.

Multiple card types contain two images, which can all be
[browsed here](/search?q=is%3Adoublesided).

## Text and Image Headers

When you request the `text` or `image` format, the API will also set
two additional HTTP headers:

Header | Description || `X-Scryfall-Card` | A URI the Scryfall permapage for the returned card. |
| `X-Scryfall-Card-Image` | A URI to an image of the card returned |

## CSV Format Headers

When you request the `csv` format, the API will set these additional
additional HTTP headers:

Header | Description || `X-Scryfall-Has-More` | Will have the value `true` if there is another page of CSV data beyond this one |
| `X-Scryfall-Next-Page` | A URI to the next CSV page. You can submit an HTTP `GET` request to this URI to continue paginating. |