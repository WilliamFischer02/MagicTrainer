# Error Objects

An Error object represents a failure to find information or understand the
input you provided to the API.
Error objects are always transmitted with the appropriate `4XX` or `5XX` HTTP status code.

| Property | Type | Atn | Details |
| --- | --- | --- | --- |
| `status` | Integer |  | An integer HTTP status code for this error. |
| `code` | String |  | A computer-friendly string representing the appropriate HTTP status code. |
| `details` | String |  | A human-readable string explaining the error. |
| `type` | String | Nullable | A computer-friendly string that provides additional context for the main error. For example, an endpoint many generate `HTTP 404` errors for different kinds of input. This field will provide a label for the specific kind of 404 failure, such as `ambiguous`. |
| `warnings` | Array | Nullable | If your input also generated non-failure warnings, they will be provided as human-readable strings in this array. |

## Example Request

Get an API error with warnings.

GET

https://api.scryfall.com/cards/search?q=is%3Aslick+cmc%3Ecmc