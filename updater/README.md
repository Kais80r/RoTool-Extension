# RoTool Updater

Keep this `updater` folder inside the permanent folder that is already loaded through **Load unpacked**. Do not rename, move, remove, or load that extension again.

The official setup package is preconfigured for `Kais80r/RoTool-Extension`. Double-click `Update RoTool.cmd` to check it. A source checkout without local configuration asks for the public repository once and remembers it in the ignored `updater.config.json` file.

The updater downloads the newest published GitHub Release, verifies its checksums, rejects unexpected archive contents, creates local rollback backups, and replaces only RoTool's managed runtime files. New managed files can be added by a later release; rollback records that they did not exist previously and removes them if the update fails or is interrupted. Updater 1.1 and later first refresh their exact core (`Update-RoTool.ps1`, this README, and `package-files.json`) and restart the new script when required. The stable `Update RoTool.cmd` launcher and `updater.config.json` are never included in that self-update, so local configuration remains unchanged.

The default `browser: "auto"` opens and focuses the Chrome or Edge extensions page belonging to the browser where this exact RoTool folder is registered. Chrome and Edge discard internal extensions-page addresses passed on their command line, so the updater creates one new tab, verifies that the selected browser really is the foreground application, and only then enters the fixed `chrome://extensions/` or `edge://extensions/` address. It never enters text when that verification fails and never opens a second fallback window; in that case it prints the address for you to open manually. Detection reads only Chromium's local profile list and extension-registration metadata (`Preferences` / `Secure Preferences`); it never reads cookies, browsing history, passwords, Roblox sign-in data, extension storage, or Chart history. Set `browser` to `"chrome"` or `"edge"` in the schema-2 configuration to override detection.

If this folder still contains updater 1.0, copy the complete `updater` folder from the latest `RoTool-setup.zip` over this folder once. Keep the extension root and existing browser extension card in place. Later updater-core releases install themselves automatically.

After a successful update:

1. Keep the existing extension card installed.
2. The updater opens and focuses the correct `chrome://extensions/` or `edge://extensions/` page.
3. Press **Reload** on that same RoTool card.
4. Refresh Roblox.

`updater.config.json` is local configuration and must not be committed. A public repository is recommended; never place a GitHub access token in this folder.
