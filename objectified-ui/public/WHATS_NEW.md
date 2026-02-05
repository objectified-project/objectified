# Objectified 03-2026

We continue to improve the platform based on your feedback with improvements and new features!

---

## New Features and Improvements

- Canvas Improvements:
  - Added top-to-bottom and left-to-right layout options
  - Added focused searching functionality for focused searching in canvases with large structures
  - Added export form for exporting canvas diagrams with multiple output options
  - Added ability to switch connection types for edges in the canvas
  - Added background configurations to the canvas
  - Added ability to enable/disable grid
  - Canvas changes also apply to the Paths canvas
- Paths Improvements:
  - Added API Key security schemes: define header, query, or cookie-based API keys in the Security tab and use them on operations (#410)
  - Added inline variable editor that can click parameters in the header of the path studio
  - Added primitives template usage in schema definitions
  - Added security requirements to HTTP Operation endpoint definitions
  - Added the ability to mark operations as deprecated
  - Added the ability to mark operations as private (exclusion from Swagger)
  - Added external documentation to operations
  - Added x-* extension tags to HTTP Operation definitions
  - Added security section:
    - Adds API Keys for Security options
    - Adds HTTP Authentication options (Basic, Bearer, Custom)
    - Adds OAuth2 security options
    - Adds OpenID security options
    - Adds TLS security options
    - Adds custom security schema options
    - Security options can be dragged and dropped to operations to set them from the catalog
  - Added ability to apply multiple security schemes to HTTP Operations (and/or)
  - Added ability to specify different security scopes on a per-operation basis
  - Added ability to mark an endpoint as public (i.e. requires no security)
  - Adds servers section:
    - Adds ability to create a server, name, and description
  - Parameters for headers and properties can include:
    - Required
    - Default Value
    - Description
  - Configure required OAuth2/OpenID Connect scopes per operation
  - Configure serialization style for parameterized variables: form, spaceDelimited, pipeDelimited, deepObject
  - Added flag to explode variable arrays and objects in the parameterized variables section
  - Added autocomplete on variable name suggestions for common parameter names in the parameters panel
  - Added custom response headers to response codes
  - Added custom response content types for the response codes, each response code can be its own response
  - Added HATEOS links support for response mapping
  - Added Examples creation for each response type along with each operation verb details
  - Added the ability to use a catch-all for response values with a range: 2XX, 3XX, and so on
  - Added the ability to define a catch-all response for error responses in HTTP Operations
  - Dragging a property to a variable chip in the header will apply that property's primitive settings to the bound variable
  - Dragging a class to a response schema allows the class to be copied or referenced
- OpenAPI Support:
  - Now at 100% support for class and properties definitions
- Bug fixes:
  - Fixed AI generation bug when creating $ref objects: was referring to properties, not the object itself.
  - Fixed $ref editing in classes - was opening a blank editing panel, now corrected.
  - Fixed canvas layout to auto-load a canvas position if one was saved previously, but only on the initial load.
  - Updated AI model list to only include supported generative models.

View our YouTube channel [here](https://www.youtube.com/@objectifieddev) for detailed tutorials and walkthroughs!

---

## Feedback

We'd love to hear your thoughts! Your feedback helps us make Objectified better.

---

**Thank you for using Objectified!**

*Last updated: February 1, 2026*

