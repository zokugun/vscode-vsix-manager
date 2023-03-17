VSIX Manager
============

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/zokugun.vsix-manager?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=zokugun.vsix-manager)
[![Open VSX Version](https://img.shields.io/open-vsx/v/zokugun/vsix-manager?label=Open%20VSX)](https://open-vsx.org/extension/zokugun/vsix-manager)
[![Donation](https://img.shields.io/badge/donate-ko--fi-green)](https://ko-fi.com/daiyam)
[![Donation](https://img.shields.io/badge/donate-liberapay-green)](https://liberapay.com/daiyam/donate)
[![Donation](https://img.shields.io/badge/donate-paypal-green)](https://paypal.me/daiyam99)

With [VSIX Manager](https://github.com/zokugun/vscode-vsix-manager), you can manage your extensions from your settings and install them from several places, including specified marketplaces or GitHub releases.

Configuration
-------------

In your settings:

```jsonc
{
    "vsix.sources": {
        "opn": {
            "type": "marketplace",
            "serviceUrl": "https://open-vsx.org/vscode/gallery",
        },
    },
    "vsix.groups": {
        "node": [
            <...extensions>
        ],
        "python": [
            <...extensions>
        ],
    },
    "vsix.extensions": [
        "opn:zokugun.automatic-editor-sorter",
        "opn:zokugun.explicit-folding",
        "node",
    ],
    "vsix.crons": {
        "update": "0 12 * * *"
    },
}
```

Extensions
----------

`vsix.extensions` supports 3 type of "extensions":
- `<sourceID>:<publisherName>.<extensionName>`: the extension can be found in the associated source<br>
    (`<publisherName>.<extensionName>` <=> Extension ID)
- `<publisherName>.<extensionName>`: the extension will be found in the default marketplace of the editor
- `<groupName>`: use the extensions found in the group

Sources
-------

Within `vsix.sources`, you can define where to find the extensions.

### marketplace

```jsonc
"vsix.sources": {
    "opn": {
        "type": "marketplace",
        "serviceUrl": "https://open-vsx.org/vscode/gallery",
    },
},
```

### file

```jsonc
"vsix.sources": {
    "mfs": {
        "type": "file",
        "path": "~/my-extensions",
    },
},
```

The latest version will be searched in:
- `~/my-extensions`
- `~/my-extensions/<publisherName>`
- `~/my-extensions/<publisherName>.<extensionName>`

### github

`github` is a built-in source (no configuration required) and will install extensions from the GitHub release pages.

```jsonc
{
    "vsix.extensions": [
        "github:<username>/<project>",
    ],
}
```

Groups
------

With `vsix.groups`, you can manage your extensions by sets.

Commands
--------

- `> VSIX Manager: Install extensions`: install the extensions
- `> VSIX Manager: Uninstall extensions`: uninstall the extensions
- `> VSIX Manager: Update extensions`: update the extensions

Crons
-----

`vsix.crons` allows you to schedule the `update` command.

```jsonc
"vsix.crons": {
    "update": "0 12 * * *"      // at 12PM, every day
}
```

Debugging
---------

If the property `vsix.debug` (`false` by default) is `true`, the extension will print out debug information into the channel `VSIX Manager` of the panel `Output` (menu: `View` / `Output`).

Donations
---------

Support this project by becoming a financial contributor.

<table>
    <tr>
        <td><img src="https://raw.githubusercontent.com/daiyam/assets/master/icons/256/funding_kofi.png" alt="Ko-fi" width="80px" height="80px"></td>
        <td><a href="https://ko-fi.com/daiyam" target="_blank">ko-fi.com/daiyam</a></td>
    </tr>
    <tr>
        <td><img src="https://raw.githubusercontent.com/daiyam/assets/master/icons/256/funding_liberapay.png" alt="Liberapay" width="80px" height="80px"></td>
        <td><a href="https://liberapay.com/daiyam/donate" target="_blank">liberapay.com/daiyam/donate</a></td>
    </tr>
    <tr>
        <td><img src="https://raw.githubusercontent.com/daiyam/assets/master/icons/256/funding_paypal.png" alt="PayPal" width="80px" height="80px"></td>
        <td><a href="https://paypal.me/daiyam99" target="_blank">paypal.me/daiyam99</a></td>
    </tr>
</table>

**Enjoy!**
