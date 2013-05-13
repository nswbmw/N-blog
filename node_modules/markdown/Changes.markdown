# Changelog for markdown

## v0.4.0 - 2012-06-09

- Fix for anchors enclosed by parenthesis (issue #46)
- `npm test` will now run the entire test suite cleanly. (switch tests over to
  node-tap). (#21)
- Allow inline elements to appear inside link text (#27)
- Improve link parsing when link is inside parenthesis (#38)
- Actually render image references (#36)
- Improve link parsing when multiple on a line (#5)
- Make it work in IE7/8 (#37)
- Fix blockquote merging/implicit conversion between string/String (#44, #24)
- md2html can now process stdin (#43)
- Fix jslint warnings (#42)
- Fix to correctly render self-closing tags (#40, #35, #28)