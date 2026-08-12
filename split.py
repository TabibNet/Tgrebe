"""
split.py — separates a monolithic index.html into index.html / style.css / script.js

USAGE:
    1. Put this file in the SAME folder as your original "index.html".
    2. Run:  python3 split.py
    3. It will create/overwrite: style.css, script.js, and a new index.html
       (your original file is untouched unless you rename things yourself —
       recommended: keep a backup copy first, e.g. `cp index.html index_backup.html`)

WHAT IT DOES:
    - Extracts everything inside <style>...</style> into style.css
    - Extracts inline <script>...</script> blocks that appear INSIDE <body>
      (i.e. that do NOT have a src="..." attribute) into script.js, in order,
      then removes those tags from the HTML.
    - Leaves <head> scripts (OneSignal init, Tailwind config, etc.) and any
      <script src="..."> tags (CDN libraries) exactly where they are, so
      third-party library load order/behavior is not disturbed.
    - Adds <link rel="stylesheet" href="style.css"> in <head>.
    - Adds <script type="module" src="script.js"></script> right before </body>
      (kept as type="module" because the original script uses Firebase
      `import` statements).
"""
import re

SOURCE_FILE = "index.html"          # your original file
OUT_HTML = "index.html"             # will be overwritten with the cleaned version
OUT_CSS = "style.css"
OUT_JS = "script.js"

with open(SOURCE_FILE, "r", encoding="utf-8") as f:
    html = f.read()

# 1. Extract <style>...</style> block(s) -> style.css
style_blocks = re.findall(r"<style>(.*?)</style>", html, flags=re.DOTALL)
css_content = "\n\n".join(s.strip() for s in style_blocks)
html_no_style = re.sub(r"\s*<style>.*?</style>\s*", "\n", html, flags=re.DOTALL)

# 2. Extract inline <script> blocks (no src=) FROM THE BODY ONLY -> script.js
script_pattern = re.compile(r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>", flags=re.DOTALL)
js_parts = []

def strip_inline(match):
    attrs = match.group("attrs")
    body = match.group("body")
    if "src=" in attrs:
        return match.group(0)          # keep external <script src="..."> tags as-is
    if body.strip():
        js_parts.append(body.strip("\n"))
    return ""                          # remove the inline <script> tag

body_split = re.split(r"(<body[^>]*>)", html_no_style, maxsplit=1)
if len(body_split) == 3:
    head_part, body_tag, body_part = body_split
    body_part = script_pattern.sub(strip_inline, body_part)
    html_no_script = head_part + body_tag + body_part
else:
    html_no_script = script_pattern.sub(strip_inline, html_no_style)

js_content = "\n\n".join(js_parts)

with open(OUT_CSS, "w", encoding="utf-8") as f:
    f.write(css_content + "\n")

with open(OUT_JS, "w", encoding="utf-8") as f:
    f.write(js_content + "\n")

# 3. Link style.css in <head>, add <script type="module" src="script.js"> before </body>
if "style.css" not in html_no_script:
    # insert right after the Font Awesome stylesheet if found, else right after <head>
    marker = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">'
    if marker in html_no_script:
        html_no_script = html_no_script.replace(
            marker, marker + '\n    <link rel="stylesheet" href="style.css">'
        )
    else:
        html_no_script = html_no_script.replace(
            "<head>", "<head>\n    <link rel=\"stylesheet\" href=\"style.css\">", 1
        )

html_final = html_no_script.replace(
    "</body>", '    <script type="module" src="script.js"></script>\n</body>'
)

with open(OUT_HTML, "w", encoding="utf-8") as f:
    f.write(html_final)

print("Done!")
print(f"  {OUT_CSS}: {len(css_content):,} characters")
print(f"  {OUT_JS}: {len(js_content):,} characters")
print(f"  {OUT_HTML}: rewritten with <link> + <script src> references")
