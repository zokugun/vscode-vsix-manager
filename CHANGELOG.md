# Changelog

## v0.7.1 | 2024-11-25
- remove debug log

## v0.7.0 | 2024-11-12
- access private github repositories
- check engine compatibility
- add wanted version

## v0.6.0 | 2024-03-20
- use platform to select archive, thanks to **@SylvKT**

## v0.5.0 | 2023-04-23
- add alternatives to an extension
- add ability to install disabled extensions
- add `fallback` property to a source
- add `throttle` property (in milliseconds) to a source
- fix download using the url issued by the search result
- improve search query to find the correct extension

## v0.4.3 | 2023-03-12
- fix finding the correct extension to install from a marketplace

## v0.4.2 | 2023-03-12
- fix installing extensions without source
- fix uninstalling extensions, thanks to **@manuth**
- improved README, thanks to **@GitMensch**

## v0.4.1 | 2023-03-01
- fix handling of extensions without source, thanks to **@manuth**

## v0.4.0 | 2023-01-14
- add `file` source to install extensions from local directory
- add built-in `github` source to install extensions from GitHub Releases
- rename source's property `kind` as `type`

## v0.3.1 | 2022-12-25
- correctly updating extensions when installing

## v0.3.0 | 2022-12-25
- correctly generate installed extensions list
- rename `vsix.enabled` flag as `vsix.applyChanges`
- add `vsix.uninstallExtensions` command

## v0.2.0 | 2022-12-25
- expose list of managed extensions
- expose install function

## v0.1.0 | 2022-12-25
- initial release
