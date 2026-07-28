# Rubik Font (Offline)

The UI references the Rubik font via @font-face in `assets/css/base.css`.
To enable the exact typography described in the spec, drop the Rubik woff2/woff
files into this folder:

  assets/fonts/Rubik-Regular.woff2
  assets/fonts/Rubik-Medium.woff2
  assets/fonts/Rubik-Bold.woff2

You can obtain them from Google Fonts (https://fonts.google.com/specimen/Rubik).
If the files are absent, the app falls back to the system UI font automatically,
so it still runs fully offline.

# App Icons (optional)

Place branded icons here for the packaged build (electron-builder):

  assets/icons/icon.png
  assets/icons/icon.ico
  assets/icons/icon.icns
