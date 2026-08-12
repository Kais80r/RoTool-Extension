# RoTool Updater

Keep this `updater` folder inside the permanent folder that is already loaded through **Load unpacked**. Do not rename, move, remove, or load that extension again.

The official setup package is preconfigured for `Kais80r/RoTool-Extension`. Double-click `Update RoTool.cmd` to check it. A source checkout without local configuration asks for the public repository once and remembers it in the ignored `updater.config.json` file.

The updater downloads the newest published GitHub Release, verifies its checksum, rejects unexpected archive contents, creates a local rollback backup, and replaces only RoTool's managed runtime files. It never accesses the browser profile, settings, or Chart history.

After a successful update:

1. Keep the existing extension card installed.
2. Open `edge://extensions` or `chrome://extensions`.
3. Press **Reload** on that same RoTool card.
4. Refresh Roblox.

`updater.config.json` is local configuration and must not be committed. A public repository is recommended; never place a GitHub access token in this folder.
