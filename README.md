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

Groups
------

With `vsix.groups`, you can manage your extensions by sets.

Extensions
----------

### String notation

`vsix.extensions` and each group of `vsix.groups` are a list of expression

```
expression = ["-"] *identifier* ("||" *identifier*)*

identifier = *groupName* | *extensionID* | *sourceName*:*extensionID*
```

- `extensionID`: id of an extension found in VSCode, VSCodium, ... (same as `<publisherName>.<extensionName>`)
- `groupName`: name of a group defined in `vsix.groups`
- `sourceName`: name of a source defined in `vsix.sources`

```jsonc
"vsix.extensions": [
    "opn:zokugun.explicit-folding",
    "-vsx:devXalt.extYalt||ms:devX.extY"
],
```

### Object notation

```jsonc
"vsix.extensions": [
    "-vsx:devXalt.extYalt||ms:devX.extY"
],

// is equivalent to

"vsix.extensions": [
    {
        "id": [
            "vsx:devXalt.extYalt",
            "ms:devX.extY",
        ],
        "enabled": false,
    },
],
```

### Disable

If an expression is prefixed by `-` or `"enabled": false`, then the extension or the group of extension will be installed in a disable state.

### Alternatives

If an expression contains multiple identifiers, the manager will try the first one. It it fails, it will try the next one until an extension is installed.

### Wanted version

You can specify the version you want like `"ms:devX.extY@0.99.0"`.

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

#### Home

The `~` shortcut for the home directory is working on all systems, including Windows.

#### Lookup

The latest version will be searched in:
- `~/my-extensions`
- `~/my-extensions/<publisherName>`
- `~/my-extensions/<publisherName>.<extensionName>`

For an extension named: `"mfs:devX.extY"`, it will for the files:
- `~/my-extensions/devX.extY-<version>.vsix`
- `~/my-extensions/devX/devX.extY-<version>.vsix`
- `~/my-extensions/devX.extY/devX.extY-<version>.vsix`

For an extension named: `"mfs:extXYZ"`, it will for the files:
- `~/my-extensions/extXYZ-<version>.vsix`
- `~/my-extensions/extXYZ/extXYZ-<version>.vsix`

### github

`github` is a built-in source (no configuration required) and will install extensions from the GitHub release pages.

```jsonc
{
    "vsix.extensions": [
        "github:<username>/<project>",
    ],
}
```

#### Private repository

You can access your private repositories by giving an access token. You can specify an environment variable to read it from.

```jsonc
{
    "vsix.sources": {
        "mgh": {
            "type": "github",
            "token": "env:MY_TOKEN",
        },
    },
    "vsix.extensions": [
        "mgh:<username>/<project>",
    ],
}
```

#### Owner

```jsonc
{
    "vsix.sources": {
        "mgh": {
            "type": "github",
            "owner": "<username>",
        },
    },
    "vsix.extensions": [
        "mgh:<project>",
    ],
}
```

### `fallback` property

You can use the `fallback` property to use another source when the extension isn't found in the first source.

```
"vsix.sources": {
    "mfs": {
        "type": "file",
        "path": "~/my-extensions",
        "fallback": "opn",
    },
    "opn": {
        "type": "marketplace",
        "serviceUrl": "https://open-vsx.org/vscode/gallery",
    },
},
```

### `throttle` property

You can use the `throttle` property to limit the number of requests to a source.

```jsonc
"vsix.sources": {
    "opn": {
        "type": "marketplace",
        "serviceUrl": "https://open-vsx.org/vscode/gallery",
        "throttle": 5000,
    },
},
```

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
